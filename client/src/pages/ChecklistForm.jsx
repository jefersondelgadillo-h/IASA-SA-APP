import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import Logo from "../components/Logo.jsx";
import BackButton from "../components/BackButton.jsx";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ChecklistForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [laminador, setLaminador] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reportDate, setReportDate] = useState(todayISO());
  const [performedBy, setPerformedBy] = useState("");
  const [answers, setAnswers] = useState({}); // { [itemId]: { estado, comentario } }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([api.getLaminadores(), api.getChecklistItems()])
      .then(([laminadores, checklistItems]) => {
        setLaminador(laminadores.find((l) => String(l.id) === String(id)) || null);
        setItems(checklistItems);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      if (!map.has(it.sub_sistema)) map.set(it.sub_sistema, []);
      map.get(it.sub_sistema).push(it);
    }
    return [...map.entries()];
  }, [items]);

  function setAnswer(itemId, patch) {
    setAnswers((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }

  const answeredCount = items.filter((it) => answers[it.id]?.estado).length;

  async function handleSubmit() {
    setSaveError("");
    if (!performedBy.trim()) {
      setSaveError("Escribe quien lleno el checklist.");
      return;
    }
    setSaving(true);
    try {
      await api.addLaminadorChecklist(id, {
        report_date: reportDate,
        performed_by: performedBy.trim(),
        items: items.map((it) => ({
          checklist_item_id: it.id,
          estado: answers[it.id]?.estado || null,
          comentario: answers[it.id]?.comentario || "",
        })),
      });
      navigate(`/laminadores/${id}`);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-28">
      <header className="bg-iasa-blue text-white px-4 py-4 flex items-center gap-2.5 sticky top-0 z-10 shadow">
        <BackButton to={`/laminadores/${id}`} />
        <div className="bg-white rounded-lg px-2 py-1 shrink-0">
          <Logo className="h-6" fallbackClassName="text-iasa-blue font-bold text-xs" />
        </div>
        <div>
          <p className="font-bold">{laminador?.name || "Laminador"}</p>
          <p className="text-xs text-white/80">
            Checklist de componentes {items.length > 0 && `· ${answeredCount}/${items.length}`}
          </p>
        </div>
      </header>

      <main className="px-4 mt-4 space-y-4">
        {loading && <p className="text-center text-gray-500 mt-10">Cargando checklist...</p>}
        {error && <p className="text-center text-red-600 mt-10">{error}</p>}

        {!loading && !error && (
          <>
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-3"
              />
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
              <input
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                placeholder="Tu nombre"
                className="w-full border border-gray-300 rounded-xl p-3 text-sm"
              />
            </section>

            {grouped.map(([subSistema, subItems]) => (
              <section key={subSistema}>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">{subSistema}</h2>
                <div className="space-y-3">
                  {subItems.map((it) => {
                    const answer = answers[it.id] || {};
                    return (
                      <div key={it.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <p className="font-semibold text-gray-900 leading-snug">{it.componente}</p>
                        <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{it.accion}</p>
                        <div className="flex gap-2 mt-3 mb-2">
                          <button
                            onClick={() => setAnswer(it.id, { estado: "OK" })}
                            className={`flex-1 rounded-full py-2 text-sm font-semibold border-2 transition ${
                              answer.estado === "OK"
                                ? "bg-green-600 border-green-600 text-white"
                                : "border-gray-200 text-gray-500"
                            }`}
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setAnswer(it.id, { estado: "MAL" })}
                            className={`flex-1 rounded-full py-2 text-sm font-semibold border-2 transition ${
                              answer.estado === "MAL"
                                ? "bg-red-600 border-red-600 text-white"
                                : "border-gray-200 text-gray-500"
                            }`}
                          >
                            MAL
                          </button>
                        </div>
                        <input
                          value={answer.comentario || ""}
                          onChange={(e) => setAnswer(it.id, { comentario: e.target.value })}
                          placeholder="Comentario (opcional)"
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </main>

      {!loading && !error && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          {saveError && <p className="text-sm text-red-600 mb-2 text-center">{saveError}</p>}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-iasa-blue text-white font-semibold rounded-xl py-3 disabled:opacity-60"
          >
            {saving ? "Enviando..." : "Enviar checklist"}
          </button>
        </div>
      )}
    </div>
  );
}
