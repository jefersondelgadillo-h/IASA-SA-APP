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

router.get("/activities/:id/history", async (req, res) => {
  const history = await db
    .prepare("SELECT * FROM activity_history WHERE activity_id = ? ORDER BY updated_at DESC")
    .all(req.params.id);
  res.json(history);
});

export default router;
