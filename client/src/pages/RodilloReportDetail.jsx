import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import Logo from "../components/Logo.jsx";
import { rodilloRowInfo } from "../lib/rodillo.js";
import { getAdminPassword, setAdminPassword } from "../lib/session.js";

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return dateStr;
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

const ADMIN_FIELDS = [
  { key: "orden_programada", label: "Orden programada", type: "text" },
  { key: "ultimo_cambio_rolos", label: "Ultimo cambio de rolos", type: "date" },
  { key: "ultimo_rectificado", label: "Ultimo rectificado", type: "date" },
  { key: "rectificador_usado", label: "Rectificador usado", type: "text" },
  { key: "conclusion", label: "Conclusion", type: "textarea" },
  { key: "comentario", label: "Comentario", type: "textarea" },
  { key: "revisado_por", label: "Revisado por", type: "text" },
];

export default function RodilloReportDetail() {
  const { id, reportId } = useParams();
  const [laminador, setLaminador] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [password, setPassword] = useState(getAdminPassword() || "");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    Promise.all([api.getLaminadores(), api.getRodilloReportDetail(id, reportId)])
      .then(([laminadores, data]) => {
        setLaminador(laminadores.find((l) => String(l.id) === String(id)) || null);
        setReport(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id, reportId]);

  const row = report ? rodilloRowInfo(report.row_key) : null;
  const points = report ? Array.from({ length: 10 }, (_, i) => report[`point_${i + 1}`]) : [];
  const failCount = points.filter((p) => p === 0).length;

  function startEditing() {
    setForm({
      orden_programada: report.orden_programada || "",
      ultimo_cambio_rolos: report.ultimo_cambio_rolos || "",
      ultimo_rectificado: report.ultimo_rectificado || "",
      rectificador_usado: report.rectificador_usado || "",
      conclusion: report.conclusion || "",
      comentario: report.comentario || "",
      revisado_por: report.revisado_por || "",
    });
    setSaveError("");
    setEditing(true);
  }

  async function handleSaveReview() {
    if (!password.trim()) {
      setSaveError("Escribe la clave de administrador.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const updated = await api.adminUpdateRodilloReport(password.trim(), id, reportId, form);
      setAdminPassword(password.trim());
      setReport(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const hasAdminData = report && ADMIN_FIELDS.some((f) => report[f.key]);

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <header className="bg-iasa-blue text-white px-4 py-4 flex items-center gap-2.5">
        <div className="bg-white rounded-lg px-2 py-1 shrink-0">
          <Logo className="h-6" fallbackClassName="text-iasa-blue font-bold text-xs" />
        </div>
        <div>
          <p className="font-bold">{laminador?.name || "Laminador"}</p>
          <p className="text-xs text-white/80">Medicion de rodillos {report ? formatDate(report.fecha) : ""}</p>
        </div>
      </header>

      <main className="px-4 mt-4 space-y-4">
        {loading && <p className="text-center text-gray-500 mt-10">Cargando...</p>}
        {error && <p className="text-center text-red-600 mt-10">{error}</p>}

        {!loading && !error && report && (
          <>
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <p className="font-semibold text-gray-900">{row?.group}</p>
                  <p className="text-sm text-gray-500">{row?.estado}</p>
                </div>
                {failCount > 0 && (
                  <span className="text-xs bg-red-100 text-red-800 rounded-full px-2.5 py-1 whitespace-nowrap">
                    ⚠️ {failCount} no pasa
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                📅 {formatDate(report.fecha)} {report.hora && `· 🕒 ${report.hora}`}
                {report.turno && `· ${report.turno}`}
              </p>
              <p className="text-sm text-gray-500">👤 Ejecutado por: {report.ejecutado_por}</p>
            </section>

            <section className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Lecturas de la galga [0,05 mm]</p>
              <p className="text-xs text-gray-500 mb-3">
                Punto 1: a 5 pulgadas del extremo izquierdo del rolo. Distancia entre puntos: 5 pulgadas.
              </p>
              <div className="grid grid-cols-5 gap-2">
                {points.map((value, i) => (
                  <div
                    key={i}
                    className={`rounded-xl py-3 text-center text-sm font-semibold ${
                      value === 1
                        ? "bg-green-100 text-green-800"
                        : value === 0
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wide opacity-70">P{i + 1}</p>
                    {value === 1 ? "0,05" : value === 0 ? "X" : "-"}
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">Revision de mantenimiento</p>
                {!editing && (
                  <span
                    className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                      hasAdminData ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {hasAdminData ? "Revisado" : "Pendiente"}
                  </span>
                )}
              </div>

              {!editing && (
                <div className="space-y-2 mb-3">
                  {ADMIN_FIELDS.map((f) => (
                    <div key={f.key} className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-500">{f.label}</span>
                      <span className="text-gray-900 text-right">{report[f.key] || "—"}</span>
                    </div>
                  ))}
                </div>
              )}

              {editing && (
                <div className="space-y-3 mb-3">
                  {ADMIN_FIELDS.map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                      {f.type === "textarea" ? (
                        <textarea
                          value={form[f.key]}
                          onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          rows={2}
                          className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
                        />
                      ) : (
                        <input
                          type={f.type}
                          value={form[f.key]}
                          onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
                        />
                      )}
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Clave de administrador</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
                    />
                  </div>
                </div>
              )}

              {saveError && <p className="text-sm text-red-600 mb-2">{saveError}</p>}

              {editing ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl py-2.5 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveReview}
                    disabled={saving}
                    className="flex-1 bg-iasa-blue text-white font-semibold rounded-xl py-2.5 text-sm disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Guardar revision"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditing}
                  className="w-full border-2 border-iasa-blue text-iasa-blue font-semibold rounded-xl py-2.5 text-sm"
                >
                  ✏️ Revisar como administrador
                </button>
              )}
            </section>

            <Link to={`/laminadores/${id}`} className="block text-center text-xs text-gray-400 underline pt-2">
              Volver al laminador
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
