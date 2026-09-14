export default function IndicatorCard({ label, value, meta, lowerIsBetter = false }) {
  const hasValue = value !== null && value !== undefined;
  const meetsGoal = hasValue && (lowerIsBetter ? value <= meta : value >= meta);

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
        </>
      ) : (
        <p className="text-sm text-gray-400 mt-2">Sin dato todavia</p>
      )}
    </div>
  );
}
