import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mapping = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "config", "excel-mapping.json"), "utf8")
);

function normalize(str) {
  return String(str ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function findColumnIndex(headerCells, candidates) {
  const normalizedHeader = headerCells.map(normalize);
  for (const candidate of candidates) {
    const idx = normalizedHeader.indexOf(normalize(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Separa el contenido de "Puesto" en codigos individuales: "CRIOS/EVARGAS" -> ["CRIOS","EVARGAS"] */
function parsePuestoCodes(raw) {
  return String(raw ?? "")
    .split(/[/,]/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Determina la especialidad de una fila a partir de los codigos asignados y el
 * roster conocido (code -> 'Mecanico' | 'Electrico' | null).
 * Si todos los codigos conocidos coinciden en una especialidad, se usa esa.
 * Si hay mezcla, o ningun codigo esta clasificado todavia, devuelve null
 * (queda "sin clasificar" hasta que se complete el roster en el panel admin).
 */
function classifyByRoster(codes, rosterMap) {
  const roles = new Set();
  for (const code of codes) {
    const role = rosterMap.get(code);
    if (role) roles.add(role);
  }
  if (roles.size === 1) return [...roles][0];
  return null;
}

function isNonEmptyNumber(value) {
  if (value === "" || value == null) return false;
  const n = Number(value);
  return !Number.isNaN(n) && n > 0;
}

/**
 * Parsea el buffer de un .xlsx (formato tipo Gantt semanal: Sector, Orden,
 * Equipo, Descripcion, Puesto, Inicio, Fin, Dur., y luego una columna por dia
 * con las horas planificadas) y devuelve una ocurrencia por cada (orden, dia
 * con horas > 0), lista para insertar en la tabla `activities`.
 *
 * @param {Buffer} buffer contenido del .xlsx
 * @param {string} weekStart fecha ISO (YYYY-MM-DD) del lunes de esa semana
 * @param {Map<string,string>} rosterMap codigo de tecnico -> 'Mecanico'|'Electrico'
 */
export function parseScheduleWorkbook(buffer, weekStart, rosterMap = new Map()) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = mapping.sheetName && workbook.SheetNames.includes(mapping.sheetName)
    ? mapping.sheetName
    : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`No se encontro la hoja "${sheetName}" en el archivo.`);

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  const headerRowIdx = Math.max(0, (mapping.headerRow || 1) - 1);
  const headerCells = (rows[headerRowIdx] || []).map((c) => String(c ?? ""));

  const colIdx = {
    sector: findColumnIndex(headerCells, mapping.columns.sector),
    orden: findColumnIndex(headerCells, mapping.columns.orden),
    equipo: findColumnIndex(headerCells, mapping.columns.equipo),
    descripcion: findColumnIndex(headerCells, mapping.columns.descripcion),
    puesto: findColumnIndex(headerCells, mapping.columns.puesto),
    duracion: findColumnIndex(headerCells, mapping.columns.duracion),
  };

  const missing = [];
  if (colIdx.descripcion === -1) missing.push("Descripción/Actividad");
  if (colIdx.puesto === -1) missing.push("Puesto/Responsable");
  if (missing.length) {
    throw new Error(
      `No se pudieron identificar estas columnas en el Excel: ${missing.join(", ")}. ` +
        `Encabezados encontrados: [${headerCells.filter(Boolean).join(", ")}]. ` +
        `Ajusta server/config/excel-mapping.json si los nombres de columna son distintos.`
    );
  }

  // Las columnas de dias son todas las que vienen despues de "Duracion" (o,
  // si no se encontro esa columna, despues de la ultima columna fija
  // conocida) hasta la primera columna sin encabezado.
  const lastFixedCol = Math.max(...Object.values(colIdx).filter((i) => i !== -1));
  const dayColumns = [];
  for (let c = lastFixedCol + 1; c < headerCells.length; c++) {
    if (!String(headerCells[c] ?? "").trim()) break;
    dayColumns.push(c);
  }
  if (dayColumns.length === 0) {
    throw new Error(
      "No se encontraron columnas de dias despues de la columna de duracion. " +
        "Revisa que el Excel tenga una columna por dia de la semana con las horas planificadas."
    );
  }

  const activities = [];
  const allCodes = new Set();
  let sourceRow = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === "" || c == null)) continue;

    const descripcion = String(row[colIdx.descripcion] ?? "").trim();
    const puestoRaw = String(row[colIdx.puesto] ?? "").trim();
    if (!descripcion || !puestoRaw) continue; // fila incompleta, se omite

    const codes = parsePuestoCodes(puestoRaw);
    if (codes.length === 0) continue;
    codes.forEach((c) => allCodes.add(c));

    const activityType = classifyByRoster(codes, rosterMap);
    const orden = colIdx.orden !== -1 ? String(row[colIdx.orden] ?? "").trim() : "";
    const sector = colIdx.sector !== -1 ? String(row[colIdx.sector] ?? "").trim() : "";
    const equipo = colIdx.equipo !== -1 ? String(row[colIdx.equipo] ?? "").trim() : "";

    sourceRow++;
    let dayOffset = 0;
    for (const dayCol of dayColumns) {
      const hoursValue = row[dayCol];
      if (isNonEmptyNumber(hoursValue)) {
        activities.push({
          order_number: orden,
          activity_date: addDays(weekStart, dayOffset),
          area: sector,
          equipment: equipo,
          description: descripcion,
          activity_type: activityType,
          assigned_to: puestoRaw,
          assigned_codes: `,${codes.join(",")},`,
          planned_hours: Number(hoursValue),
          row_order: sourceRow * 100 + dayOffset,
        });
      }
      dayOffset++;
    }
  }

  if (activities.length === 0) {
    throw new Error(
      "El archivo no tiene filas de actividades validas (revisa que existan filas con Descripcion, Puesto y al menos un dia con horas planificadas)."
    );
  }

  return { activities, allCodes };
}
