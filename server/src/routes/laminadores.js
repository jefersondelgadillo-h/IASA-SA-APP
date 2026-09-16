import { Router } from "express";
import db from "../db.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = Router();

const RODILLO_ROW_KEYS = ["R1AR", "R1DR", "R2AR", "R2DR"];
const RODILLO_POINT_COLUMNS = Array.from({ length: 10 }, (_, i) => `point_${i + 1}`);
const RODILLO_ADMIN_FIELDS = [
  "orden_programada",
  "ultimo_cambio_rolos",
  "ultimo_rectificado",
  "rectificador_usado",
  "conclusion",
  "comentario",
  "revisado_por",
];

// Seccion de acceso libre (sin clave de administrador): cualquiera puede ver
// y registrar reseteos de horometro. Cada laminador tiene su propio
// historial, completamente separado del resto.

router.get("/laminadores", async (req, res) => {
  const laminadores = await db.prepare("SELECT id, name FROM laminadores ORDER BY id").all();
  res.json(laminadores);
});

router.get("/laminadores/:id/resets", async (req, res) => {
  const laminador = await db.prepare("SELECT id, name FROM laminadores WHERE id = ?").get(req.params.id);
  if (!laminador) return res.status(404).json({ error: "Laminador no encontrado." });

  const resets = await db
    .prepare("SELECT * FROM laminador_resets WHERE laminador_id = ? ORDER BY reset_date DESC, id DESC")
    .all(laminador.id);

  res.json({ laminador, resets });
});

