import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { setTechnician } from "../lib/session.js";
import Logo from "../components/Logo.jsx";

const ROLE_ORDER = ["Mecanico", "Electrico"];

export default function Login({ onLogin }) {
  const [role, setRole] = useState("Mecanico");
  const [technicians, setTechnicians] = useState([]);
  const [selectedName, setSelectedName] = useState("");
  const [customName, setCustomName] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getTechnicians().then(setTechnicians).catch(() => setTechnicians([]));
  }, []);

  useEffect(() => {
    if (technicians.length === 0) return;
    const availableRoles = new Set(technicians.map((t) => t.role));
    if (!availableRoles.has(role)) {
      setRole(technicians[0].role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technicians]);

  // Roles reales presentes en el roster (Mecanico/Electrico primero, el
  // resto -Supervisor, Mantenimiento, etc.- despues, en orden alfabetico).
  const roles = [...new Set(technicians.map((t) => t.role))].sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a);
    const ib = ROLE_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });

  const filtered = technicians.filter((t) => t.role === role);

  function handleEnter() {
    setError("");
    if (useCustom) {
      const name = customName.trim();
      if (!name) {
        setError("Escribe tu nombre.");
        return;
      }
      const tech = { codes: [], name, role };
      setTechnician(tech);
      onLogin(tech);
      return;
    }
    const technician = filtered.find((t) => t.name === selectedName);
    if (!technician) {
      setError("Selecciona tu nombre de la lista.");
      return;
    }
    const tech = { codes: technician.codes, name: technician.name, role: technician.role };
    setTechnician(tech);
    onLogin(tech);
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-iasa-blue px-6 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <div className="flex justify-center mb-2">
          <Logo className="h-14" fallbackClassName="text-xl font-bold text-gray-900" />
        </div>
        <p className="text-center text-gray-500 text-sm mb-6">Programacion semanal · Planta Don Felipe</p>

        <p className="text-sm font-medium text-gray-700 mb-2">Soy</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {(roles.length > 0 ? roles : ROLE_ORDER).map((r) => (
            <button
              key={r}
              onClick={() => {
                setRole(r);
                setSelectedName("");
              }}
              className={`rounded-xl border-2 py-3 px-4 font-medium text-sm ${
                role === r ? "border-iasa-blue bg-iasa-blue/5 text-iasa-blue" : "border-gray-200 text-gray-600"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <p className="text-sm font-medium text-gray-700 mb-2">Mi nombre</p>
        {!useCustom ? (
          <>
            <select
              value={selectedName}
              onChange={(e) => setSelectedName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-2"
            >
              <option value="">Selecciona tu nombre...</option>
              {filtered.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
            {filtered.length === 0 && (
              <p className="text-xs text-amber-600 mb-2">
                Todavia no hay nadie registrado con este rol. Pide a tu supervisor que te agregue en el panel de
                administracion.
              </p>
            )}
            <button className="text-xs text-iasa-blue underline mb-4" onClick={() => setUseCustom(true)}>
              No estoy en la lista
            </button>
          </>
        ) : (
          <>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Escribe tu nombre completo"
              className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-1"
            />
            <p className="text-xs text-gray-500 mb-2">
              Sin registro no vas a poder filtrar "solo mis actividades". Pide a tu supervisor que te agregue con tu
              codigo en el panel de administracion.
            </p>
            <button className="text-xs text-iasa-blue underline mb-4" onClick={() => setUseCustom(false)}>
              Elegir de la lista
            </button>
          </>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <button onClick={handleEnter} className="w-full bg-iasa-blue text-white font-semibold rounded-xl py-3">
          Entrar
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">o</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <Link
          to="/laminadores"
          className="w-full flex items-center justify-center gap-2 border-2 border-iasa-blue text-iasa-blue font-semibold rounded-xl py-3.5 active:scale-[0.99] transition"
        >
          ⚙️ Historial de Laminadores TECNAL
        </Link>

        <Link to="/admin" className="block text-center text-xs text-gray-400 underline mt-4">
          Panel de administracion
        </Link>
      </div>
    </div>
  );
}
