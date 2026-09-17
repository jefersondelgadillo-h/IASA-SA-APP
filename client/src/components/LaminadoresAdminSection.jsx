import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { getAdminPassword } from "../lib/session.js";
import { downloadBlob } from "../lib/download.js";
import { rodilloLabel } from "../lib/rodillo.js";
import SectionHeader from "./SectionHeader.jsx";
import EmptyState from "./EmptyState.jsx";

function ExportButtons({ onExport }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function handle(format) {
    setExporting(true);
    setError("");
    try {
      const { blob, filename } = await onExport(format);
      downloadBlob(blob, filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={() => handle("xlsx")}
          disabled={exporting}
          className="text-xs bg-iasa-blue text-white rounded-full px-3 py-1.5 disabled:opacity-50"
        >
          {exporting ? "Generando..." : "Exportar a Excel"}
        </button>
        <button
          onClick={() => handle("csv")}
          disabled={exporting}
          className="text-xs border border-iasa-blue text-iasa-blue rounded-full px-3 py-1.5 disabled:opacity-50"
        >
          {exporting ? "Generando..." : "Exportar a CSV"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function DeleteRowButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-xs text-red-600 underline shrink-0">
        🗑️ Eliminar
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">¿Eliminar?</span>
        <button
          onClick={async () => {
            setDeleting(true);
            setError("");
            try {
              await onConfirm();
            } catch (err) {
              setError(err.message);
              setDeleting(false);
            }
          }}
          disabled={deleting}
          className="text-xs bg-red-600 text-white rounded-full px-2 py-1 disabled:opacity-50"
        >
          {deleting ? "..." : "Si"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="text-xs border border-gray-300 rounded-full px-2 py-1"
        >
          No
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ChecklistsPanel({ laminadorId, checklists, onDeleted }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">Historial de todos los laminadores</p>
        <ExportButtons onExport={(format) => api.adminExportLaminadorChecklists(getAdminPassword(), format)} />
      </div>
      {checklists.length === 0 && (
        <EmptyState icon="📋" title="Sin checklists" message="Este laminador todavia no tiene checklists registrados." />
      )}
      <div className="space-y-2">
        {checklists.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl p-3">
            <div className="min-w-0">
              <Link to={`/laminadores/${laminadorId}/checklist/${c.id}`} className="font-medium text-sm text-iasa-blue underline">
                {c.report_date}
              </Link>
              <p className="text-xs text-gray-500">
                👤 {c.performed_by} · ✅ {c.ok_count} ⚠️ {c.mal_count}
              </p>
            </div>
            <DeleteRowButton
              onConfirm={async () => {
                await api.adminDeleteLaminadorChecklist(getAdminPassword(), c.id);
                onDeleted(c.id);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function RodilloReportsPanel({ laminadorId, reports, onDeleted }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">Historial de todos los laminadores</p>
        <ExportButtons onExport={(format) => api.adminExportRodilloReports(getAdminPassword(), format)} />
      </div>
      {reports.length === 0 && (
        <EmptyState icon="📏" title="Sin mediciones" message="Este laminador todavia no tiene mediciones registradas." />
      )}
      <div className="space-y-2">
        {reports.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl p-3">
            <div className="min-w-0">
              <Link to={`/laminadores/${laminadorId}/rodillos/${r.id}`} className="font-medium text-sm text-iasa-blue underline">
                {rodilloLabel(r.rodillo)}
              </Link>
              <p className="text-xs text-gray-500">
                {r.antes_fecha} {r.despues_fecha ? `→ ${r.despues_fecha}` : "(pendiente despues)"}
              </p>
            </div>
            <DeleteRowButton
              onConfirm={async () => {
                await api.adminDeleteRodilloReport(getAdminPassword(), r.id);
                onDeleted(r.id);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ResetsPanel({ resets, onDeleted }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">Historial de todos los laminadores</p>
        <ExportButtons onExport={(format) => api.adminExportLaminadorResets(getAdminPassword(), format)} />
      </div>
      {resets.length === 0 && (
        <EmptyState icon="⚙️" title="Sin reseteos" message="Este laminador todavia no tiene reseteos registrados." />
      )}
      <div className="space-y-2">
        {resets.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl p-3">
            <div className="min-w-0">
              <p className="font-medium text-sm text-gray-900">{r.reset_date}</p>
              <p className="text-xs text-gray-500">
                🕒 {r.hours_before} h · 👤 {r.performed_by}
              </p>
            </div>
            <DeleteRowButton
              onConfirm={async () => {
                await api.adminDeleteLaminadorReset(getAdminPassword(), r.id);
                onDeleted(r.id);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LaminadoresAdminSection() {
  const [laminadores, setLaminadores] = useState([]);
  const [laminadorId, setLaminadorId] = useState(null);
  const [tab, setTab] = useState("checklists");

  const [checklists, setChecklists] = useState([]);
  const [rodilloReports, setRodilloReports] = useState([]);
  const [resets, setResets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getLaminadores()
      .then((data) => {
        setLaminadores(data);
        setLaminadorId(data[0]?.id ?? null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!laminadorId) return;
    setLoading(true);
    setError("");
    Promise.all([
      api.getLaminadorChecklists(laminadorId),
      api.getRodilloReports(laminadorId),
      api.getLaminadorResets(laminadorId),
    ])
      .then(([checklistData, rodilloData, resetsData]) => {
        setChecklists(checklistData.reports);
        setRodilloReports(rodilloData.reports);
        setResets(resetsData.resets);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [laminadorId]);

  return (
    <section className="bg-white rounded-2xl shadow-sm p-4">
      <SectionHeader icon="🏭" title="Historial de laminadores" />
      <p className="text-xs text-gray-500 mb-3">
        Elimina registros del checklist de componentes, mediciones de rodillos y reseteos de horometro. Cada
        exportacion trae el historial completo de los 8 laminadores.
      </p>

      <label className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        Laminador
        <select
          value={laminadorId || ""}
          onChange={(e) => setLaminadorId(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
        >
          {laminadores.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {[
          { key: "checklists", label: "📋 Checklist de componentes" },
          { key: "rodillos", label: "📏 Mediciones de rodillos" },
          { key: "resets", label: "⏱️ Reseteos horometro" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap text-xs font-medium rounded-full px-3 py-1.5 border ${
              tab === t.key ? "bg-iasa-blue text-white border-iasa-blue" : "border-gray-200 text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {loading && <p className="text-sm text-gray-400">Cargando...</p>}

      {!loading && !error && tab === "checklists" && (
        <ChecklistsPanel
          laminadorId={laminadorId}
          checklists={checklists}
          onDeleted={(id) => setChecklists((prev) => prev.filter((c) => c.id !== id))}
        />
      )}
      {!loading && !error && tab === "rodillos" && (
        <RodilloReportsPanel
          laminadorId={laminadorId}
          reports={rodilloReports}
          onDeleted={(id) => setRodilloReports((prev) => prev.filter((r) => r.id !== id))}
        />
      )}
      {!loading && !error && tab === "resets" && (
        <ResetsPanel resets={resets} onDeleted={(id) => setResets((prev) => prev.filter((r) => r.id !== id))} />
      )}
    </section>
  );
}
