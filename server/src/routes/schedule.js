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

// Tecnicos con nombre y rol ya registrados (para el selector de "quien soy" al entrar a la app).
// Los codigos detectados en el Excel que aun no tienen nombre/rol asignado en el
// panel admin no aparecen aqui todavia.
router.get("/technicians", (req, res) => {
  const technicians = db
    .prepare(
      "SELECT id, code, name, role FROM technicians WHERE active = 1 AND name IS NOT NULL AND role IS NOT NULL ORDER BY role, name"
    )
    .all();
  res.json(technicians);
});

// Programacion semanal, con filtros opcionales.
// ?week=YYYY-MM-DD  (por defecto la semana mas reciente cargada)
// ?role=Mecanico|Electrico
// ?technician=CODIGO (codigo de Puesto, ej. WPAQUI)
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
    clauses.push("assigned_codes LIKE ?");
    params.push(`%,${req.query.technician},%`);
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

  res.json({ week, activities: withNames });
});

export default router;
