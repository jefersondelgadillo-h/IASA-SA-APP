import { useState } from "react";
import StatusBadge from "./StatusBadge.jsx";

const STATUSES = ["Pendiente", "En progreso", "Completado", "Con problema"];

export default function UpdateStatusModal({ activity, technicianName, onClose, onSaved }) {
  const [status, setStatus] = useState(activity.status);
  const [comment, setComment] = useState(activity.status_comment || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (status === "Con problema" && !comment.trim()) {
      setError("Escribe un comentario explicando el problema.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSaved(activity.id, { status, comment: comment.trim(), updated_by: technicianName });
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
        <p className="text-sm text-gray-500 mb-4">
          {[activity.area, activity.equipment].filter(Boolean).join(" · ") || "Sin area/equipo"}
        </p>

        <p className="text-sm font-medium text-gray-700 mb-2">Estado</p>
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
      </div>
    </div>
  );
}
