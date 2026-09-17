import { Router } from "express";
import multer from "multer";
import XLSX from "xlsx";
import db from "../db.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { parseScheduleWorkbook } from "../services/excelImport.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Verifica la clave sin hacer nada mas; el frontend la usa para el boton "Entrar" del panel admin.
router.post("/admin/login", adminAuth, (req, res) => {
  res.json({ ok: true });
});

// Sube el Excel semanal (enviado por Outlook cada lunes) y reemplaza la programacion de esa semana.
router.post("/admin/upload", adminAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Adjunta el archivo .xlsx." });
  const weekStart = req.body.week_start;
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return res.status(400).json({ error: "Indica la fecha de inicio de semana (YYYY-MM-DD)." });
  }

  const rosterRows = await db.prepare("SELECT code, role FROM technicians").all();
  // Solo Mecanico/Electrico clasifican la especialidad de una actividad;
  // otros roles (Supervisor, Mantenimiento, etc.) igual pueden iniciar
  // sesion y ver sus propias actividades por codigo, pero no cuentan aqui.
  const rosterMap = new Map(
    rosterRows.filter((r) => r.role === "Mecanico" || r.role === "Electrico").map((r) => [r.code, r.role])
  );
  const knownCodes = new Set(rosterRows.map((r) => r.code));

  let parsed;
  try {
    parsed = parseScheduleWorkbook(req.file.buffer, weekStart, rosterMap);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const { activities, allCodes } = parsed;

  const newTechnicianCodes = [...allCodes].filter((c) => !knownCodes.has(c));

  const weekId = await db.transaction(async (tx) => {
    let week = await tx.prepare("SELECT id FROM weeks WHERE week_start = ?").get(weekStart);
    if (week) {
      await tx.prepare("DELETE FROM activities WHERE week_id = ?").run(week.id);
      await tx
        .prepare("UPDATE weeks SET source_filename = ?, uploaded_at = datetime('now') WHERE id = ?")
        .run(req.file.originalname, week.id);
    } else {
      const info = await tx
        .prepare("INSERT INTO weeks (week_start, source_filename) VALUES (?, ?)")
        .run(weekStart, req.file.originalname);
      week = { id: info.lastInsertRowid };
    }

    const insertActivity = tx.prepare(`
      INSERT INTO activities
        (week_id, order_number, activity_date, area, equipment, description, activity_type,
         assigned_to, assigned_codes, planned_hours, row_order)
      VALUES (@week_id, @order_number, @activity_date, @area, @equipment, @description, @activity_type,
              @assigned_to, @assigned_codes, @planned_hours, @row_order)
    `);
    const insertTechnician = tx.prepare(`
      INSERT INTO technicians (code, name, role) VALUES (?, NULL, NULL)
      ON CONFLICT(code) DO NOTHING
    `);

    for (const a of activities) {
      await insertActivity.run({ ...a, week_id: week.id });
    }
    for (const code of newTechnicianCodes) {
      await insertTechnician.run(code);
    }

    return week.id;
  });

  const count = (await db.prepare("SELECT COUNT(*) AS c FROM activities WHERE week_id = ?").get(weekId)).c;

  res.json({
    ok: true,
    week_start: weekStart,
    activities_loaded: count,
    new_technicians: newTechnicianCodes,
  });
});

