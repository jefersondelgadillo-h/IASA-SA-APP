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

  const rosterRows = db.prepare("SELECT code, role FROM technicians").all();
  const rosterMap = new Map(rosterRows.filter((r) => r.role).map((r) => [r.code, r.role]));
  const knownCodes = new Set(rosterRows.map((r) => r.code));

  let parsed;
  try {
    parsed = parseScheduleWorkbook(req.file.buffer, weekStart, rosterMap);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const { activities, allCodes } = parsed;

  const newTechnicianCodes = [...allCodes].filter((c) => !knownCodes.has(c));

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
        (week_id, order_number, activity_date, area, equipment, description, activity_type,
         assigned_to, assigned_codes, planned_hours, row_order)
      VALUES (@week_id, @order_number, @activity_date, @area, @equipment, @description, @activity_type,
              @assigned_to, @assigned_codes, @planned_hours, @row_order)
    `);
    const insertTechnician = db.prepare(`
      INSERT INTO technicians (code, name, role) VALUES (?, NULL, NULL)
      ON CONFLICT(code) DO NOTHING
    `);

    for (const a of activities) {
      insertActivity.run({ ...a, week_id: week.id });
    }
    for (const code of newTechnicianCodes) {
      insertTechnician.run(code);
    }

    return week.id;
  });

  const weekId = tx();
  const count = db.prepare("SELECT COUNT(*) AS c FROM activities WHERE week_id = ?").get(weekId).c;

  res.json({
    ok: true,
    week_start: weekStart,
    activities_loaded: count,
    new_technicians: newTechnicianCodes,
  });
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

  const nameByCode = new Map(
    db.prepare("SELECT code, name FROM technicians").all().map((t) => [t.code, t.name])
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

  res.json({ week, activities: withNames, stats });
});

// --- Gestion del roster de tecnicos (codigo de Puesto -> nombre + especialidad) ---

router.get("/admin/technicians", adminAuth, (req, res) => {
  const technicians = db
    .prepare("SELECT id, code, name, role, active FROM technicians ORDER BY (name IS NULL) DESC, code")
    .all();
  res.json(technicians);
});

router.patch("/admin/technicians/:id", adminAuth, (req, res) => {
  const { name, role } = req.body || {};
  if (role && !["Mecanico", "Electrico"].includes(role)) {
    return res.status(400).json({ error: "Rol invalido. Usa Mecanico o Electrico." });
  }
  const technician = db.prepare("SELECT * FROM technicians WHERE id = ?").get(req.params.id);
  if (!technician) return res.status(404).json({ error: "Tecnico no encontrado." });

  db.prepare("UPDATE technicians SET name = ?, role = ? WHERE id = ?").run(
    name && name.trim() ? name.trim() : null,
    role || null,
    req.params.id
  );
  res.json(db.prepare("SELECT id, code, name, role, active FROM technicians WHERE id = ?").get(req.params.id));
});

export default router;
