import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "..", "config", "checklist-items-seed.json");

/**
 * Carga el checklist de componentes de laminadores (server/config/checklist-items-seed.json)
 * en la tabla checklist_items, una sola vez: si ya hay filas cargadas no hace nada
 * (no hay una clave natural unica para los items, asi que se controla por conteo).
 */
export async function seedChecklistItems(db) {
  if (!fs.existsSync(seedPath)) return;

  const { count } = await db.prepare("SELECT COUNT(*) AS count FROM checklist_items").get();
  if (count > 0) return;

  const { items } = JSON.parse(fs.readFileSync(seedPath, "utf8"));

  await db.transaction(async (tx) => {
    const insert = tx.prepare(
      "INSERT INTO checklist_items (sub_sistema, componente, accion, order_index) VALUES (?, ?, ?, ?)"
    );
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await insert.run(item.sub_sistema, item.componente, item.accion, i);
    }
  });
}
