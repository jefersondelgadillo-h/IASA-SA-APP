import StatusBadge from "./StatusBadge.jsx";

const ACCENT_BY_STATUS = {
  Pendiente: "border-l-gray-300",
  "En progreso": "border-l-amber-400",
  Completado: "border-l-green-400",
  "Con problema": "border-l-red-400",
};

export default function ActivityCard({ activity, onClick }) {
  const assignedLabel = (activity.resolved_names || []).join(", ") || activity.assigned_to || "Sin asignar";
  const hasProblem = activity.status === "Con problema";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-4 shadow-sm border border-l-4 active:scale-[0.99] transition ${
        ACCENT_BY_STATUS[activity.status] || "border-l-gray-300"
      } ${hasProblem ? "bg-red-50/60 border-red-100" : "bg-white border-gray-100"}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-gray-900 leading-snug">{activity.description}</h3>
        <StatusBadge status={activity.status} />
      </div>
      <p className="text-sm text-gray-500">
        {[activity.area, activity.equipment].filter(Boolean).join(" · ") || "Sin area/equipo"}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
        <span>👤 {assignedLabel}</span>
        {activity.planned_hours != null && <span>🕒 {activity.planned_hours}h</span>}
        {activity.order_number && <span>#{activity.order_number}</span>}
      </div>
      {activity.status_comment && (
        <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded-lg p-2">💬 {activity.status_comment}</p>
      )}
    </button>
  );
}
