import { Router } from "express";
import db from "../db.js";

const router = Router();

async function currentWeekStart() {
  const row = await db.prepare("SELECT week_start FROM weeks ORDER BY week_start DESC LIMIT 1").get();
  return row ? row.week_start : null;
}

// Indicadores de gestion visibles para todos (tecnicos y supervisores) apenas
// entran a la app. Vienen de otro sistema (ej. SAP/avisos) y el supervisor
// los carga a mano por semana desde el panel admin, separados por linea de
// produccion (Crown / Tecnal).
router.get("/indicators", async (req, res) => {
  const week = req.query.week || (await currentWeekStart());
  const row = week ? await db.prepare("SELECT * FROM week_indicators WHERE week_start = ?").get(week) : null;

  res.json({
    week,
    fallas_equipos: {
      meta: row?.fallas_equipos_meta ?? 3,
      crown: row?.fallas_equipos_crown_pct ?? null,
      tecnal: row?.fallas_equipos_tecnal_pct ?? null,
    },
    cumplimiento_anual: {
      meta: row?.cumplimiento_anual_meta ?? 90,
      crown: row?.cumplimiento_anual_crown_pct ?? null,
      tecnal: row?.cumplimiento_anual_tecnal_pct ?? null,
    },
    updated_at: row?.updated_at ?? null,
    updated_by: row?.updated_by ?? null,
  });
});

export default router;
