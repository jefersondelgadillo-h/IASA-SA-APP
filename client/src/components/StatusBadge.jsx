const STYLES = {
  Pendiente: "bg-gray-200 text-gray-800",
  "En progreso": "bg-amber-100 text-amber-800",
  Completado: "bg-green-100 text-green-800",
  "Con problema": "bg-red-100 text-red-800",
};

export default function StatusBadge({ status, className = "" }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
        STYLES[status] || "bg-gray-200 text-gray-800"
      } ${className}`}
    >
      {status}
    </span>
  );
}
