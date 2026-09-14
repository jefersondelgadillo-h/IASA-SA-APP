import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import ActivityCard from "../components/ActivityCard.jsx";
import UpdateStatusModal from "../components/UpdateStatusModal.jsx";
import StatTile from "../components/StatTile.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import EmptyState from "../components/EmptyState.jsx";

const STATUS_FILTERS = ["Todos", "Pendiente", "En progreso", "Completado", "Con problema"];

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

function formatDay(dateStr) {
  if (!dateStr) return "Sin fecha";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return dateStr;
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function timeAgo(date) {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "actualizado justo ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `actualizado hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `actualizado hace ${hours} h`;
}

export default function Schedule({ technician, onChangeUser }) {
  const [week, setWeek] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlyMine, setOnlyMine] = useState(technician.codes?.length > 0);
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [selected, setSelected] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      // Se trae toda la semana sin filtrar por especialidad: la clasificacion
      // Mecanico/Electrico puede faltar para algunos codigos todavia, y no
      // queremos que eso oculte actividades por error.
      const data = await api.getSchedule({});
      setWeek(data.week);
      setActivities(data.activities);
      setLoadedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Alcance actual (segun "solo mis actividades" y especialidad) sin aplicar
  // todavia el filtro de estado: sirve de base para el resumen de avance y
  // para la lista filtrada, asi ambos quedan siempre consistentes entre si.
  const scoped = useMemo(() => {
    return activities.filter((a) => {
      if (onlyMine) {
        return technician.codes?.some((c) => a.assigned_codes_list.includes(c));
      }
      // Al ver "todas": se muestra la propia especialidad, y todo lo que aun
      // no tenga especialidad clasificada (para no perder actividades).
      return !a.activity_type || a.activity_type === technician.role;
    });
  }, [activities, onlyMine, technician.codes, technician.role]);

  const counts = useMemo(() => {
    const c = { Pendiente: 0, "En progreso": 0, Completado: 0, "Con problema": 0 };
    for (const a of scoped) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [scoped]);

  const filtered = useMemo(() => {
    return scoped.filter((a) => statusFilter === "Todos" || a.status === statusFilter);
  }, [scoped, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const a of filtered) {
      const key = a.activity_date || "Sin fecha";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }, [filtered]);

  async function handleSaveStatus(id, body) {
    const updated = await api.updateStatus(id, body);
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="bg-iasa-blue text-white px-4 pt-6 pb-4 sticky top-0 z-10 shadow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-bold text-lg leading-tight">IASA SA · Don Felipe</p>
            <p className="text-xs text-white/80">
              {technician.name} · {technician.role}
              {week ? ` · Semana ${week}` : ""}
            </p>
            {loadedAt && <p className="text-[11px] text-white/60">{timeAgo(loadedAt)}</p>}
          </div>
          <button onClick={onChangeUser} className="text-xs bg-white/15 rounded-full px-3 py-1.5">
            Cambiar
          </button>
        </div>

        <label
          className={`flex items-center gap-2 text-sm mb-2 ${!technician.codes?.length ? "opacity-60" : ""}`}
          title={!technician.codes?.length ? "Pide a tu supervisor que te registre para poder usar este filtro" : ""}
        >
          <input
            type="checkbox"
            checked={onlyMine}
            disabled={!technician.codes?.length}
            onChange={(e) => setOnlyMine(e.target.checked)}
          />
          Ver solo mis actividades
        </label>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap text-xs font-medium rounded-full px-3 py-1.5 ${
                statusFilter === s ? "bg-white text-iasa-blue" : "bg-white/15 text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 mt-4 space-y-6">
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100" />
            ))}
          </div>
        )}
        {error && <p className="text-center text-red-600 mt-10">{error}</p>}

        {!loading && !error && scoped.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tu avance esta semana</p>
            <ProgressBar label="Completado" value={counts.Completado} total={scoped.length} tone="green" />
            <div className="grid grid-cols-4 gap-2 mt-3">
              <StatTile label="Pendiente" value={counts.Pendiente} />
              <StatTile label="En progreso" value={counts["En progreso"]} tone="amber" />
              <StatTile label="Completado" value={counts.Completado} tone="green" />
              <StatTile label="Con problema" value={counts["Con problema"]} tone={counts["Con problema"] > 0 ? "red" : "default"} />
            </div>
          </section>
        )}

        {!loading && !error && grouped.length === 0 && (
          <EmptyState
            icon="🗒️"
            title="No hay actividades para mostrar"
            message="Prueba cambiar el filtro de estado o desactivar 'Ver solo mis actividades'."
          />
        )}

        {grouped.map(([date, items]) => (
          <section key={date}>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">{formatDay(date)}</h2>
            <div className="space-y-3">
              {items.map((a) => (
                <ActivityCard key={a.id} activity={a} onClick={() => setSelected(a)} />
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer className="text-center mt-8">
        <Link to="/admin" className="text-xs text-gray-400 underline">
          Panel de administracion
        </Link>
      </footer>

      {selected && (
        <UpdateStatusModal
          activity={selected}
          technicianName={technician.name}
          onClose={() => setSelected(null)}
          onSaved={handleSaveStatus}
        />
      )}
    </div>
  );
}
