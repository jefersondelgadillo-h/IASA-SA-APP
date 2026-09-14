export default function IndicatorCard({ label, value, meta, lowerIsBetter = false, previousValue }) {
  const hasValue = value !== null && value !== undefined;
  const meetsGoal = hasValue && (lowerIsBetter ? value <= meta : value >= meta);
  const hasPrev = hasValue && previousValue !== null && previousValue !== undefined;
  const delta = hasPrev ? value - previousValue : null;
  const improved = hasPrev && (lowerIsBetter ? delta < 0 : delta > 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex-1 min-w-[150px]">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide leading-tight mb-1">{label}</p>
      {hasValue ? (
        <>
          <p className={`text-3xl font-extrabold leading-none ${meetsGoal ? "text-green-600" : "text-red-600"}`}>
            {value.toFixed(1)}%
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            Meta: {meta}% {meetsGoal ? "✅" : "⚠️"}
          </p>
          {hasPrev && Math.abs(delta) >= 0.05 && (
            <p className={`text-[11px] mt-0.5 ${improved ? "text-green-600" : "text-amber-600"}`}>
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} vs semana pasada
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-400 mt-2">Sin dato todavia</p>
      )}
    </div>
  );
}
