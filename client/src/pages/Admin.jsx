import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { getAdminPassword, setAdminPassword, clearAdminPassword } from "../lib/session.js";
import StatusBadge from "../components/StatusBadge.jsx";

function nextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7; // proxima semana; si hoy es lunes, ofrece el lunes siguiente
  const monday = day === 1 ? d : new Date(d.setDate(d.getDate() + diff));
  if (day === 1) return d.toISOString().slice(0, 10);
  return monday.toISOString().slice(0, 10);
}

export default function Admin() {
  const [password, setPassword] = useState(getAdminPassword() || "");
  const [authed, setAuthed] = useState(!!getAdminPassword());
  const [loginError, setLoginError] = useState("");

  const [weekStart, setWeekStart] = useState(nextMonday());
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadErr, setUploadErr] = useState("");

  const [dashboard, setDashboard] = useState(null);
  const [dashError, setDashError] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  async function handleLogin() {
    setLoginError("");
    try {
      await api.adminLogin(password);
      setAdminPassword(password);
      setAuthed(true);
    } catch (err) {
      setLoginError(err.message);
    }
  }

  function handleLogout() {
    clearAdminPassword();
    setAuthed(false);
    setPassword("");
  }

  async function loadDashboard() {
    setDashError("");
    try {
      const data = await api.adminDashboard(getAdminPassword());
      setDashboard(data);
    } catch (err) {
      setDashError(err.message);
    }
  }

  useEffect(() => {
    if (authed) loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    setUploadErr("");
    try {
      const res = await api.adminUpload(getAdminPassword(), file, weekStart);
      setUploadMsg(`Cargado: ${res.activities_loaded} actividades para la semana ${res.week_start}.`);
      setFile(null);
      loadDashboard();
    } catch (err) {
      setUploadErr(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
          <h1 className="text-lg font-bold mb-4">Panel de administracion</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Clave de administrador"
            className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-3"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {loginError && <p className="text-sm text-red-600 mb-3">{loginError}</p>}
          <button onClick={handleLogin} className="w-full bg-iasa-blue text-white font-semibold rounded-xl py-3">
            Entrar
          </button>
          <Link to="/" className="block text-center text-xs text-gray-400 underline mt-4">
            Volver a la programacion
          </Link>
        </div>
      </div>
    );
  }

  const activities =
    dashboard?.activities.filter((a) => statusFilter === "Todos" || a.status === statusFilter) || [];

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <header className="bg-iasa-blue text-white px-4 py-4 flex items-center justify-between">
        <div>
          <p className="font-bold">Panel de administracion</p>
          <p className="text-xs text-white/80">IASA SA · Planta Don Felipe</p>
        </div>
        <div className="flex gap-2">
          <Link to="/" className="text-xs bg-white/15 rounded-full px-3 py-1.5">
            Ver programacion
          </Link>
          <button onClick={handleLogout} className="text-xs bg-white/15 rounded-full px-3 py-1.5">
            Salir
          </button>
        </div>
      </header>

      <main className="px-4 mt-4 space-y-6">
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold mb-3">Cargar programacion semanal (Excel)</h2>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Inicio de semana (lunes)</label>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Archivo .xlsx</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full bg-iasa-blue text-white font-semibold rounded-xl py-2.5 disabled:opacity-50"
            >
              {uploading ? "Cargando..." : "Cargar archivo"}
            </button>
            {uploadMsg && <p className="text-sm text-green-700">{uploadMsg}</p>}
            {uploadErr && <p className="text-sm text-red-600">{uploadErr}</p>}
          </form>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Tablero de la semana {dashboard?.week || ""}</h2>
            <button onClick={loadDashboard} className="text-xs text-iasa-blue underline">
              Actualizar
            </button>
          </div>

          {dashError && <p className="text-sm text-red-600 mb-2">{dashError}</p>}

          {dashboard && (
            <div className="flex flex-wrap gap-2 mb-4">
              {["Pendiente", "En progreso", "Completado", "Con problema"].map((s) => (
                <span key={s} className="text-xs bg-gray-100 rounded-full px-3 py-1">
                  {s}: <strong>{dashboard.stats[s] || 0}</strong>
                </span>
              ))}
              <span className="text-xs bg-gray-100 rounded-full px-3 py-1">
                Total: <strong>{dashboard.stats.total || 0}</strong>
              </span>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
            {["Todos", "Pendiente", "En progreso", "Completado", "Con problema"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`whitespace-nowrap text-xs font-medium rounded-full px-3 py-1.5 border ${
                  statusFilter === s ? "bg-iasa-blue text-white border-iasa-blue" : "border-gray-200 text-gray-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Actividad</th>
                  <th className="py-2 pr-3">Area / Equipo</th>
                  <th className="py-2 pr-3">Responsable</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Comentario</th>
                  <th className="py-2 pr-3">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{a.activity_date || "-"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{a.activity_type === "Mecanico" ? "Mecanico" : "Electrico"}</td>
                    <td className="py-2 pr-3">{a.description}</td>
                    <td className="py-2 pr-3">{[a.area, a.equipment].filter(Boolean).join(" · ")}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{a.assigned_to || "-"}</td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-2 pr-3 max-w-[220px]">{a.status_comment || ""}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-xs text-gray-500">
                      {a.status_updated_by ? `${a.status_updated_by}` : ""}
                      <br />
                      {a.status_updated_at ? new Date(a.status_updated_at).toLocaleString() : ""}
                    </td>
                  </tr>
                ))}
                {activities.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-400">
                      No hay actividades para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
