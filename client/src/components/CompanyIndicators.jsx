import IndicatorCard from "./IndicatorCard.jsx";
import SectionHeader from "./SectionHeader.jsx";

export default function CompanyIndicators({ indicators }) {
  if (!indicators) return null;

  return (
    <section className="bg-white rounded-2xl shadow-sm p-4">
      <SectionHeader icon="📈" title="Indicadores de la semana" />
      <div className="flex flex-wrap gap-2">
        <IndicatorCard label="Programa semanal" value={indicators.programa_semanal.value} meta={indicators.programa_semanal.meta} />
        <IndicatorCard
          label="Fallas de equipos"
          value={indicators.fallas_equipos.value}
          meta={indicators.fallas_equipos.meta}
          lowerIsBetter
        />
        <IndicatorCard
          label="Cumpl. prog. anual"
          value={indicators.cumplimiento_anual.value}
          meta={indicators.cumplimiento_anual.meta}
        />
      </div>
      {indicators.updated_at && (
        <p className="text-[11px] text-gray-400 mt-3">
          Fallas de equipos y cumplimiento anual actualizados el {new Date(indicators.updated_at).toLocaleDateString()}
        </p>
      )}
    </section>
  );
}
