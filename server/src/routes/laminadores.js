import { Router } from "express";
import db from "../db.js";

const router = Router();

// Seccion de acceso libre (sin clave de administrador): cualquiera puede ver
// y registrar reseteos de horometro. Cada laminador tiene su propio
// historial, completamente separado del resto.

router.get("/laminadores", (req, res) => {
  const laminadores = db.prepare("SELECT id, name FROM laminadores ORDER BY id").all();
  res.json(laminadores);
});

router.get("/laminadores/:id/resets", (req, res) => {
  const laminador = db.prepare("SELECT id, name FROM laminadores WHERE id = ?").get(req.params.id);
  if (!laminador) return res.status(404).json({ error: "Laminador no encontrado." });

  const resets = db
    .prepare("SELECT * FROM laminador_resets WHERE laminador_id = ? ORDER BY reset_date DESC, id DESC")
    .all(laminador.id);

  res.json({ laminador, resets });
});

router.post("/laminadores/:id/resets", (req, res) => {
  const laminador = db.prepare("SELECT id, name FROM laminadores WHERE id = ?").get(req.params.id);
  if (!laminador) return res.status(404).json({ error: "Laminador no encontrado." });

  const { reset_date, hours_before, reason, performed_by } = req.body || {};

  if (!reset_date || !/^\d{4}-\d{2}-\d{2}$/.test(reset_date)) {
    return res.status(400).json({ error: "Indica la fecha del reseteo." });
  }
  const hours = Number(hours_before);
  if (hours_before === "" || hours_before == null || Number.isNaN(hours) || hours < 0) {
    return res.status(400).json({ error: "Indica las horas acumuladas antes del reseteo (numero valido)." });
  }
  if (!performed_by || !String(performed_by).trim()) {
    return res.status(400).json({ error: "Indica quien realizo el reseteo." });
  }

  const info = db
    .prepare(
      `INSERT INTO laminador_resets (laminador_id, reset_date, hours_before, reason, performed_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(laminador.id, reset_date, hours, reason && reason.trim() ? reason.trim() : null, performed_by.trim());

  const created = db.prepare("SELECT * FROM laminador_resets WHERE id = ?").get(info.lastInsertRowid);
  res.json(created);
});

export default router;
