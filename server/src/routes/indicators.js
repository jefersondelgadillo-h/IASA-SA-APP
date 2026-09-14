import { Router } from "express";
import db from "../db.js";

const router = Router();

function currentWeekStart() {
  const row = db.prepare("SELECT week_start FROM weeks ORDER BY week_start DESC LIMIT 1").get();
  return row ? row.week_start : null;
}

function programaSemanalFor(weekStart) {
  const weekRow = db.prepare("SELECT id FROM weeks WHERE week_start = ?").get(weekStart);
  if (!weekRow) return null;
  const total = db.prepare("SELECT COUNT(*) AS c FROM activities WHERE week_id = ?").get(weekRow.id).c;
  const completado = db
    .prepare("SELECT COUNT(*) AS c FROM activities WHERE week_id = ? AND status = 'Completado'")
    .get(weekRow.id).c;
  return total > 0 ? (completado / total) * 100 : null;
}

// Indicadores de gestion visibles para todos (tecnicos y supervisores) apenas
// entran a la app. "Programa Semanal" se calcula solo con datos de esta app
// (actividades completadas / total de la semana), y se compara contra la
// semana anterior; los otros dos vienen de otro sistema y los carga el
// supervisor a mano desde el panel admin (no tienen historial por semana).
router.get("/indicators", (req, res) => {
  const week = req.query.week || currentWeekStart();
  let programaSemanal = null;
  let previousWeek = null;
  let programaSemanalPrev = null;

  if (week) {
    programaSemanal = programaSemanalFor(week);
    const prevRow = db
      .prepare("SELECT week_start FROM weeks WHERE week_start < ? ORDER BY week_start DESC LIMIT 1")
      .get(week);
    if (prevRow) {
      previousWeek = prevRow.week_start;
      programaSemanalPrev = programaSemanalFor(previousWeek);
    }
  }

  const row = db.prepare("SELECT * FROM company_indicators WHERE id = 1").get();

  res.json({
    week,
    previous_week: previousWeek,
    programa_semanal: { value: programaSemanal, meta: 90, previous_value: programaSemanalPrev },
    fallas_equipos: { value: row?.fallas_equipos_pct ?? null, meta: row?.fallas_equipos_meta ?? 3 },
    cumplimiento_anual: { value: row?.cumplimiento_anual_pct ?? null, meta: row?.cumplimiento_anual_meta ?? 90 },
    updated_at: row?.updated_at ?? null,
    updated_by: row?.updated_by ?? null,
  });
});

export default router;