// Tablero completo para el supervisor: todas las actividades de una semana con su estado/comentario.
router.get("/admin/dashboard", adminAuth, async (req, res) => {
  const week =
    req.query.week ||
    (await db.prepare("SELECT week_start FROM weeks ORDER BY week_start DESC LIMIT 1").get())?.week_start;
  if (!week) return res.json({ week: null, activities: [], stats: {} });

  const weekRow = await db.prepare("SELECT id, uploaded_at FROM weeks WHERE week_start = ?").get(week);
  if (!weekRow) return res.json({ week, activities: [], stats: {} });

  const activities = await db
    .prepare(
      "SELECT * FROM activities WHERE week_id = ? ORDER BY activity_date IS NULL, activity_date, row_order"
    )
    .all(weekRow.id);

  const nameByCode = new Map(
    (await db.prepare("SELECT code, name FROM technicians").all()).map((t) => [t.code, t.name])
  );
  const withNames = activities.map((a) => ({
    ...a,
    assigned_codes_list: a.assigned_codes.split(",").filter(Boolean),
    resolved_names: a.assigned_codes
      .split(",")
      .filter(Boolean)
      .map((c) => nameByCode.get(c) || c),
  }));

  const stats = { total: withNames.length };
  for (const a of withNames) {
    stats[a.status] = (stats[a.status] || 0) + 1;
  }
  stats["Sin clasificar"] = withNames.filter((a) => !a.activity_type).length;

  res.json({ week, uploaded_at: weekRow.uploaded_at, activities: withNames, stats });
});

// --- Gestion del roster de tecnicos (codigo de Puesto -> nombre + especialidad) ---

router.get("/admin/technicians", adminAuth, async (req, res) => {
  const technicians = await db
    .prepare("SELECT id, code, name, role, active FROM technicians ORDER BY (name IS NULL) DESC, code")
    .all();
  res.json(technicians);
});

const EXPORT_HEADERS = [
  "Semana",
  "Fecha",
  "Orden",
  "Area",
  "Equipo",
  "Actividad",
  "Tipo",
  "Responsable",
  "Estado anterior",
  "Estado nuevo",
  "Comentario",
  "Actualizado por",
  "Actualizado el",
];

// Arma la hoja (o headers vacios si no hay filas) y la envia como .xlsx o
// .csv segun format. Usado por todos los endpoints de exportacion del panel.
function sendExport(res, format, rows, headers, filenameBase, sheetName) {
  const sheet = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([headers]);

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(sheet);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.csv"`);
    return res.send("﻿" + csv); // BOM para que Excel muestre bien las tildes
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.xlsx"`);
  res.send(buffer);
}

// Exporta el historial completo de cambios de estado (todas las semanas
// cargadas hasta ahora) para que el supervisor lo analice en Excel/CSV.
// Protegido con la clave de admin: solo el supervisor puede descargarlo.
router.get("/admin/export", adminAuth, async (req, res) => {
  const format = req.query.format === "csv" ? "csv" : "xlsx";

  const rows = await db
    .prepare(
      `SELECT w.week_start, a.activity_date, a.order_number, a.area, a.equipment, a.description,
              a.activity_type, a.assigned_codes, h.old_status, h.new_status, h.comment, h.updated_by, h.updated_at
       FROM activity_history h
       JOIN activities a ON a.id = h.activity_id
       JOIN weeks w ON w.id = a.week_id
       ORDER BY h.updated_at DESC`
    )
    .all();

  const nameByCode = new Map(
    (await db.prepare("SELECT code, name FROM technicians").all()).map((t) => [t.code, t.name])
  );

  const exportRows = rows.map((r) => ({
    Semana: r.week_start,
    Fecha: r.activity_date || "",
    Orden: r.order_number || "",
    Area: r.area || "",
    Equipo: r.equipment || "",
    Actividad: r.description,
    Tipo: r.activity_type || "Sin clasificar",
    Responsable: r.assigned_codes
      .split(",")
      .filter(Boolean)
      .map((c) => nameByCode.get(c) || c)
      .join(", "),
    "Estado anterior": r.old_status || "",
    "Estado nuevo": r.new_status,
    Comentario: r.comment || "",
    "Actualizado por": r.updated_by || "",
    "Actualizado el": new Date(r.updated_at).toLocaleString(),
  }));

  sendExport(res, format, exportRows, EXPORT_HEADERS, "historial_mantenimiento_iasa", "Historial");
});

