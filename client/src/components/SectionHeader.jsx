export default function SectionHeader({ icon, title, action }) {
  return (
    <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
      <h2 className="flex items-center gap-2 font-semibold text-gray-800">
        {icon && <span aria-hidden="true">{icon}</span>}
        <span className="uppercase text-sm tracking-wide">{title}</span>
      </h2>
      {action}
    </div>
  );
}
