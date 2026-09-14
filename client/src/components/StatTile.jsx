const TONES = {
  default: "text-gray-900",
  green: "text-green-700",
  red: "text-red-600",
  amber: "text-amber-600",
  blue: "text-iasa-blue",
};

export default function StatTile({ label, value, tone = "default" }) {
  return (
    <div className="bg-gray-50 rounded-xl px-2 py-3 text-center">
      <p className={`text-2xl font-extrabold leading-none ${TONES[tone] || TONES.default}`}>{value}</p>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}