// --- Administracion del historial de laminadores (checklists, mediciones
// de rodillos y reseteos de horometro): exportar y eliminar registros.
// El registro (llenado por produccion) es publico; borrarlo o exportar
// todo el historial es exclusivo del administrador. ---

const CHECKLIST_EXPORT_HEADERS = [
  "Laminador",
  "Fecha",
  "Responsable",
  "Subsistema",
  "Componente",
  "Accion",
  "Estado",
  "Comentario",
];

router.get("/admin/laminadores/checklists/export", adminAuth, async (req, res) => {
  const format = req.query.format === "csv" ? "csv" : "xlsx";

  const rows = await db
    .prepare(
      `SELECT l.name AS laminador, cr.report_date, cr.performed_by, ci.sub_sistema, ci.componente, ci.accion,
              cri.estado, cri.comentario
       FROM checklist_report_items cri
       JOIN checklist_items ci ON ci.id = cri.checklist_item_id
       JOIN checklist_reports cr ON cr.id = cri.report_id
       JOIN laminadores l ON l.id = cr.laminador_id
       ORDER BY cr.report_date DESC, l.name, ci.order_index`
    )
    .all();

  const exportRows = rows.map((r) => ({
    Laminador: r.laminador,
    Fecha: r.report_date,
    Responsable: r.performed_by,
    Subsistema: r.sub_sistema,
    Componente: r.componente,
    Accion: r.accion,
    Estado: r.estado || "Sin revisar",
    Comentario: r.comentario || "",
  }));

  sendExport(res, format, exportRows, CHECKLIST_EXPORT_HEADERS, "checklists_laminadores_iasa", "Checklists");
});

router.delete("/admin/laminadores/checklists/:reportId", adminAuth, async (req, res) => {
  const report = await db.prepare("SELECT id FROM checklist_reports WHERE id = ?").get(req.params.reportId);
  if (!report) return res.status(404).json({ error: "Checklist no encontrado." });
  await db.prepare("DELETE FROM checklist_reports WHERE id = ?").run(report.id);
  res.json({ ok: true });
});

const RODILLO_EXPORT_HEADERS = [
  "Laminador",
  "Rodillo",
  "Antes - Fecha",
  "Antes - Hora",
  ...Array.from({ length: 10 }, (_, i) => `Antes - P${i + 1}`),
  "Antes - Ejecutado por",
  "Despues - Fecha",
  "Despues - Hora",
  ...Array.from({ length: 10 }, (_, i) => `Despues - P${i + 1}`),
  "Despues - Ejecutado por",
  "Orden programada",
  "Ultimo cambio de rolos",
  "Ultimo rectificado",
  "Rectificador usado",
  "Conclusion",
  "Comentario",
  "Revisado por",
];

function pointLabel(v) {
  if (v === 1) return "Pasa";
  if (v === 0) return "No pasa";
  return "";
}

router.get("/admin/laminadores/rodillo-reports/export", adminAuth, async (req, res) => {
  const format = req.query.format === "csv" ? "csv" : "xlsx";

  const rows = await db
    .prepare(
      `SELECT l.name AS laminador, rr.*
       FROM rodillo_reports rr
       JOIN laminadores l ON l.id = rr.laminador_id
       ORDER BY COALESCE(rr.despues_fecha, rr.antes_fecha) DESC, rr.id DESC`
    )
    .all();

  const exportRows = rows.map((r) => {
    const row = {
      Laminador: r.laminador,
      Rodillo: r.rodillo === "fijo" ? "Fijo" : "Movil",
      "Antes - Fecha": r.antes_fecha || "",
      "Antes - Hora": r.antes_hora || "",
    };
    for (let i = 1; i <= 10; i++) row[`Antes - P${i}`] = pointLabel(r[`antes_point_${i}`]);
    row["Antes - Ejecutado por"] = r.antes_ejecutado_por || "";
    row["Despues - Fecha"] = r.despues_fecha || "";
    row["Despues - Hora"] = r.despues_hora || "";
    for (let i = 1; i <= 10; i++) row[`Despues - P${i}`] = pointLabel(r[`despues_point_${i}`]);
    row["Despues - Ejecutado por"] = r.despues_ejecutado_por || "";
    row["Orden programada"] = r.orden_programada || "";
    row["Ultimo cambio de rolos"] = r.ultimo_cambio_rolos || "";
    row["Ultimo rectificado"] = r.ultimo_rectificado || "";
    row["Rectificador usado"] = r.rectificador_usado || "";
    row["Conclusion"] = r.conclusion || "";
    row["Comentario"] = r.comentario || "";
    row["Revisado por"] = r.revisado_por || "";
    return row;
  });

  sendExport(res, format, exportRows, RODILLO_EXPORT_HEADERS, "mediciones_rodillos_iasa", "Mediciones");
});

