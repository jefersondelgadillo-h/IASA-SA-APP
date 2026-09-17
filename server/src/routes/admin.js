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

  const sheet =
    exportRows.length > 0 ? XLSX.utils.json_to_sheet(exportRows) : XLSX.utils.aoa_to_sheet([EXPORT_HEADERS]);
  const filenameBase = "historial_mantenimiento_iasa";

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(sheet);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.csv"`);
    return res.send("﻿" + csv); // BOM para que Excel muestre bien las tildes
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Historial");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.xlsx"`);
  res.send(buffer);
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
