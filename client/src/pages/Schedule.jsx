import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import ActivityCard from "../components/ActivityCard.jsx";
import UpdateStatusModal from "../components/UpdateStatusModal.jsx";
import StatTile from "../components/StatTile.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Logo from "../components/Logo.jsx";

const STATUS_FILTERS = ["Todos", "Pendiente", "En progreso", "Completado", "Con problema"];

// Prioridad para elegir el estado "representativo" cuando una misma orden
// (mismo numero de orden + mismo responsable) tiene horas en varios dias:
// se muestra el mas urgente de sus ocurrencias.
const STATUS_PRIORITY = ["Con problema", "En progreso", "Pendiente", "Completado"];

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

// Una misma orden de trabajo puede tener horas planificadas en varios dias
// (una fila de "actividades" por dia). Se fusionan aqui las que comparten
// orden + responsable en una sola tarjeta: se reporta una vez y el cambio
// se aplica a todas sus ocurrencias.
function mergeActivities(list) {
  const map = new Map();
  for (const a of list) {
    // Se incluye "_week" (si viene marcado, ej. en pendientes de semanas
    // anteriores) para no fusionar por error el mismo numero de orden si se
    // repitiera en semanas distintas.
    const key = a.order_number ? `${a._week || ""}::${a.order_number}::${a.assigned_codes}` : `single-${a.id}`;
    if (!map.has(key)) {
      map.set(key, {
        ...a,
        ids: [a.id],
        dates: a.activity_date ? [a.activity_date] : [],
        datesById: { [a.id]: a.activity_date },
        planned_hours: a.planned_hours || 0,
        _latestUpdate: a.status_updated_at,
      });
    } else {
      const g = map.get(key);
      g.ids.push(a.id);
      if (a.activity_date) g.dates.push(a.activity_date);
      g.datesById[a.id] = a.activity_date;
      g.planned_hours += a.planned_hours || 0;
      // estado representativo: el mas urgente entre las ocurrencias de esta orden
      if (STATUS_PRIORITY.indexOf(a.status) < STATUS_PRIORITY.indexOf(g.status)) {
        g.status = a.status;
      }
      // comentario: el de la actualizacion mas reciente
      if (!g._latestUpdate || (a.status_updated_at && a.status_updated_at > g._latestUpdate)) {
        g._latestUpdate = a.status_updated_at;
        g.status_comment = a.status_comment;
      }
    }
  }
  return [...map.values()].map((g) => ({ ...g, dates: [...new Set(g.dates)].sort() }));
}

// Cuantas semanas anteriores a la que se esta viendo se revisan en busca de
// actividades pendientes (para no hacer de mas llamadas si hay muchas
// semanas cargadas con el tiempo).
const CARRY_OVER_WEEKS = 4;

