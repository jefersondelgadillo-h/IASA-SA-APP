const BAR_TONES = {
  default: "bg-iasa-blue",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gray: "bg-gray-400",
};

export default function ProgressBar({ label, value, total, tone = "default" }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span className="font-semibold text-gray-800">
          {pct}% <span className="text-gray-400 font-normal">({value})</span>
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${BAR_TONES[tone] || BAR_TONES.default}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