router.delete("/admin/laminadores/rodillo-reports/:reportId", adminAuth, async (req, res) => {
  const report = await db.prepare("SELECT id FROM rodillo_reports WHERE id = ?").get(req.params.reportId);
  if (!report) return res.status(404).json({ error: "Informe no encontrado." });
  await db.prepare("DELETE FROM rodillo_reports WHERE id = ?").run(report.id);
  res.json({ ok: true });
});

const RESETS_EXPORT_HEADERS = ["Laminador", "Fecha", "Horas antes del reseteo", "Motivo", "Responsable"];

router.get("/admin/laminadores/resets/export", adminAuth, async (req, res) => {
  const format = req.query.format === "csv" ? "csv" : "xlsx";

  const rows = await db
    .prepare(
      `SELECT l.name AS laminador, r.reset_date, r.hours_before, r.reason, r.performed_by
       FROM laminador_resets r
       JOIN laminadores l ON l.id = r.laminador_id
       ORDER BY r.reset_date DESC, r.id DESC`
    )
    .all();

  const exportRows = rows.map((r) => ({
    Laminador: r.laminador,
    Fecha: r.reset_date,
    "Horas antes del reseteo": r.hours_before,
    Motivo: r.reason || "",
    Responsable: r.performed_by,
  }));

  sendExport(res, format, exportRows, RESETS_EXPORT_HEADERS, "reseteos_horometro_iasa", "Reseteos");
});

router.delete("/admin/laminadores/resets/:resetId", adminAuth, async (req, res) => {
  const reset = await db.prepare("SELECT id FROM laminador_resets WHERE id = ?").get(req.params.resetId);
  if (!reset) return res.status(404).json({ error: "Reseteo no encontrado." });
  await db.prepare("DELETE FROM laminador_resets WHERE id = ?").run(reset.id);
  res.json({ ok: true });
});

// Elimina por completo la programacion de una semana (actividades y su
// historial de cambios caen en cascada). No se puede deshacer: el frontend
// pide confirmacion antes de llamar esto.
router.delete("/admin/weeks/:week_start", adminAuth, async (req, res) => {
  const { week_start } = req.params;
  const weekRow = await db.prepare("SELECT id FROM weeks WHERE week_start = ?").get(week_start);
  if (!weekRow) return res.status(404).json({ error: "Esa semana no existe." });

  await db.prepare("DELETE FROM weeks WHERE id = ?").run(weekRow.id);
  res.json({ ok: true, week_start });
});

router.patch("/admin/technicians/:id", adminAuth, async (req, res) => {
  const { name, role } = req.body || {};
  const technician = await db.prepare("SELECT * FROM technicians WHERE id = ?").get(req.params.id);
  if (!technician) return res.status(404).json({ error: "Tecnico no encontrado." });

  await db
    .prepare("UPDATE technicians SET name = ?, role = ? WHERE id = ?")
    .run(name && name.trim() ? name.trim() : null, role || null, req.params.id);
  res.json(await db.prepare("SELECT id, code, name, role, active FROM technicians WHERE id = ?").get(req.params.id));
});

export default router;
