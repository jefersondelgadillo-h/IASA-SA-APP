export default function EmptyState({ icon = "🗒️", title, message }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-3xl mb-2" aria-hidden="true">
        {icon}
      </div>
      {title && <p className="font-semibold text-gray-600">{title}</p>}
      {message && <p className="text-sm text-gray-400 mt-1">{message}</p>}
    </div>
  );
}
