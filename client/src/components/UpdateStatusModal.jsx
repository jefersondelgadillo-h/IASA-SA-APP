import { useState } from "react";
import { api } from "../lib/api.js";
import StatusBadge from "./StatusBadge.jsx";

const STATUSES = ["Pendiente", "En progreso", "Completado", "Con problema"];

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function shortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return dateStr;
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export default function UpdateStatusModal({ activity, technicianName, onClose, onSaved }) {
  const ids = activity.ids || [activity.id];
  const spansMultipleDays = activity.dates && activity.dates.length > 1;
  const [status, setStatus] = useState(activity.status);
  const [comment, setComment] = useState(activity.status_comment || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  async function toggleHistory() {
    if (history !== null) {
      setHistory(null);
      return;
    }
    setLoadingHistory(true);
    setHistoryError("");
    try {
      const perDay = await Promise.all(
        ids.map(async (id) => {
          const rows = await api.getHistory(id);
          return rows.map((r) => ({ ...r, _date: activity.datesById?.[id] }));
        })
      );
      const combined = perDay.flat().sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
      setHistory(combined);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleSave() {
    if (status === "Con problema" && !comment.trim()) {
      setError("Escribe un comentario explicando el problema.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSaved(ids, { status, comment: comment.trim(), updated_by: technicianName });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-semibold text-gray-900">{activity.description}</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none px-1" aria-label="Cerrar">
            &times;
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-1">
          {[activity.area, activity.equipment].filter(Boolean).join(" · ") || "Sin area/equipo"}
        </p>
        {spansMultipleDays && (
          <p className="text-xs text-iasa-blue bg-iasa-blue/5 rounded-lg p-2 mb-3">
            📅 Esta orden tiene horas en {activity.dates.length} dias ({activity.dates.map(shortDate).join(", ")}).
            El estado que guardes aplica a todos a la vez.
          </p>
        )}

        <p className="text-sm font-medium text-gray-700 mb-2 mt-3">Estado</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-xl border-2 py-3 px-2 text-sm font-medium transition ${
                status === s ? "border-iasa-blue bg-iasa-blue/5" : "border-gray-200"
              }`}
            >
              <StatusBadge status={s} />
            </button>
          ))}
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Comentario {status === "Con problema" && <span className="text-red-600">(obligatorio)</span>}
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Ej: falta repuesto, se reprograma para manana, etc."
          className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-iasa-blue"
        />

        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-iasa-blue text-white font-semibold rounded-xl py-3 mt-2 disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar actualizacion"}
        </button>

        <button onClick={toggleHistory} className="w-full text-xs text-iasa-blue underline mt-4 mb-1">
          {history !== null ? "Ocultar historial de cambios" : "Ver historial de cambios"}
        </button>

        {loadingHistory && <p className="text-xs text-gray-400 text-center">Cargando historial...</p>}
        {historyError && <p className="text-xs text-red-600 text-center">{historyError}</p>}

        {history !== null && !loadingHistory && (
          <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
            {history.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">Todavia no hay cambios registrados.</p>
            )}
            {history.map((h) => (
              <div key={h.id} className="text-xs bg-gray-50 rounded-lg p-2">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  {spansMultipleDays && h._date && (
                    <span className="text-iasa-blue font-medium">{shortDate(h._date)} ·</span>
                  )}
                  {h.old_status && <StatusBadge status={h.old_status} className="opacity-60" />}
                  {h.old_status && <span className="text-gray-400">→</span>}
                  <StatusBadge status={h.new_status} />
                </div>
                <p className="text-gray-500">
                  {h.updated_by || "?"} · {new Date(h.updated_at).toLocaleString()}
                </p>
                {h.comment && <p className="text-gray-600 mt-1">💬 {h.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
