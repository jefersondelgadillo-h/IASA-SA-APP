import { Router } from "express";
import multer from "multer";
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
router.post("/admin/upload", adminAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Adjunta el archivo .xlsx." });
  const weekStart = req.body.week_start;
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return res.status(400).json({ error: "Indica la fecha de inicio de semana (YYYY-MM-DD)." });
  }

  let activities;
  try {
    activities = parseScheduleWorkbook(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const tx = db.transaction(() => {
    let week = db.prepare("SELECT id FROM weeks WHERE week_start = ?").get(weekStart);
    if (week) {
      db.prepare("DELETE FROM activities WHERE week_id = ?").run(week.id);
      db.prepare("UPDATE weeks SET source_filename = ?, uploaded_at = datetime('now') WHERE id = ?").run(
        req.file.originalname,
        week.id
      );
    } else {
      const info = db
        .prepare("INSERT INTO weeks (week_start, source_filename) VALUES (?, ?)")
        .run(weekStart, req.file.originalname);
      week = { id: info.lastInsertRowid };
    }

    const insertActivity = db.prepare(`
      INSERT INTO activities
        (week_id, activity_date, area, equipment, description, activity_type, assigned_to, shift, priority, row_order)
      VALUES (@week_id, @activity_date, @area, @equipment, @description, @activity_type, @assigned_to, @shift, @priority, @row_order)
    `);
    const upsertTechnician = db.prepare(`
      INSERT INTO technicians (name, role) VALUES (?, ?)
      ON CONFLICT(name) DO NOTHING
    `);

    for (const a of activities) {
      insertActivity.run({ ...a, week_id: week.id });
      if (a.assigned_to) upsertTechnician.run(a.assigned_to, a.activity_type);
    }

    return week.id;
  });

  const weekId = tx();
  const count = db.prepare("SELECT COUNT(*) AS c FROM activities WHERE week_id = ?").get(weekId).c;

  res.json({ ok: true, week_start: weekStart, activities_loaded: count });
});

// Tablero completo para el supervisor: todas las actividades de una semana con su estado/comentario.
router.get("/admin/dashboard", adminAuth, (req, res) => {
  const week =
    req.query.week ||
    db.prepare("SELECT week_start FROM weeks ORDER BY week_start DESC LIMIT 1").get()?.week_start;
  if (!week) return res.json({ week: null, activities: [], stats: {} });

  const weekRow = db.prepare("SELECT id FROM weeks WHERE week_start = ?").get(week);
  if (!weekRow) return res.json({ week, activities: [], stats: {} });

  const activities = db
    .prepare(
      "SELECT * FROM activities WHERE week_id = ? ORDER BY activity_date IS NULL, activity_date, row_order"
    )
    .all(weekRow.id);

  const stats = { total: activities.length };
  for (const a of activities) {
    stats[a.status] = (stats[a.status] || 0) + 1;
  }

  res.json({ week, activities, stats });
});

export default router;
