import StatusBadge from "./StatusBadge.jsx";

export default function ActivityCard({ activity, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-gray-900 leading-snug">{activity.description}</h3>
        <StatusBadge status={activity.status} />
      </div>
      <p className="text-sm text-gray-500">
        {[activity.area, activity.equipment].filter(Boolean).join(" · ") || "Sin area/equipo"}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
        {activity.assigned_to && <span>👤 {activity.assigned_to}</span>}
        {activity.shift && <span>🕒 {activity.shift}</span>}
        {activity.priority && <span>⚑ {activity.priority}</span>}
      </div>
      {activity.status_comment && (
        <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded-lg p-2">💬 {activity.status_comment}</p>
      )}
    </button>
  );
}