router.post("/laminadores/:id/resets", async (req, res) => {
  const laminador = await db.prepare("SELECT id, name FROM laminadores WHERE id = ?").get(req.params.id);
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

  const info = await db
    .prepare(
      `INSERT INTO laminador_resets (laminador_id, reset_date, hours_before, reason, performed_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(laminador.id, reset_date, hours, reason && reason.trim() ? reason.trim() : null, performed_by.trim());

  const created = await db.prepare("SELECT * FROM laminador_resets WHERE id = ?").get(info.lastInsertRowid);
  res.json(created);
});

// --- Checklist diario (mismo listado de items para los 8 laminadores) ---

// Los 30 items fijos del checklist (subsistema, componente, accion a revisar),
// para armar el formulario. No cambian por laminador ni por reporte.
router.get("/checklist-items", async (req, res) => {
  const items = await db.prepare("SELECT * FROM checklist_items ORDER BY order_index").all();
  res.json(items);
});

// Historial de checklists llenados para un laminador, mas reciente primero,
// con un resumen de cuantos items quedaron OK/MAL en cada uno.
router.get("/laminadores/:id/checklists", async (req, res) => {
  const laminador = await db.prepare("SELECT id, name FROM laminadores WHERE id = ?").get(req.params.id);
  if (!laminador) return res.status(404).json({ error: "Laminador no encontrado." });

  const reports = await db
    .prepare("SELECT * FROM checklist_reports WHERE laminador_id = ? ORDER BY report_date DESC, id DESC")
    .all(laminador.id);

  const counts = await db
    .prepare(
      `SELECT report_id, estado, COUNT(*) AS c
       FROM checklist_report_items
       WHERE report_id IN (SELECT id FROM checklist_reports WHERE laminador_id = ?)
       GROUP BY report_id, estado`
    )
    .all(laminador.id);

  const countsByReport = new Map();
  for (const c of counts) {
    if (!countsByReport.has(c.report_id)) countsByReport.set(c.report_id, { OK: 0, MAL: 0 });
    if (c.estado === "OK" || c.estado === "MAL") countsByReport.get(c.report_id)[c.estado] = c.c;
  }

  const withCounts = reports.map((r) => ({
    ...r,
    ok_count: countsByReport.get(r.id)?.OK || 0,
    mal_count: countsByReport.get(r.id)?.MAL || 0,
  }));

  res.json({ laminador, reports: withCounts });
});

// Detalle completo de un checklist ya enviado (para que mantenimiento lo revise).
router.get("/laminadores/:id/checklists/:reportId", async (req, res) => {
  const report = await db
    .prepare("SELECT * FROM checklist_reports WHERE id = ? AND laminador_id = ?")
    .get(req.params.reportId, req.params.id);
  if (!report) return res.status(404).json({ error: "Checklist no encontrado." });

  const items = await db
    .prepare(
      `SELECT ci.id AS checklist_item_id, ci.sub_sistema, ci.componente, ci.accion, ci.order_index,
              cri.estado, cri.comentario
       FROM checklist_items ci
       LEFT JOIN checklist_report_items cri ON cri.checklist_item_id = ci.id AND cri.report_id = ?
       ORDER BY ci.order_index`
    )
    .all(report.id);

  res.json({ report, items });
});

// Envia un checklist lleno: fecha, responsable, y el estado/comentario de
// cada item (referenciando checklist_items, que es el mismo listado fijo).
router.post("/laminadores/:id/checklists", async (req, res) => {
  const laminador = await db.prepare("SELECT id, name FROM laminadores WHERE id = ?").get(req.params.id);
  if (!laminador) return res.status(404).json({ error: "Laminador no encontrado." });

  const { report_date, performed_by, items } = req.body || {};

  if (!report_date || !/^\d{4}-\d{2}-\d{2}$/.test(report_date)) {
    return res.status(400).json({ error: "Indica la fecha del checklist." });
  }
  if (!performed_by || !String(performed_by).trim()) {
    return res.status(400).json({ error: "Indica quien lleno el checklist." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Faltan los items del checklist." });
  }
  for (const it of items) {
    if (!it || !it.checklist_item_id) {
      return res.status(400).json({ error: "Item de checklist invalido." });
    }
    if (it.estado && it.estado !== "OK" && it.estado !== "MAL") {
      return res.status(400).json({ error: "Estado invalido en uno de los items." });
    }
  }

  const reportId = await db.transaction(async (tx) => {
    const info = await tx
      .prepare("INSERT INTO checklist_reports (laminador_id, report_date, performed_by) VALUES (?, ?, ?)")
      .run(laminador.id, report_date, performed_by.trim());

    const insertItem = tx.prepare(
      "INSERT INTO checklist_report_items (report_id, checklist_item_id, estado, comentario) VALUES (?, ?, ?, ?)"
    );
    for (const it of items) {
      await insertItem.run(
        info.lastInsertRowid,
        it.checklist_item_id,
        it.estado || null,
        it.comentario && it.comentario.trim() ? it.comentario.trim() : null
      );
    }

    return info.lastInsertRowid;
  });

  const report = await db.prepare("SELECT * FROM checklist_reports WHERE id = ?").get(reportId);
  res.json(report);
});

// --- Informe de medicion de rodillos (galga 0,05 mm) ---
// Cada envio de un operario es una fila del informe (rodillo fijo/movil,
// antes/despues de rectificar). Mantenimiento completa despues los datos
// de la orden/rectificacion y la conclusion de cada informe.

router.get("/laminadores/:id/rodillo-reports", async (req, res) => {
  const laminador = await db.prepare("SELECT id, name FROM laminadores WHERE id = ?").get(req.params.id);
  if (!laminador) return res.status(404).json({ error: "Laminador no encontrado." });

  const reports = await db
    .prepare("SELECT * FROM rodillo_reports WHERE laminador_id = ? ORDER BY fecha DESC, id DESC")
    .all(laminador.id);

  res.json({ laminador, reports });
});

router.get("/laminadores/:id/rodillo-reports/:reportId", async (req, res) => {
  const report = await db
    .prepare("SELECT * FROM rodillo_reports WHERE id = ? AND laminador_id = ?")
    .get(req.params.reportId, req.params.id);
  if (!report) return res.status(404).json({ error: "Informe no encontrado." });
  res.json(report);
});

// Envio del operario: que fila del informe midio, fecha, hora/turno y las
// 10 lecturas de la galga (1 = pasa, 0 = no pasa).
router.post("/laminadores/:id/rodillo-reports", async (req, res) => {
  const laminador = await db.prepare("SELECT id, name FROM laminadores WHERE id = ?").get(req.params.id);
  if (!laminador) return res.status(404).json({ error: "Laminador no encontrado." });

  const { row_key, fecha, hora, turno, points, ejecutado_por } = req.body || {};

  if (!RODILLO_ROW_KEYS.includes(row_key)) {
    return res.status(400).json({ error: "Indica que rodillo y estado se midio." });
  }
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: "Indica la fecha de la medicion." });
  }
  if (!ejecutado_por || !String(ejecutado_por).trim()) {
    return res.status(400).json({ error: "Indica quien realizo la medicion." });
  }
  if (!Array.isArray(points) || points.length !== 10 || points.some((p) => p !== 0 && p !== 1)) {
    return res.status(400).json({ error: "Faltan las 10 lecturas de la galga (pasa/no pasa)." });
  }

  const info = await db
    .prepare(
      `INSERT INTO rodillo_reports
        (laminador_id, row_key, fecha, hora, turno, ${RODILLO_POINT_COLUMNS.join(", ")}, ejecutado_por)
       VALUES (?, ?, ?, ?, ?, ${RODILLO_POINT_COLUMNS.map(() => "?").join(", ")}, ?)`
    )
    .run(
      laminador.id,
      row_key,
      fecha,
      hora && hora.trim() ? hora.trim() : null,
      turno && turno.trim() ? turno.trim() : null,
      ...points,
      ejecutado_por.trim()
    );

  const created = await db.prepare("SELECT * FROM rodillo_reports WHERE id = ?").get(info.lastInsertRowid);
  res.json(created);
});

// Mantenimiento completa la orden/rectificacion, la conclusion y quien
// reviso. Protegido con la clave de administrador.
router.patch("/laminadores/:id/rodillo-reports/:reportId", adminAuth, async (req, res) => {
  const report = await db
    .prepare("SELECT * FROM rodillo_reports WHERE id = ? AND laminador_id = ?")
    .get(req.params.reportId, req.params.id);
  if (!report) return res.status(404).json({ error: "Informe no encontrado." });

  const body = req.body || {};
  const updates = {};
  for (const field of RODILLO_ADMIN_FIELDS) {
    if (field in body) {
      const v = body[field];
      updates[field] = v && String(v).trim() ? String(v).trim() : null;
    }
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No hay cambios para guardar." });
  }

  const setClause = Object.keys(updates)
    .map((f) => `${f} = ?`)
    .join(", ");
  await db
    .prepare(`UPDATE rodillo_reports SET ${setClause}, updated_at = datetime('now') WHERE id = ?`)
    .run(...Object.values(updates), report.id);

  const updated = await db.prepare("SELECT * FROM rodillo_reports WHERE id = ?").get(report.id);
  res.json(updated);
});

export default router;
