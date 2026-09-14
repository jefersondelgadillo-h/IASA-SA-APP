import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedTechnicians } from "./services/seedTechnicians.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "iasa.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// "code" es el codigo de "Puesto" tal cual aparece en el Excel (ej. WPAQUI, DCRUZ).
// name/role quedan null hasta que el supervisor los complete en el panel admin
// (seccion Tecnicos): sin eso, ese tecnico no aparece en el login. "role" es
// texto libre (Mecanico, Electrico, Supervisor, Mantenimiento...) porque no
// todos los codigos del Excel son tecnicos de campo; solo 'Mecanico' y
// 'Electrico' cuentan para clasificar la especialidad de una actividad.
db.exec(`
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

-- Cada fila es una "ocurrencia" de una orden de trabajo en un dia especifico
-- de la semana (el Excel trae una orden por fila con horas planificadas por
-- dia; cada dia con horas > 0 se convierte en una fila aqui).
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  order_number TEXT,
  activity_date TEXT,
  area TEXT,
  equipment TEXT,
  description TEXT NOT NULL,
  -- Null cuando el/los codigo(s) asignados aun no tienen especialidad
  -- registrada en "technicians", o cuando mezclan ambas especialidades.
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

-- Indicadores de gestion que no salen del Excel semanal (vienen de otro sistema,
-- ej. SAP/avisos): el supervisor los carga a mano desde el panel admin, una
-- fila por semana (identificada por week_start), y quedan visibles para todos
-- en la pantalla principal de esa semana.
CREATE TABLE IF NOT EXISTS week_indicators (
  week_start TEXT PRIMARY KEY REFERENCES weeks(week_start) ON DELETE CASCADE,
  fallas_equipos_pct REAL,
  fallas_equipos_meta REAL NOT NULL DEFAULT 3,
  cumplimiento_anual_pct REAL,
  cumplimiento_anual_meta REAL NOT NULL DEFAULT 90,
  updated_at TEXT,
  updated_by TEXT
);
`);

seedTechnicians(db);

export default db;
