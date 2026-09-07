import { Router } from "express";
import db from "../db.js";

const router = Router();

function currentWeekStart() {
  const row = db.prepare("SELECT week_start FROM weeks ORDER BY week_start DESC LIMIT 1").get();
  return row ? row.week_start : null;
}

// Lista de semanas disponibles (mas reciente primero), para poder ver semanas pasadas.
router.get("/weeks", (req, res) => {
  const weeks = db.prepare("SELECT week_start, uploaded_at FROM weeks ORDER BY week_start DESC").all();
  res.json(weeks);
});

// Tecnicos conocidos (para el selector de "quien soy" al entrar a la app).
router.get("/technicians", (req, res) => {
  const technicians = db
    .prepare("SELECT id, name, role FROM technicians WHERE active = 1 ORDER BY role, name")
    .all();
  res.json(technicians);
});

// Programacion semanal, con filtros opcionales.
// ?week=YYYY-MM-DD  (por defecto la semana mas reciente cargada)
// ?role=Mecanico|Electrico
// ?technician=Nombre
// ?status=Pendiente|En progreso|Completado|Con problema
router.get("/schedule", (req, res) => {
  const week = req.query.week || currentWeekStart();
  if (!week) return res.json({ week: null, activities: [] });

  const weekRow = db.prepare("SELECT id FROM weeks WHERE week_start = ?").get(week);
  if (!weekRow) return res.json({ week, activities: [] });

  const clauses = ["week_id = ?"];
  const params = [weekRow.id];

  if (req.query.role) {
    clauses.push("activity_type = ?");
    params.push(req.query.role);
  }
  if (req.query.technician) {
    clauses.push("assigned_to = ?");
    params.push(req.query.technician);
  }
  if (req.query.status) {
    clauses.push("status = ?");
    params.push(req.query.status);
  }

  const activities = db
    .prepare(
      `SELECT * FROM activities WHERE ${clauses.join(" AND ")} ORDER BY activity_date IS NULL, activity_date, row_order`
    )
    .all(...params);

  res.json({ week, activities });
});

export default router;
