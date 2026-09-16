import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import Logo from "../components/Logo.jsx";
import { RODILLO_ROWS } from "../lib/rodillo.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const TURNOS = ["Manana", "Tarde", "Noche"];

export default function RodilloMeasurementForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [laminador, setLaminador] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rowKey, setRowKey] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [hora, setHora] = useState("");
  const [turno, setTurno] = useState("");
  const [points, setPoints] = useState(Array(10).fill(null));
  const [ejecutadoPor, setEjecutadoPor] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    api
      .getLaminadores()
      .then((laminadores) => setLaminador(laminadores.find((l) => String(l.id) === String(id)) || null))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const selectedRow = RODILLO_ROWS.find((r) => r.key === rowKey);
  const answeredCount = points.filter((p) => p !== null).length;

  function setPoint(index, value) {
    setPoints((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  async function handleSubmit() {
    setSaveError("");
    if (!rowKey) {
      setSaveError("Elige que rodillo y estado se midio.");
      return;
    }
    if (selectedRow.field === "hora" && !hora.trim()) {
      setSaveError("Escribe la hora de la medicion.");
      return;
    }
    if (selectedRow.field === "turno" && !turno) {
      setSaveError("Elige el turno de la medicion.");
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
        row_key: rowKey,
        fecha,
        hora: selectedRow.field === "hora" ? hora.trim() : "",
        turno: selectedRow.field === "turno" ? turno : "",
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
            Medicion de rodillos (galga 0,05 mm) {rowKey && `· ${answeredCount}/10`}
          </p>
        </div>
      </header>

      <main className="px-4 mt-4 space-y-4">
        {loading && <p className="text-center text-gray-500 mt-10">Cargando...</p>}
        {error && <p className="text-center text-red-600 mt-10">{error}</p>}

        {!loading && !error && (
          <>
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Que se midio</p>
              <div className="grid grid-cols-2 gap-2 mb-1">
                {RODILLO_ROWS.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRowKey(r.key)}
                    className={`rounded-xl border-2 py-2.5 px-2 text-xs font-medium text-left transition ${
                      rowKey === r.key ? "border-iasa-blue bg-iasa-blue/5" : "border-gray-200 text-gray-500"
                    }`}
                  >
                    <p className="font-semibold text-gray-900">{r.group}</p>
                    <p>{r.estado}</p>
                  </button>
                ))}
              </div>
            </section>

            {rowKey && (
              <>
                <section className="bg-white rounded-2xl shadow-sm p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-3"
                  />

                  {selectedRow.field === "hora" ? (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                      <input
                        type="time"
                        value={hora}
                        onChange={(e) => setHora(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-3"
                      />
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
                      <div className="flex gap-2 mb-3">
                        {TURNOS.map((t) => (
                          <button
                            key={t}
                            onClick={() => setTurno(t)}
                            className={`flex-1 rounded-xl border-2 py-2 text-sm font-medium ${
                              turno === t ? "border-iasa-blue bg-iasa-blue/5 text-iasa-blue" : "border-gray-200 text-gray-500"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

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

      {!loading && !error && rowKey && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          {saveError && <p className="text-sm text-red-600 mb-2 text-center">{saveError}</p>}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-iasa-blue text-white font-semibold rounded-xl py-3 disabled:opacity-60"
          >
            {saving ? "Enviando..." : "Enviar medicion"}
          </button>
        </div>
      )}
    </div>
  );
}
