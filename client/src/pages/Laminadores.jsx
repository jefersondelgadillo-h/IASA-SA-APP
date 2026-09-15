import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import Logo from "../components/Logo.jsx";

export default function Laminadores() {
  const [laminadores, setLaminadores] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getLaminadores().then(setLaminadores).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <header className="bg-iasa-blue text-white px-4 py-4 flex items-center gap-2.5">
        <div className="bg-white rounded-lg px-2 py-1 shrink-0">
          <Logo className="h-6" fallbackClassName="text-iasa-blue font-bold text-xs" />
        </div>
        <div>
          <p className="font-bold">Historial de Laminadores TECNAL</p>
          <p className="text-xs text-white/80">Reseteos de horometro · Planta Don Felipe</p>
        </div>
      </header>

      <main className="px-4 mt-4">
        <p className="text-sm text-gray-600 mb-4">Selecciona el laminador para ver o registrar un reseteo.</p>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          {laminadores.map((l) => (
            <Link
              key={l.id}
              to={`/laminadores/${l.id}`}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center active:scale-[0.98] transition"
            >
              <p className="text-2xl mb-1">⚙️</p>
              <p className="font-semibold text-gray-900">{l.name}</p>
            </Link>
          ))}
        </div>

        <Link to="/" className="block text-center text-xs text-gray-400 underline mt-8">
          Volver al inicio
        </Link>
      </main>
    </div>
  );
}
