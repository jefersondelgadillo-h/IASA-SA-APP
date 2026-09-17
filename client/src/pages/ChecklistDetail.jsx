import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import Logo from "../components/Logo.jsx";
import BackButton from "../components/BackButton.jsx";

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return dateStr;
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function ChecklistDetail() {
  const { id, reportId } = useParams();
  const [laminador, setLaminador] = useState(null);
  const [report, setReport] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([api.getLaminadores(), api.getLaminadorChecklistDetail(id, reportId)])
      .then(([laminadores, data]) => {
        setLaminador(laminadores.find((l) => String(l.id) === String(id)) || null);
        setReport(data.report);
        setItems(data.items);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, reportId]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!map.has(it.sub_sistema)) map.set(it.sub_sistema, []);
      map.get(it.sub_sistema).push(it);
    }
    return [...map.entries()];
  }, [items]);

  const okCount = items.filter((it) => it.estado === "OK").length;
  const malCount = items.filter((it) => it.estado === "MAL").length;

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <header className="bg-iasa-blue text-white px-4 py-4 flex items-center gap-2.5">
        <BackButton to={`/laminadores/${id}`} />
        <div className="bg-white rounded-lg px-2 py-1 shrink-0">
          <Logo className="h-6" fallbackClassName="text-iasa-blue font-bold text-xs" />
        </div>
        <div>
          <p className="font-bold">{laminador?.name || "Laminador"}</p>
          <p className="text-xs text-white/80">
            Checklist de componentes {report ? formatDate(report.report_date) : ""}
          </p>
        </div>
      </header>

      <main className="px-4 mt-4 space-y-4">
        {loading && <p className="text-center text-gray-500 mt-10">Cargando...</p>}
        {error && <p className="text-center text-red-600 mt-10">{error}</p>}

        {!loading && !error && report && (
          <>
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">👤 {report.performed_by}</p>
                  <p className="text-xs text-gray-400">{formatDate(report.report_date)}</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs bg-green-100 text-green-800 rounded-full px-2.5 py-1">
                    ✅ {okCount}
                  </span>
                  <span className="text-xs bg-red-100 text-red-800 rounded-full px-2.5 py-1">⚠️ {malCount}</span>
                </div>
              </div>
            </section>

            {grouped.map(([subSistema, subItems]) => (
              <section key={subSistema}>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">{subSistema}</h2>
                <div className="space-y-3">
                  {subItems.map((it) => (
                    <div
                      key={it.checklist_item_id}
                      className={`bg-white rounded-2xl shadow-sm border p-4 ${
                        it.estado === "MAL" ? "border-red-200 bg-red-50/40" : "border-gray-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 leading-snug">{it.componente}</p>
                        {it.estado ? (
                          <span
                            className={`text-xs font-semibold rounded-full px-2.5 py-1 whitespace-nowrap ${
                              it.estado === "OK" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {it.estado}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-gray-100 text-gray-500 whitespace-nowrap">
                            Sin revisar
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{it.accion}</p>
                      {it.comentario && (
                        <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded-lg p-2">💬 {it.comentario}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
