import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import Logo from "../components/Logo.jsx";
import { RODILLOS } from "../lib/rodillo.js";

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return dateStr;
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function RodilloMeasurementForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [laminador, setLaminador] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rodillo, setRodillo] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [hora, setHora] = useState("");
  const [points, setPoints] = useState(Array(10).fill(null));
  const [ejecutadoPor, setEjecutadoPor] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    Promise.all([api.getLaminadores(), api.getRodilloReports(id)])
      .then(([laminadores, rodilloData]) => {
        setLaminador(laminadores.find((l) => String(l.id) === String(id)) || null);
        setReports(rodilloData.reports);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const openReport = rodillo
    ? reports.find((r) => r.rodillo === rodillo && r.antes_fecha && !r.despues_fecha)
    : null;
  const estado = openReport ? "despues" : "antes";
  const answeredCount = points.filter((p) => p !== null).length;

  function setPoint(index, value) {
    setPoints((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  async function handleSubmit() {
    setSaveError("");
    if (!rodillo) {
      setSaveError("Elige que rodillo se midio.");
      return;
    }
    if (!hora.trim()) {
      setSaveError("Escribe la hora de la medicion.");
      return;
    }
    if (!ejecutadoPor.trim()) {
      setSaveError("Escribe quien realizo la medicion.");
      return;
    }
    if (points.some((p) => p === null)) {
      setSaveError("Faltan lecturas: registra los 10 puntos.");
      return;
    }
    setSaving(true);
    try {
      await api.addRodilloReport(id, {
        rodillo,
        estado,
        fecha,
        hora: hora.trim(),
        points,
        ejecutado_por: ejecutadoPor.trim(),
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
        <div className="bg-white rounded-lg px-2 py-1 shrink-0">
          <Logo className="h-6" fallbackClassName="text-iasa-blue font-bold text-xs" />
        </div>
        <div>
          <p className="font-bold">{laminador?.name || "Laminador"}</p>
          <p className="text-xs text-white/80">
            Medicion de rodillos (galga 0,05 mm) {rodillo && `· ${answeredCount}/10`}
          </p>
        </div>
      </header>

      <main className="px-4 mt-4 space-y-4">
        {loading && <p className="text-center text-gray-500 mt-10">Cargando...</p>}
        {error && <p className="text-center text-red-600 mt-10">{error}</p>}

        {!loading && !error && (
          <>
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Que rodillo se midio</p>
              <div className="grid grid-cols-2 gap-2 mb-1">
                {RODILLOS.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRodillo(r.key)}
                    className={`rounded-xl border-2 py-2.5 px-2 text-sm font-semibold transition ${
                      rodillo === r.key ? "border-iasa-blue bg-iasa-blue/5" : "border-gray-200 text-gray-500"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </section>

            {rodillo && (
              <>
                <div
                  className={`rounded-2xl p-3 text-sm ${
                    openReport ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-blue-50 text-blue-800 border border-blue-200"
                  }`}
                >
                  {openReport ? (
                    <>
                      ⏳ Hay una medicion <strong>antes de rectificar</strong> del{" "}
                      <strong>{formatDate(openReport.antes_fecha)}</strong> pendiente para este rodillo. Vas a
                      registrar <strong>despues de rectificar</strong> para completar ese mismo registro.
                    </>
                  ) : (
                    <>
                      Vas a registrar la medicion <strong>antes de rectificar</strong> para este rodillo. Cuando se
                      rectifique, vuelve a esta pantalla para registrar "despues de rectificar" y completar el
                      registro.
                    </>
                  )}
                </div>

                <section className="bg-white rounded-2xl shadow-sm p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-3"
                  />

                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-3"
                  />

                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable</label>
                  <input
                    value={ejecutadoPor}
                    onChange={(e) => setEjecutadoPor(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm"
                  />
                </section>

                <section className="bg-white rounded-2xl shadow-sm p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Lecturas de la galga [0,05 mm]</p>
                  <p className="text-xs text-gray-500 mb-3">
                    Punto 1: a 5 pulgadas del extremo izquierdo del rolo. Distancia entre puntos: 5 pulgadas.
                  </p>
                  <div className="space-y-2">
                    {points.map((value, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700 w-16 shrink-0">Punto {i + 1}</span>
                        <button
                          onClick={() => setPoint(i, 1)}
                          className={`flex-1 rounded-full py-2 text-sm font-semibold border-2 transition ${
                            value === 1 ? "bg-green-600 border-green-600 text-white" : "border-gray-200 text-gray-500"
                          }`}
                        >
                          Pasa
                        </button>
                        <button
                          onClick={() => setPoint(i, 0)}
                          className={`flex-1 rounded-full py-2 text-sm font-semibold border-2 transition ${
                            value === 0 ? "bg-red-600 border-red-600 text-white" : "border-gray-200 text-gray-500"
                          }`}
                        >
                          No pasa
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            <Link to={`/laminadores/${id}`} className="block text-center text-xs text-gray-400 underline pt-2">
              Cancelar y volver
            </Link>
          </>
        )}
      </main>

      {!loading && !error && rodillo && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          {saveError && <p className="text-sm text-red-600 mb-2 text-center">{saveError}</p>}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-iasa-blue text-white font-semibold rounded-xl py-3 disabled:opacity-60"
          >
            {saving ? "Enviando..." : `Enviar medicion (${estado === "antes" ? "antes" : "despues"} de rectificar)`}
          </button>
        </div>
      )}
    </div>
  );
}
