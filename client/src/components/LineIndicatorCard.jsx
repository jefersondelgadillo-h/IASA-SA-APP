function Line({ label, value, meta, lowerIsBetter }) {
  const hasValue = value !== null && value !== undefined;
  const meetsGoal = hasValue && (lowerIsBetter ? value <= meta : value >= meta);

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      {hasValue ? (
        <span className={`text-sm font-bold ${meetsGoal ? "text-green-600" : "text-red-600"}`}>
          {value.toFixed(1)}% {meetsGoal ? "✅" : "⚠️"}
        </span>
      ) : (
        <span className="text-xs text-gray-400">Sin dato</span>
      )}
    </div>
  );
}

export default function LineIndicatorCard({ label, meta, crownValue, tecnalValue, lowerIsBetter = false }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex-1 min-w-[160px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
        <span className="text-[10px] text-gray-400 whitespace-nowrap">Meta: {meta}%</span>
      </div>
      <div className="space-y-1.5">
        <Line label="Crown" value={crownValue} meta={meta} lowerIsBetter={lowerIsBetter} />
        <Line label="Tecnal" value={tecnalValue} meta={meta} lowerIsBetter={lowerIsBetter} />
      </div>
    </div>
  );
}
