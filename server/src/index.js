import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import scheduleRoutes from "./routes/schedule.js";
import activitiesRoutes from "./routes/activities.js";
import adminRoutes from "./routes/admin.js";
import laminadoresRoutes from "./routes/laminadores.js";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true, service: "iasa-mantenimiento-api" }));

app.use("/api", scheduleRoutes);
app.use("/api", activitiesRoutes);
app.use("/api", adminRoutes);
app.use("/api", laminadoresRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

// En produccion, sirve el build del frontend (client/dist) desde el mismo servidor.
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Espera a que las tablas existan (y las migraciones/precargas terminen)
// antes de aceptar trafico.
db.ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API de mantenimiento IASA SA escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("No se pudo inicializar la base de datos:", err);
    process.exit(1);
  });
