import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { getAdminPassword, setAdminPassword, clearAdminPassword } from "../lib/session.js";
import StatusBadge from "../components/StatusBadge.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import StatTile from "../components/StatTile.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import EmptyState from "../components/EmptyState.jsx";
import CompanyIndicators from "../components/CompanyIndicators.jsx";
import Logo from "../components/Logo.jsx";

const STATUS_TONES = { Pendiente: "gray", "En progreso": "amber", Completado: "green", "Con problema": "red" };

function nextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7; // proxima semana; si hoy es lunes, ofrece el lunes siguiente
  const monday = day === 1 ? d : new Date(d.setDate(d.getDate() + diff));
  if (day === 1) return d.toISOString().slice(0, 10);
  return monday.toISOString().slice(0, 10);
}

function TechnicianRow({ technician, onSaved }) {
  const [name, setName] = useState(technician.name || "");
  const [role, setRole] = useState(technician.role || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const dirty = name !== (technician.name || "") || role !== (technician.role || "");
  const incomplete = !technician.name || !technician.role;

  async function handleSave() {
    setSaving(true);
    setErr("");
    try {
      await onSaved(technician.id, { name: name.trim(), role: role || null });
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className={`border-b last:border-0 ${incomplete ? "bg-amber-50" : ""}`}>
      <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">{technician.code}</td>
      <td className="py-2 pr-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre completo"
          className="w-full border border-gray-300 rounded-lg p-1.5 text-sm"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Sin definir"
          list="technician-roles"
          className="w-full border border-gray-300 rounded-lg p-1.5 text-sm"
        />
      </td>
      <td className="py-2 pr-3">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="text-xs bg-iasa-blue text-white rounded-full px-3 py-1.5 disabled:opacity-40"
        >
          {saving ? "..." : "Guardar"}
        </button>
        {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
      </td>
    </tr>
  );
}

function IndicatorsForm({ week, indicators, onSaved }) {
  const [fallasPct, setFallasPct] = useState(indicators.fallas_equipos.value ?? "");
  const [fallasMeta, setFallasMeta] = useState(indicators.fallas_equipos.meta ?? 3);
  const [cumplPct, setCumplPct] = useState(indicators.cumplimiento_anual.value ?? "");
  const [cumplMeta, setCumplMeta] = useState(indicators.cumplimiento_anual.meta ?? 90);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    setSaving(true);
    setErr("");
    setSaved(false);
    try {
      await onSaved({
        week,
        fallas_equipos_pct: fallasPct,
        fallas_equipos_meta: fallasMeta,
        cumplimiento_anual_pct: cumplPct,
        cumplimiento_anual_meta: cumplMeta,
      });
      setSaved(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">% Fallas de equipos</label>
        <div className="flex gap-1">
          <input
            type="number"
            step="0.01"
            value={fallasPct}
            onChange={(e) => setFallasPct(e.target.value)}
            placeholder="ej. 5.51"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            value={fallasMeta}
            onChange={(e) => setFallasMeta(e.target.value)}
            title="Meta"
            className="w-20 border border-gray-300 rounded-lg p-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">% Cumplimiento programa anual</label>
        <div className="flex gap-1">
          <input
            type="number"
            step="0.01"
            value={cumplPct}
            onChange={(e) => setCumplPct(e.target.value)}
            placeholder="ej. 89.49"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
          />
          <input
            type="number"
            step="0.01"
            value={cumplMeta}
            onChange={(e) => setCumplMeta(e.target.value)}
            title="Meta"
            className="w-20 border border-gray-300 rounded-lg p-2 text-sm"
          />
        </div>
      </div>
      <div className="col-span-2 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs bg-iasa-blue text-white rounded-full px-4 py-1.5 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar indicadores"}
        </button>
        {saved && <span className="text-xs text-green-700">Guardado ✓</span>}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
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
  const [newTechnicianCodes, setNewTechnicianCodes] = useState([]);

  const [dashboard, setDashboard] = useState(null);
  const [dashError, setDashError] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [weeksList, setWeeksList] = useState([]);
  const [dashboardWeek, setDashboardWeek] = useState(null);

  const [technicians, setTechnicians] = useState([]);
  const [techError, setTechError] = useState("");

  const [indicators, setIndicators] = useState(null);
  const [indicatorsError, setIndicatorsError] = useState("");

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const [deletingWeek, setDeletingWeek] = useState(false);
  const [confirmDeleteWeek, setConfirmDeleteWeek] = useState(false);
  const [deleteWeekError, setDeleteWeekError] = useState("");

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

  async function loadDashboard(week) {
    setDashError("");
    try {
      const data = await api.adminDashboard(getAdminPassword(), week);
      setDashboard(data);
      setDashboardWeek(data.week);
    } catch (err) {
      setDashError(err.message);
    }
  }

  async function loadWeeksList() {
    try {
      setWeeksList(await api.getWeeks());
    } catch {
      setWeeksList([]);
    }
  }

  async function loadTechnicians() {
    setTechError("");
    try {
      const data = await api.adminGetTechnicians(getAdminPassword());
      setTechnicians(data);
    } catch (err) {
      setTechError(err.message);
    }
  }

  async function loadIndicators(week) {
    setIndicatorsError("");
    try {
      setIndicators(await api.getIndicators(week));
    } catch (err) {
      setIndicatorsError(err.message);
    }
  }

  async function handleSaveIndicators(body) {
    await api.adminUpdateIndicators(getAdminPassword(), body);
    await loadIndicators(body.week);
  }

  // Cambia de semana en el tablero, sus indicadores manuales y el formulario
  // de carga de indicadores a la vez, para que todo quede consistente.
  function handleWeekChange(week) {
    loadDashboard(week);
    loadIndicators(week);
  }

  async function handleDeleteWeek() {
    if (!dashboardWeek) return;
    setDeletingWeek(true);
    setDeleteWeekError("");
    try {
      await api.adminDeleteWeek(getAdminPassword(), dashboardWeek);
      setConfirmDeleteWeek(false);
      const remaining = weeksList.filter((w) => w.week_start !== dashboardWeek);
      setWeeksList(remaining);
      const nextWeek = remaining[0]?.week_start;
      await loadDashboard(nextWeek);
      await loadIndicators(nextWeek);
    } catch (err) {
      setDeleteWeekError(err.message);
    } finally {
      setDeletingWeek(false);
    }
  }

  useEffect(() => {
    if (authed) {
      loadDashboard();
      loadTechnicians();
      loadIndicators();
      loadWeeksList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    setUploadErr("");
    setNewTechnicianCodes([]);
    try {
      const res = await api.adminUpload(getAdminPassword(), file, weekStart);
      setUploadMsg(`Cargado: ${res.activities_loaded} actividades para la semana ${res.week_start}.`);
      setNewTechnicianCodes(res.new_technicians || []);
      setFile(null);
      loadDashboard(res.week_start);
      loadIndicators(res.week_start);
      loadTechnicians();
      loadWeeksList();
    } catch (err) {
      setUploadErr(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleExport(format) {
    setExporting(true);
    setExportError("");
    try {
      const { blob, filename } = await api.adminExportHistory(getAdminPassword(), format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleSaveTechnician(id, body) {
    const updated = await api.adminUpdateTechnician(getAdminPassword(), id, body);
    setTechnicians((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
          <div className="flex justify-center mb-4">
            <Logo className="h-12" fallbackClassName="text-lg font-bold" />
          </div>
          <h1 className="text-lg font-bold mb-4 text-center">Panel de administracion</h1>
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
  const incompleteCount = technicians.filter((t) => !t.name || !t.role).length;

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <header className="bg-iasa-blue text-white px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-white rounded-lg px-2 py-1 shrink-0">
            <Logo className="h-6" fallbackClassName="text-iasa-blue font-bold text-xs" />
          </div>
          <div>
            <p className="font-bold">Panel de administracion</p>
            <p className="text-xs text-white/80">Planta Don Felipe</p>
          </div>
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
          <SectionHeader icon="📂" title="Cargar programacion semanal (Excel)" />
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
            {newTechnicianCodes.length > 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-2">
                Se detectaron {newTechnicianCodes.length} codigo(s) nuevo(s) sin nombre registrado:{" "}
                <strong>{newTechnicianCodes.join(", ")}</strong>. Completalos abajo en "Tecnicos" para que puedan
                iniciar sesion y para que sus actividades se clasifiquen correctamente.
              </p>
            )}
          </form>
        </section>

        {indicators && <CompanyIndicators indicators={indicators} />}

        <section className="bg-white rounded-2xl shadow-sm p-4">
          <SectionHeader icon="✍️" title="Cargar indicadores (Fallas de equipos / Cumpl. anual)" />
          <p className="text-xs text-gray-500 mb-3">
            El "Programa semanal" se calcula solo con los datos de esta app. Estos dos vienen de otro sistema (ej.
            SAP/avisos) — se cargan por semana, tomando el dato de tu reporte. Usa el selector de semana del tablero
            de abajo para elegir cual estas cargando/corrigiendo (ahora mismo:{" "}
            <strong>{dashboardWeek || "sin semana"}</strong>).
          </p>
          {indicatorsError && <p className="text-sm text-red-600 mb-2">{indicatorsError}</p>}
          {indicators && dashboardWeek && (
            <IndicatorsForm key={dashboardWeek} week={dashboardWeek} indicators={indicators} onSaved={handleSaveIndicators} />
          )}
          {!dashboardWeek && <p className="text-xs text-gray-400">Sube una semana primero para poder cargar sus indicadores.</p>}
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-4">
          <SectionHeader icon="📤" title="Exportar historial de cambios" />
          <p className="text-xs text-gray-500 mb-3">
            Descarga todos los cambios de estado registrados hasta ahora (todas las semanas cargadas), con fecha,
            actividad, responsable, estado anterior/nuevo y comentario — listo para analizar en Excel.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => handleExport("xlsx")}
              disabled={exporting}
              className="text-sm bg-iasa-blue text-white font-semibold rounded-xl px-4 py-2 disabled:opacity-50"
            >
              {exporting ? "Generando..." : "Exportar a Excel"}
            </button>
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="text-sm border border-iasa-blue text-iasa-blue font-semibold rounded-xl px-4 py-2 disabled:opacity-50"
            >
              {exporting ? "Generando..." : "Exportar a CSV"}
            </button>
          </div>
          {exportError && <p className="text-sm text-red-600 mt-2">{exportError}</p>}
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-4">
          <SectionHeader
            icon="📊"
            title="Tablero de mantenimiento"
            action={
              <button onClick={() => handleWeekChange(dashboardWeek)} className="text-xs text-iasa-blue underline">
                Actualizar
              </button>
            }
          />
          {weeksList.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              Semana
              <select
                value={dashboard?.week || ""}
                onChange={(e) => handleWeekChange(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
              >
                {weeksList.map((w) => (
                  <option key={w.week_start} value={w.week_start}>
                    {w.week_start}
                  </option>
                ))}
              </select>
            </label>
          )}
          {dashboard?.uploaded_at && (
            <p className="text-xs text-gray-400 mb-3">
              Cargado el {new Date(dashboard.uploaded_at).toLocaleString()}
            </p>
          )}

          {dashError && <p className="text-sm text-red-600 mb-2">{dashError}</p>}

          {dashboardWeek && (
            <div className="mb-4">
              {!confirmDeleteWeek ? (
                <button
                  onClick={() => setConfirmDeleteWeek(true)}
                  className="text-xs text-red-600 underline"
                >
                  🗑️ Eliminar la programacion de la semana {dashboardWeek}
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-800 font-medium mb-1">
                    ¿Eliminar por completo la semana {dashboardWeek}?
                  </p>
                  <p className="text-xs text-red-700 mb-2">
                    Se borran todas sus actividades, el historial de cambios y sus indicadores. No se puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteWeek}
                      disabled={deletingWeek}
                      className="text-xs bg-red-600 text-white rounded-full px-3 py-1.5 disabled:opacity-50"
                    >
                      {deletingWeek ? "Eliminando..." : "Si, eliminar"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteWeek(false)}
                      disabled={deletingWeek}
                      className="text-xs border border-gray-300 rounded-full px-3 py-1.5"
                    >
                      Cancelar
                    </button>
                  </div>
                  {deleteWeekError && <p className="text-xs text-red-600 mt-2">{deleteWeekError}</p>}
                </div>
              )}
            </div>
          )}

          {dashboard && dashboard.stats.total > 0 && (
            <>
              <div className="grid grid-cols-5 gap-2 mb-4">
                <StatTile label="Total" value={dashboard.stats.total || 0} tone="blue" />
                <StatTile label="Pendiente" value={dashboard.stats.Pendiente || 0} />
                <StatTile label="En progreso" value={dashboard.stats["En progreso"] || 0} tone="amber" />
                <StatTile label="Completado" value={dashboard.stats.Completado || 0} tone="green" />
                <StatTile
                  label="Con problema"
                  value={dashboard.stats["Con problema"] || 0}
                  tone={dashboard.stats["Con problema"] > 0 ? "red" : "default"}
                />
              </div>

              <div className="space-y-2 mb-4">
                {["Pendiente", "En progreso", "Completado", "Con problema"].map((s) => (
                  <ProgressBar
                    key={s}
                    label={s}
                    value={dashboard.stats[s] || 0}
                    total={dashboard.stats.total}
                    tone={STATUS_TONES[s]}
                  />
                ))}
              </div>

              {dashboard.stats["Sin clasificar"] > 0 && (
                <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2 mb-4">
                  ⚠️ {dashboard.stats["Sin clasificar"]} actividad(es) sin especialidad clasificada. Completa el rol
                  del tecnico correspondiente en la seccion "Tecnicos" de abajo.
                </p>
              )}
            </>
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
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Orden</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Actividad</th>
                  <th className="py-2 pr-3">Area / Equipo</th>
                  <th className="py-2 pr-3">Responsable</th>
                  <th className="py-2 pr-3">Horas</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Comentario</th>
                  <th className="py-2 pr-3">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{a.activity_date || "-"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-xs text-gray-500">{a.order_number || "-"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{a.activity_type || "Sin clasificar"}</td>
                    <td className="py-2 pr-3">{a.description}</td>
                    <td className="py-2 pr-3">{[a.area, a.equipment].filter(Boolean).join(" · ")}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {(a.resolved_names || []).join(", ") || a.assigned_to || "-"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{a.planned_hours ?? "-"}</td>
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
                    <td colSpan={10} className="py-4">
                      <EmptyState
                        icon="📭"
                        title="No hay actividades para mostrar"
                        message="Sube el Excel de la semana o cambia el filtro de estado."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-4">
          <SectionHeader
            icon="👷"
            title={`Tecnicos${incompleteCount > 0 ? ` (${incompleteCount} por completar)` : ""}`}
            action={
              <button onClick={loadTechnicians} className="text-xs text-iasa-blue underline">
                Actualizar
              </button>
            }
          />
          <p className="text-xs text-gray-500 mb-3">
            El codigo viene del Excel (columna "Puesto"). Completa el nombre y el rol para que ese tecnico pueda
            iniciar sesion en la app. Solo "Mecanico" y "Electrico" clasifican la especialidad de sus actividades;
            otros roles (Supervisor, Mantenimiento...) igual pueden iniciar sesion y ver sus propias actividades.
          </p>
          <datalist id="technician-roles">
            <option value="Mecanico" />
            <option value="Electrico" />
            <option value="Supervisor" />
            <option value="Mantenimiento" />
          </datalist>
          {techError && <p className="text-sm text-red-600 mb-2">{techError}</p>}
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Codigo</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Rol</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {technicians.map((t) => (
                  <TechnicianRow key={t.id} technician={t} onSaved={handleSaveTechnician} />
                ))}
                {technicians.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4">
                      <EmptyState
                        icon="👷"
                        title="Todavia no hay tecnicos"
                        message="Sube un Excel para detectarlos automaticamente."
                      />
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
