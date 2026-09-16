import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "..", "config", "technicians-seed.json");

/**
 * Carga el roster inicial (server/config/technicians-seed.json) en la tabla
 * technicians, una sola vez por codigo: si el codigo ya existe (fue cargado
 * antes, o el supervisor ya lo edito a mano desde el panel admin) no lo toca.
 * Asi el roster conocido queda listo desde el primer arranque, sin pisar
 * nunca una edicion manual.
 */
export async function seedTechnicians(db) {
  if (!fs.existsSync(seedPath)) return;
  const { technicians } = JSON.parse(fs.readFileSync(seedPath, "utf8"));

  await db.transaction(async (tx) => {
    const insert = tx.prepare(`
      INSERT INTO technicians (code, name, role) VALUES (?, ?, ?)
      ON CONFLICT(code) DO NOTHING
    `);

    for (const t of technicians) {
      for (const code of t.codes) {
        await insert.run(code, t.name, t.role);
      }
    }
  });
}
