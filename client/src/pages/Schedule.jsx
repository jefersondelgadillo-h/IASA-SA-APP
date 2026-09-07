import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { clearTechnician } from "../lib/session.js";
import ActivityCard from "../components/ActivityCard.jsx";
import UpdateStatusModal from "../components/UpdateStatusModal.jsx";

const STATUS_FILTERS = ["Todos", "Pendiente", "En progreso", "Completado", "Con problema"];

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

function formatDay(dateStr) {
  if (!dateStr) return "Sin fecha";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return dateStr;
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export default function Schedule({ technician, onChangeUser }) {
  const [week, setWeek] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlyMine, setOnlyMine] = useState(true);
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.getSchedule({ role: technician.role });
      setWeek(data.week);
      setActivities(data.activities);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technician.role]);

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (onlyMine && a.assigned_to !== technician.name) return false;
      if (statusFilter !== "Todos" && a.status !== statusFilter) return false;
      return true;
    });
  }, [activities, onlyMine, statusFilter, technician.name]);

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
    setActivities((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="bg-iasa-blue text-white px-4 pt-6 pb-4 sticky top-0 z-10 shadow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-bold text-lg leading-tight">IASA SA · Don Felipe</p>
            <p className="text-xs text-white/80">
              {technician.name} · {technician.role === "Mecanico" ? "Mecanico" : "Electrico"}
              {week ? ` · Semana ${week}` : ""}
            </p>
          </div>
          <button onClick={onChangeUser} className="text-xs bg-white/15 rounded-full px-3 py-1.5">
            Cambiar
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
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
        {loading && <p className="text-center text-gray-500 mt-10">Cargando programacion...</p>}
        {error && <p className="text-center text-red-600 mt-10">{error}</p>}
        {!loading && !error && grouped.length === 0 && (
          <p className="text-center text-gray-500 mt-10">No hay actividades para mostrar.</p>
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
