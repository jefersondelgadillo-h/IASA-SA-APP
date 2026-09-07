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

function classifyType(rawValue) {
  const v = normalize(rawValue);
  if (mapping.tipoMecanicoValues.some((c) => normalize(c) === v)) return "Mecanico";
  if (mapping.tipoElectricoValues.some((c) => normalize(c) === v)) return "Electrico";
  // fallback: intenta detectar por substring
  if (v.startsWith("mec")) return "Mecanico";
  if (v.startsWith("ele")) return "Electrico";
  return null;
}

function excelDateToISO(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const mm = String(parsed.m).padStart(2, "0");
    const dd = String(parsed.d).padStart(2, "0");
    return `${parsed.y}-${mm}-${dd}`;
  }
  const str = String(value).trim();
  // dd/mm/yyyy o dd-mm-yyyy
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // yyyy-mm-dd ya viene bien
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  return str;
}

/**
 * Parsea el buffer de un .xlsx y devuelve las actividades encontradas.
 * Lanza un Error con un mensaje entendible si faltan columnas obligatorias.
 */
export function parseScheduleWorkbook(buffer) {
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
    fecha: findColumnIndex(headerCells, mapping.columns.fecha),
    area: findColumnIndex(headerCells, mapping.columns.area),
    equipo: findColumnIndex(headerCells, mapping.columns.equipo),
    actividad: findColumnIndex(headerCells, mapping.columns.actividad),
    tipo: findColumnIndex(headerCells, mapping.columns.tipo),
    responsable: findColumnIndex(headerCells, mapping.columns.responsable),
    turno: findColumnIndex(headerCells, mapping.columns.turno),
    prioridad: findColumnIndex(headerCells, mapping.columns.prioridad),
  };

  const missing = [];
  if (colIdx.actividad === -1) missing.push("Actividad/Descripcion");
  if (colIdx.tipo === -1) missing.push("Tipo (Mecanico/Electrico)");
  if (missing.length) {
    throw new Error(
      `No se pudieron identificar estas columnas en el Excel: ${missing.join(", ")}. ` +
        `Encabezados encontrados: [${headerCells.filter(Boolean).join(", ")}]. ` +
        `Ajusta server/config/excel-mapping.json si los nombres de columna son distintos.`
    );
  }

  const activities = [];
  let rowOrder = 0;
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === "" || c == null)) continue;

    const actividad = String(row[colIdx.actividad] ?? "").trim();
    if (!actividad) continue;

    const tipo = classifyType(row[colIdx.tipo]);
    if (!tipo) continue; // fila que no corresponde a mecanico ni electrico, se omite

    activities.push({
      activity_date: colIdx.fecha !== -1 ? excelDateToISO(row[colIdx.fecha]) : null,
      area: colIdx.area !== -1 ? String(row[colIdx.area] ?? "").trim() : "",
      equipment: colIdx.equipo !== -1 ? String(row[colIdx.equipo] ?? "").trim() : "",
      description: actividad,
      activity_type: tipo,
      assigned_to: colIdx.responsable !== -1 ? String(row[colIdx.responsable] ?? "").trim() : "",
      shift: colIdx.turno !== -1 ? String(row[colIdx.turno] ?? "").trim() : "",
      priority: colIdx.prioridad !== -1 ? String(row[colIdx.prioridad] ?? "").trim() : "",
      row_order: rowOrder++,
    });
  }

  if (activities.length === 0) {
    throw new Error(
      "El archivo no tiene filas de actividades validas (revisa que la columna Tipo diga Mecanico o Electrico)."
    );
  }

  return activities;
}
