/**
 * Notifica a Power Automate cuando un tecnico actualiza el estado de una actividad.
 * El flujo de Power Automate se crea con el trigger "Cuando se recibe una solicitud HTTP"
 * (ver docs/POWER_AUTOMATE.md) y esta funcion simplemente le hace POST con el detalle.
 *
 * No bloquea al llamador: si falla o no hay URL configurada, solo queda un log.
 */
export function notifyStatusUpdate(payload) {
  const url = process.env.POWER_AUTOMATE_WEBHOOK_URL;
  if (!url) {
    console.warn("[notify] POWER_AUTOMATE_WEBHOOK_URL no configurado, se omite la notificacion.");
    return;
  }

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) {
        console.error(`[notify] Power Automate respondio ${res.status} ${res.statusText}`);
      }
    })
    .catch((err) => {
      console.error("[notify] Error al notificar a Power Automate:", err.message);
    });
}
