import { Router } from "express";
import db from "../db.js";

const router = Router();

function currentWeekStart() {
  const row = db.prepare("SELECT week_start FROM weeks ORDER BY week_start DESC LIMIT 1").get();
  return row ? row.week_start : null;
}

// Indicadores de gestion visibles para todos (tecnicos y supervisores) apenas
// entran a la app. "Programa Semanal" se calcula solo con datos de esta app
// (actividades completadas / total de la semana); los otros dos vienen de
// otro sistema y los carga el supervisor a mano desde el panel admin.
router.get("/indicators", (req, res) => {
  const week = req.query.week || currentWeekStart();
  let programaSemanal = null;

  if (week) {
    const weekRow = db.prepare("SELECT id FROM weeks WHERE week_start = ?").get(week);
    if (weekRow) {
      const total = db.prepare("SELECT COUNT(*) AS c FROM activities WHERE week_id = ?").get(weekRow.id).c;
      const completado = db
        .prepare("SELECT COUNT(*) AS c FROM activities WHERE week_id = ? AND status = 'Completado'")
        .get(weekRow.id).c;
      programaSemanal = total > 0 ? (completado / total) * 100 : null;
    }
  }

  const row = db.prepare("SELECT * FROM company_indicators WHERE id = 1").get();

  res.json({
    week,
    programa_semanal: { value: programaSemanal, meta: 90 },
    fallas_equipos: { value: row?.fallas_equipos_pct ?? null, meta: row?.fallas_equipos_meta ?? 3 },
    cumplimiento_anual: { value: row?.cumplimiento_anual_pct ?? null, meta: row?.cumplimiento_anual_meta ?? 90 },
    updated_at: row?.updated_at ?? null,
    updated_by: row?.updated_by ?? null,
  });
});

export default router;