export default function Schedule({ technician, onChangeUser }) {
  const [week, setWeek] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlyMine, setOnlyMine] = useState(technician.codes?.length > 0);
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [selected, setSelected] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);
  const [carryOver, setCarryOver] = useState([]);
  const [carryOverLoading, setCarryOverLoading] = useState(false);

  async function load(weekStart) {
    setLoading(true);
    setError("");
    try {
      // Se trae toda la semana sin filtrar por especialidad: la clasificacion
      // Mecanico/Electrico puede faltar para algunos codigos todavia, y no
      // queremos que eso oculte actividades por error.
      const data = await api.getSchedule(weekStart ? { week: weekStart } : {});
      setWeek(data.week);
      setActivities(data.activities);
      setLoadedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleWeekChange(weekStart) {
    load(weekStart);
  }

  useEffect(() => {
    load();
    api.getWeeks().then(setWeeks).catch(() => setWeeks([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actividades no completadas de hasta CARRY_OVER_WEEKS semanas antes de la
  // que se esta viendo, para que el tecnico pueda terminarlas sin tener que
  // cambiar de semana manualmente.
  useEffect(() => {
    if (!week || weeks.length === 0) {
      setCarryOver([]);
      return;
    }
    const priorWeeks = weeks
      .map((w) => w.week_start)
      .filter((w) => w < week)
      .sort((a, b) => (a < b ? 1 : -1))
      .slice(0, CARRY_OVER_WEEKS);

    if (priorWeeks.length === 0) {
      setCarryOver([]);
      return;
    }

    let cancelled = false;
    setCarryOverLoading(true);
    Promise.all(
      priorWeeks.map((w) =>
        api
          .getSchedule({ week: w })
          .then((r) => (r.activities || []).map((a) => ({ ...a, _week: w })))
          .catch(() => [])
      )
    )
      .then((results) => {
        if (cancelled) return;
        const pending = results.flat().filter((a) => a.status !== "Completado");
        setCarryOver(pending);
      })
      .finally(() => {
        if (!cancelled) setCarryOverLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [week, weeks]);

  // Alcance actual (segun "solo mis actividades" y especialidad) sin aplicar
  // todavia el filtro de estado: sirve de base para el resumen de avance y
  // para la lista filtrada, asi ambos quedan siempre consistentes entre si.
  function scopeFor(list) {
    return list.filter((a) => {
      if (onlyMine) {
        return technician.codes?.some((c) => a.assigned_codes_list.includes(c));
      }
      // Al ver "todas": se muestra la propia especialidad, y todo lo que aun
      // no tenga especialidad clasificada (para no perder actividades).
      return !a.activity_type || a.activity_type === technician.role;
    });
  }

  const scoped = useMemo(() => scopeFor(activities), [activities, onlyMine, technician.codes, technician.role]);

  // Se fusiona antes de filtrar por estado: asi el filtro se aplica al estado
  // representativo de cada orden (no deja "sueltas" ocurrencias de la misma
  // orden en dias que no calzan con el filtro).
  const mergedScoped = useMemo(() => mergeActivities(scoped), [scoped]);

  const mergedCarryOver = useMemo(
    () => mergeActivities(scopeFor(carryOver)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [carryOver, onlyMine, technician.codes, technician.role]
  );

  const counts = useMemo(() => {
    const c = { Pendiente: 0, "En progreso": 0, Completado: 0, "Con problema": 0 };
    for (const a of mergedScoped) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [mergedScoped]);

  const merged = useMemo(() => {
    return mergedScoped.filter((a) => statusFilter === "Todos" || a.status === statusFilter);
  }, [mergedScoped, statusFilter]);

  // El filtro de estado tambien aplica a las pendientes de semanas
  // anteriores: si no, quedaban visibles sin importar el filtro elegido.
  const filteredCarryOver = useMemo(() => {
    return mergedCarryOver.filter((a) => statusFilter === "Todos" || a.status === statusFilter);
  }, [mergedCarryOver, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const a of merged) {
      const key = a.dates[0] || "Sin fecha";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }, [merged]);

  async function handleSaveStatus(ids, body) {
    const updates = await Promise.all(ids.map((id) => api.updateStatus(id, body)));
    const byId = new Map(updates.map((u) => [u.id, u]));
    setActivities((prev) => prev.map((a) => (byId.has(a.id) ? { ...a, ...byId.get(a.id) } : a)));
    // Si era una actividad de una semana anterior y quedo Completado, sale
    // de "pendientes de semanas anteriores"; si sigue sin completar, se
    // actualiza su estado ahi mismo.
    setCarryOver((prev) =>
      prev.map((a) => (byId.has(a.id) ? { ...a, ...byId.get(a.id) } : a)).filter((a) => a.status !== "Completado")
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="bg-iasa-blue text-white px-4 pt-6 pb-4 sticky top-0 z-10 shadow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-white rounded-lg px-2 py-1 shrink-0">
              <Logo className="h-7" fallbackClassName="text-iasa-blue font-bold text-sm" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">Don Felipe</p>
              <p className="text-xs text-white/80">
                {technician.name} · {technician.role}
              </p>
              {loadedAt && <p className="text-[11px] text-white/60">{timeAgo(loadedAt)}</p>}
            </div>
          </div>
          <button onClick={onChangeUser} className="text-xs bg-white/15 rounded-full px-3 py-1.5">
            Cambiar
          </button>
        </div>

        {weeks.length > 1 && (
          <label className="flex items-center gap-2 text-sm mb-2">
            <span className="text-white/70 text-xs">Semana</span>
            <select
              value={week || ""}
              onChange={(e) => handleWeekChange(e.target.value)}
              className="bg-white/15 text-white text-xs rounded-full pl-2 pr-1 py-1.5 border-none focus:outline-none focus:ring-1 focus:ring-white/50"
            >
              {weeks.map((w) => (
                <option key={w.week_start} value={w.week_start} className="text-gray-900">
                  {w.week_start}
                </option>
              ))}
            </select>
          </label>
        )}

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

        {!loading && !error && mergedScoped.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tu avance esta semana</p>
            <ProgressBar label="Completado" value={counts.Completado} total={mergedScoped.length} tone="green" />
            <div className="grid grid-cols-4 gap-2 mt-3">
              <StatTile label="Pendiente" value={counts.Pendiente} />
              <StatTile label="En progreso" value={counts["En progreso"]} tone="amber" />
              <StatTile label="Completado" value={counts.Completado} tone="green" />
              <StatTile label="Con problema" value={counts["Con problema"]} tone={counts["Con problema"] > 0 ? "red" : "default"} />
            </div>
          </section>
        )}

        {!carryOverLoading && filteredCarryOver.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-2">
              ⏳ Pendientes de semanas anteriores ({filteredCarryOver.length})
            </h2>
            <div className="space-y-3">
              {filteredCarryOver.map((a) => (
                <ActivityCard key={`carry-${a.id}`} activity={a} onClick={() => setSelected(a)} />
              ))}
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
