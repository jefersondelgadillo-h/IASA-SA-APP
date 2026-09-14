import LineIndicatorCard from "./LineIndicatorCard.jsx";
import SectionHeader from "./SectionHeader.jsx";

export default function CompanyIndicators({ indicators }) {
  if (!indicators) return null;

  return (
    <section className="bg-white rounded-2xl shadow-sm p-4">
      <SectionHeader icon="📈" title="Indicadores de la semana" />
      <div className="flex flex-wrap gap-2">
        <LineIndicatorCard
          label="Fallas de equipos"
          meta={indicators.fallas_equipos.meta}
          crownValue={indicators.fallas_equipos.crown}
          tecnalValue={indicators.fallas_equipos.tecnal}
          lowerIsBetter
        />
        <LineIndicatorCard
          label="Cumpl. prog. anual"
          meta={indicators.cumplimiento_anual.meta}
          crownValue={indicators.cumplimiento_anual.crown}
          tecnalValue={indicators.cumplimiento_anual.tecnal}
        />
      </div>
      {indicators.updated_at && (
        <p className="text-[11px] text-gray-400 mt-3">
          Actualizado el {new Date(indicators.updated_at).toLocaleDateString()}
        </p>
      )}
    </section>
  );
}
