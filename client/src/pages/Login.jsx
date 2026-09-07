import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { setTechnician } from "../lib/session.js";

export default function Login({ onLogin }) {
  const [role, setRole] = useState("Mecanico");
  const [technicians, setTechnicians] = useState([]);
  const [selected, setSelected] = useState("");
  const [customName, setCustomName] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getTechnicians().then(setTechnicians).catch(() => setTechnicians([]));
  }, []);

  const filtered = technicians.filter((t) => t.role === role);

  function handleEnter() {
    const name = useCustom ? customName.trim() : selected;
    if (!name) {
      setError("Selecciona o escribe tu nombre.");
      return;
    }
    setTechnician({ name, role });
    onLogin({ name, role });
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-iasa-blue px-6 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <h1 className="text-xl font-bold text-gray-900 text-center mb-1">IASA SA</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Programacion semanal · Planta Don Felipe</p>

        <p className="text-sm font-medium text-gray-700 mb-2">Soy</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {["Mecanico", "Electrico"].map((r) => (
            <button
              key={r}
              onClick={() => {
                setRole(r);
                setSelected("");
              }}
              className={`rounded-xl border-2 py-3 font-medium text-sm ${
                role === r ? "border-iasa-blue bg-iasa-blue/5 text-iasa-blue" : "border-gray-200 text-gray-600"
              }`}
            >
              {r === "Mecanico" ? "Mecanico" : "Electrico"}
            </button>
          ))}
        </div>

        <p className="text-sm font-medium text-gray-700 mb-2">Mi nombre</p>
        {!useCustom ? (
          <>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-2"
            >
              <option value="">Selecciona tu nombre...</option>
              {filtered.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
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
              className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-2"
            />
            <button className="text-xs text-iasa-blue underline mb-4" onClick={() => setUseCustom(false)}>
              Elegir de la lista
            </button>
          </>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <button onClick={handleEnter} className="w-full bg-iasa-blue text-white font-semibold rounded-xl py-3">
          Entrar
        </button>
      </div>
    </div>
  );
}
