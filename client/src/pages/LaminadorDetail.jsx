import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import Logo from "../components/Logo.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { rodilloRowLabel } from "../lib/rodillo.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ResetForm({ laminadorId, onSaved, onCancel }) {
  const [resetDate, setResetDate] = useState(todayISO());
  const [hoursBefore, setHoursBefore] = useState("");
  const [reason, setReason] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    if (!performedBy.trim()) {
      setError("Escribe quien realizo el reseteo.");
      return;
    }
    if (hoursBefore === "" || Number.isNaN(Number(hoursBefore))) {
      setError("Escribe las horas acumuladas antes del reseteo.");
      return;
    }
    setSaving(true);
    try {
      await onSaved({
        reset_date: resetDate,
        hours_before: hoursBefore,
        reason: reason.trim(),
        performed_by: performedBy.trim(),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Registrar reseteo</h2>
          <button onClick={onCancel} className="text-gray-400 text-2xl leading-none px-1" aria-label="Cerrar">
            &times;
          </button>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del reseteo</label>
        <input
          type="date"
          value={resetDate}
          onChange={(e) => setResetDate(e.target.value)}
          className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-3"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Horas acumuladas antes del reseteo</label>
        <input
          type="number"
          step="0.01"
          value={hoursBefore}
          onChange={(e) => setHoursBefore(e.target.value)}
          placeholder="ej. 9999"
          className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-3"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Ej: horometro llego al maximo de digitos, cambio de pieza, etc."
          className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-3"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
        <input
          value={performedBy}
          onChange={(e) => setPerformedBy(e.target.value)}
          placeholder="Tu nombre"
          className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-2"
        />

        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-iasa-blue text-white font-semibold rounded-xl py-3 mt-2 disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar reseteo"}
        </button>
      </div>
    </div>
  );
}

export default function LaminadorDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState("checklist");

  const [laminador, setLaminador] = useState(null);
  const [resets, setResets] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [rodilloReports, setRodilloReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [resetsData, checklistsData, rodilloData] = await Promise.all([
        api.getLaminadorResets(id),
        api.getLaminadorChecklists(id),
        api.getRodilloReports(id),
      ]);
      setLaminador(resetsData.laminador);
      setResets(resetsData.resets);
      setChecklists(checklistsData.reports);
      setRodilloReports(rodilloData.reports);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSaved(body) {
    const created = await api.addLaminadorReset(id, body);
    setResets((prev) => [created, ...prev]);
    setShowForm(false);
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <header className="bg-iasa-blue text-white px-4 py-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="bg-white rounded-lg px-2 py-1 shrink-0">
            <Logo className="h-6" fallbackClassName="text-iasa-blue font-bold text-xs" />
          </div>
          <div>
            <p className="font-bold">{laminador?.name || "Laminador"}</p>
            <p className="text-xs text-white/80">Checklist y horometro</p>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setTab("checklist")}
            className={`shrink-0 text-xs font-medium rounded-full px-3 py-1.5 whitespace-nowrap ${
              tab === "checklist" ? "bg-white text-iasa-blue" : "bg-white/15 text-white"
            }`}
          >
            📋 Checklist diario
          </button>
          <button
            onClick={() => setTab("rodillos")}
            className={`shrink-0 text-xs font-medium rounded-full px-3 py-1.5 whitespace-nowrap ${
              tab === "rodillos" ? "bg-white text-iasa-blue" : "bg-white/15 text-white"
            }`}
          >
            📏 Medicion rodillos
          </button>
          <button
            onClick={() => setTab("resets")}
            className={`shrink-0 text-xs font-medium rounded-full px-3 py-1.5 whitespace-nowrap ${
              tab === "resets" ? "bg-white text-iasa-blue" : "bg-white/15 text-white"
            }`}
          >
            ⏱️ Reseteos horometro
          </button>
        </div>
      </header>

      <main className="px-4 mt-4 space-y-4">
        {loading && <p className="text-center text-gray-500 mt-10">Cargando...</p>}
        {error && <p className="text-center text-red-600 mt-10">{error}</p>}

        {!loading && !error && tab === "checklist" && (
          <>
            <Link
              to={`/laminadores/${id}/checklist`}
              className="block w-full text-center bg-iasa-blue text-white font-semibold rounded-xl py-3"
            >
              + Llenar checklist de hoy
            </Link>

            {checklists.length === 0 && (
              <EmptyState
                icon="📋"
                title="Todavia no hay checklists registrados"
                message="Usa el boton de arriba para llenar el primero."
              />
            )}

            <div className="space-y-3">
              {checklists.map((c) => (
                <Link
                  key={c.id}
                  to={`/laminadores/${id}/checklist/${c.id}`}
                  className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:scale-[0.99] transition"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-gray-900">{c.report_date}</p>
                    <div className="flex gap-1.5">
                      <span className="text-xs bg-green-100 text-green-800 rounded-full px-2 py-0.5">
                        ✅ {c.ok_count}
                      </span>
                      {c.mal_count > 0 && (
                        <span className="text-xs bg-red-100 text-red-800 rounded-full px-2 py-0.5">
                          ⚠️ {c.mal_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">👤 {c.performed_by}</p>
                </Link>
              ))}
            </div>
          </>
        )}

        {!loading && !error && tab === "rodillos" && (
          <>
            <Link
              to={`/laminadores/${id}/rodillos/nuevo`}
              className="block w-full text-center bg-iasa-blue text-white font-semibold rounded-xl py-3"
            >
              + Registrar medicion
            </Link>

            {rodilloReports.length === 0 && (
              <EmptyState
                icon="📏"
                title="Todavia no hay mediciones registradas"
                message="Usa el boton de arriba para registrar la primera."
              />
            )}

            <div className="space-y-3">
              {rodilloReports.map((r) => {
                const failCount = Array.from({ length: 10 }, (_, i) => r[`point_${i + 1}`]).filter(
                  (p) => p === 0
                ).length;
                return (
                  <Link
                    key={r.id}
                    to={`/laminadores/${id}/rodillos/${r.id}`}
                    className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:scale-[0.99] transition"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="font-semibold text-gray-900">{r.fecha}</p>
                        <p className="text-xs text-gray-500">{rodilloRowLabel(r.row_key)}</p>
                      </div>
                      {failCount > 0 && (
                        <span className="text-xs bg-red-100 text-red-800 rounded-full px-2 py-0.5 whitespace-nowrap">
                          ⚠️ {failCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">👤 {r.ejecutado_por}</p>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {!loading && !error && tab === "resets" && (
          <>
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-iasa-blue text-white font-semibold rounded-xl py-3"
            >
              + Registrar reseteo
            </button>

            {resets.length === 0 && (
              <EmptyState
                icon="⚙️"
                title="Todavia no hay reseteos registrados"
                message="Usa el boton de arriba para registrar el primero."
              />
            )}

            <div className="space-y-3">
              {resets.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-gray-900">{r.reset_date}</p>
                    <span className="text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-1 whitespace-nowrap">
                      🕒 {r.hours_before} h
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">👤 {r.performed_by}</p>
                  {r.reason && (
                    <p className="text-xs text-gray-600 mt-2 bg-gray-50 rounded-lg p-2">💬 {r.reason}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-center gap-4 pt-4">
          <Link to="/laminadores" className="text-xs text-gray-400 underline">
            Otro laminador
          </Link>
          <Link to="/" className="text-xs text-gray-400 underline">
            Volver al inicio
          </Link>
        </div>
      </main>

      {showForm && <ResetForm laminadorId={id} onSaved={handleSaved} onCancel={() => setShowForm(false)} />}
    </div>
  );
}
