import { Router } from "express";
import db from "../db.js";
import { notifyStatusUpdate } from "../services/notify.js";

const router = Router();

const VALID_STATUSES = ["Pendiente", "En progreso", "Completado", "Con problema"];

router.patch("/activities/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, comment, updated_by } = req.body || {};

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Estado invalido. Usa uno de: ${VALID_STATUSES.join(", ")}` });
  }
  if (!updated_by || !String(updated_by).trim()) {
    return res.status(400).json({ error: "Falta indicar quien actualiza la actividad." });
  }
  if (status === "Con problema" && !(comment && comment.trim())) {
    return res.status(400).json({ error: "Agrega un comentario explicando el problema." });
  }

  const activity = await db.prepare("SELECT * FROM activities WHERE id = ?").get(id);
  if (!activity) return res.status(404).json({ error: "Actividad no encontrada." });

  const now = new Date().toISOString();
  const trimmedComment = comment && comment.trim() ? comment.trim() : null;

  await db.transaction(async (tx) => {
    await tx
      .prepare(
        `UPDATE activities
         SET status = ?, status_comment = ?, status_updated_by = ?, status_updated_at = ?
         WHERE id = ?`
      )
      .run(status, trimmedComment, updated_by, now, id);

    await tx
      .prepare(
        `INSERT INTO activity_history (activity_id, old_status, new_status, comment, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, activity.status, status, trimmedComment, updated_by, now);
  });

  const updated = await db.prepare("SELECT * FROM activities WHERE id = ?").get(id);

  notifyStatusUpdate({
    event: "activity_status_updated",
    activity: {
      id: updated.id,
      order_number: updated.order_number,
      description: updated.description,
      area: updated.area,
      equipment: updated.equipment,
      activity_type: updated.activity_type,
      assigned_to: updated.assigned_to,
      activity_date: updated.activity_date,
    },
    old_status: activity.status,
    new_status: status,
    comment: trimmedComment,
    updated_by,
    updated_at: now,
  });

  res.json(updated);
});

// Una misma orden puede tener horas repartidas en varios dias (una fila por
// dia). El cliente fusiona esas filas en una sola tarjeta y, al guardar un
// cambio de estado, manda aqui todos los ids de una vez: se actualiza cada
// fila y se guarda su historial, pero se notifica a Power Automate una sola
// vez por accion del tecnico (antes se notificaba una vez por fila/dia).
router.patch("/activities/status", async (req, res) => {
  const { ids, status, comment, updated_by } = req.body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Falta indicar las actividades a actualizar." });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Estado invalido. Usa uno de: ${VALID_STATUSES.join(", ")}` });
  }
  if (!updated_by || !String(updated_by).trim()) {
    return res.status(400).json({ error: "Falta indicar quien actualiza la actividad." });
  }
  if (status === "Con problema" && !(comment && comment.trim())) {
    return res.status(400).json({ error: "Agrega un comentario explicando el problema." });
  }

  const activitiesById = new Map();
  for (const id of ids) {
    const activity = await db.prepare("SELECT * FROM activities WHERE id = ?").get(id);
    if (!activity) return res.status(404).json({ error: "Actividad no encontrada." });
    activitiesById.set(id, activity);
  }

  const now = new Date().toISOString();
  const trimmedComment = comment && comment.trim() ? comment.trim() : null;

  await db.transaction(async (tx) => {
    for (const id of ids) {
      const activity = activitiesById.get(id);
      await tx
        .prepare(
          `UPDATE activities
           SET status = ?, status_comment = ?, status_updated_by = ?, status_updated_at = ?
           WHERE id = ?`
        )
        .run(status, trimmedComment, updated_by, now, id);

      await tx
        .prepare(
          `INSERT INTO activity_history (activity_id, old_status, new_status, comment, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(id, activity.status, status, trimmedComment, updated_by, now);
    }
  });

  const updated = [];
  for (const id of ids) {
    updated.push(await db.prepare("SELECT * FROM activities WHERE id = ?").get(id));
  }

  const representative = [...updated].sort((a, b) => (a.activity_date < b.activity_date ? -1 : 1))[0];
  const distinctDates = [...new Set(updated.map((u) => u.activity_date).filter(Boolean))].sort();

  notifyStatusUpdate({
    event: "activity_status_updated",
    activity: {
      id: representative.id,
      order_number: representative.order_number,
      description: representative.description,
      area: representative.area,
      equipment: representative.equipment,
      activity_type: representative.activity_type,
      assigned_to: representative.assigned_to,
      activity_date: distinctDates.length > 1 ? distinctDates.join(", ") : representative.activity_date,
    },
    old_status: activitiesById.get(representative.id).status,
    new_status: status,
    comment: trimmedComment,
    updated_by,
    updated_at: now,
  });

  res.json(updated);
});

router.get("/activities/:id/history", async (req, res) => {
  const history = await db
    .prepare("SELECT * FROM activity_history WHERE activity_id = ? ORDER BY updated_at DESC")
    .all(req.params.id);
  res.json(history);
});

export default router;
