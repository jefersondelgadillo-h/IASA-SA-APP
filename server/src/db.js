import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedTechnicians } from "./services/seedTechnicians.js";
import { seedChecklistItems } from "./services/seedChecklistItems.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

// Si TURSO_DATABASE_URL esta configurada, los datos se guardan en Turso (persisten
// entre reinicios/redeploys, incluso en el plan gratis de Render que borra el disco
// local). Sin eso configurado, sigue usando un archivo SQLite local como antes
// (util para desarrollo). Ver docs/TURSO.md.
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${path.join(dataDir, "iasa.db")}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
  // Mantiene los enteros como Number normal (no BigInt), igual que
  // better-sqlite3, para no romper comparaciones (===) en todo el codigo.
  intMode: "number",
});

function normalizeArgs(params) {
  if (params.length === 1 && params[0] && typeof params[0] === "object" && !Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

// Envoltorio delgado con la misma forma que usaba better-sqlite3
// (db.prepare(sql).get/.all/.run(...)) para no tener que reescribir cada
// consulta del proyecto, solo agregar async/await donde se usan.
// "executor" es el cliente o, dentro de una transaccion, el objeto tx.
function boundPrepare(sql, executor) {
  return {
    async get(...params) {
      const res = await executor.execute({ sql, args: normalizeArgs(params) });
      return res.rows[0];
    },
    async all(...params) {
      const res = await executor.execute({ sql, args: normalizeArgs(params) });
      return res.rows;
    },
    async run(...params) {
      const res = await executor.execute({ sql, args: normalizeArgs(params) });
      return { lastInsertRowid: Number(res.lastInsertRowid ?? 0), changes: res.rowsAffected };
    },
  };
}

function prepare(sql) {
  return boundPrepare(sql, client);
}

// Ejecuta una funcion que hace varias operaciones dentro de una transaccion
// atomica. Reemplaza al patron "const tx = db.transaction(fn); tx();" de
// better-sqlite3: aqui se usa como "await db.transaction(async (tx) => {...})",
// y dentro se usa tx.prepare(...) (no db.prepare) para que las consultas
// corran dentro de la misma transaccion.
async function withTransaction(fn) {
  const tx = await client.transaction("write");
  const txDb = { prepare: (sql) => boundPrepare(sql, tx) };
  try {
    const result = await fn(txDb);
    await tx.commit();
    return result;
  } finally {
    // Si no se llego a commit() (error en el camino), close() hace el
    // rollback automaticamente. Si ya se hizo commit, no hace nada.
    tx.close();
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS technicians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL UNIQUE,
  source_filename TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  order_number TEXT,
  activity_date TEXT,
  area TEXT,
  equipment TEXT,
  description TEXT NOT NULL,
  activity_type TEXT CHECK (activity_type IS NULL OR activity_type IN ('Mecanico', 'Electrico')),
  assigned_to TEXT,
  assigned_codes TEXT NOT NULL DEFAULT ',',
  planned_hours REAL,
  status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'En progreso', 'Completado', 'Con problema')),
  status_comment TEXT,
  status_updated_by TEXT,
  status_updated_at TEXT,
  row_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  comment TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activities_week ON activities(week_id);
CREATE INDEX IF NOT EXISTS idx_activities_codes ON activities(assigned_codes);
CREATE INDEX IF NOT EXISTS idx_history_activity ON activity_history(activity_id);

CREATE TABLE IF NOT EXISTS week_indicators (
  week_start TEXT PRIMARY KEY REFERENCES weeks(week_start) ON DELETE CASCADE,
  fallas_equipos_crown_pct REAL,
  fallas_equipos_tecnal_pct REAL,
  fallas_equipos_meta REAL NOT NULL DEFAULT 3,
  cumplimiento_anual_crown_pct REAL,
  cumplimiento_anual_tecnal_pct REAL,
  cumplimiento_anual_meta REAL NOT NULL DEFAULT 90,
  updated_at TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS laminadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS laminador_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  laminador_id INTEGER NOT NULL REFERENCES laminadores(id) ON DELETE CASCADE,
  reset_date TEXT NOT NULL,
  hours_before REAL NOT NULL,
  reason TEXT,
  performed_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_laminador_resets_laminador ON laminador_resets(laminador_id);

-- Checklist diario de laminadores (mismo listado para los 8, ver
-- server/config/checklist-items-seed.json). Los operadores de produccion
-- llenan un reporte por dia/turno; mantenimiento lo revisa despues.
CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_sistema TEXT NOT NULL,
  componente TEXT NOT NULL,
  accion TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  laminador_id INTEGER NOT NULL REFERENCES laminadores(id) ON DELETE CASCADE,
  report_date TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checklist_report_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES checklist_reports(id) ON DELETE CASCADE,
  checklist_item_id INTEGER NOT NULL REFERENCES checklist_items(id),
  estado TEXT CHECK (estado IS NULL OR estado IN ('OK', 'MAL')),
  comentario TEXT
);

CREATE INDEX IF NOT EXISTS idx_checklist_reports_laminador ON checklist_reports(laminador_id);
CREATE INDEX IF NOT EXISTS idx_checklist_report_items_report ON checklist_report_items(report_id);

-- Informe de medicion de rodillos (galga 0,05 mm), formato "Informe de
-- medicion rodillos laminadores". Cada envio de un operario es UNA fila del
-- informe (un estado: rodillo fijo/movil, antes/despues de rectificar) con
-- sus 10 lecturas y la fecha/hora o turno. Mantenimiento completa despues
-- los datos de la orden/rectificacion, la conclusion y quien reviso.
CREATE TABLE IF NOT EXISTS rodillo_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  laminador_id INTEGER NOT NULL REFERENCES laminadores(id) ON DELETE CASCADE,
  row_key TEXT NOT NULL CHECK (row_key IN ('R1AR', 'R1DR', 'R2AR', 'R2DR')),
  fecha TEXT NOT NULL,
  hora TEXT,
  turno TEXT,
  point_1 INTEGER CHECK (point_1 IS NULL OR point_1 IN (0, 1)),
  point_2 INTEGER CHECK (point_2 IS NULL OR point_2 IN (0, 1)),
  point_3 INTEGER CHECK (point_3 IS NULL OR point_3 IN (0, 1)),
  point_4 INTEGER CHECK (point_4 IS NULL OR point_4 IN (0, 1)),
  point_5 INTEGER CHECK (point_5 IS NULL OR point_5 IN (0, 1)),
  point_6 INTEGER CHECK (point_6 IS NULL OR point_6 IN (0, 1)),
  point_7 INTEGER CHECK (point_7 IS NULL OR point_7 IN (0, 1)),
  point_8 INTEGER CHECK (point_8 IS NULL OR point_8 IN (0, 1)),
  point_9 INTEGER CHECK (point_9 IS NULL OR point_9 IN (0, 1)),
  point_10 INTEGER CHECK (point_10 IS NULL OR point_10 IN (0, 1)),
  ejecutado_por TEXT NOT NULL,
  orden_programada TEXT,
  ultimo_cambio_rolos TEXT,
  ultimo_rectificado TEXT,
  rectificador_usado TEXT,
  conclusion TEXT,
  comentario TEXT,
  revisado_por TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_rodillo_reports_laminador ON rodillo_reports(laminador_id);
`;

// Crea las tablas si no existen, corre la migracion de indicadores si hace
// falta, precarga los 8 laminadores y el roster inicial de tecnicos. Se debe
// esperar (await db.ready) antes de arrancar el servidor.
async function init() {
  await client.execute("PRAGMA foreign_keys = ON");

  // Migracion: si "week_indicators" existe con el esquema viejo (un solo
  // valor total por indicador) se recrea con el esquema nuevo (Crown/Tecnal
  // por separado). El dato manual anterior no se puede convertir
  // automaticamente a las dos lineas, asi que se pierde.
  const cols = await client.execute("PRAGMA table_info(week_indicators)");
  const existingCols = cols.rows.map((c) => c.name);
  if (existingCols.length > 0 && !existingCols.includes("fallas_equipos_crown_pct")) {
    await client.execute("DROP TABLE week_indicators");
  }

  await client.executeMultiple(SCHEMA);

  for (let i = 1; i <= 8; i++) {
    await client.execute({
      sql: "INSERT OR IGNORE INTO laminadores (id, name) VALUES (?, ?)",
      args: [i, `Laminador ${i}`],
    });
  }

  await seedTechnicians(db);
  await seedChecklistItems(db);
}

const db = { prepare, transaction: withTransaction };
db.ready = init();

export default db;
