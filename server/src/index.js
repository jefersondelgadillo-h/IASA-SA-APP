import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import scheduleRoutes from "./routes/schedule.js";
import activitiesRoutes from "./routes/activities.js";
import adminRoutes from "./routes/admin.js";
import indicatorsRoutes from "./routes/indicators.js";
import "./db.js"; // asegura que la base de datos y las tablas existan al arrancar

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true, service: "iasa-mantenimiento-api" }));

app.use("/api", scheduleRoutes);
app.use("/api", activitiesRoutes);
app.use("/api", adminRoutes);
app.use("/api", indicatorsRoutes);

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

app.listen(PORT, () => {
  console.log(`API de mantenimiento IASA SA escuchando en http://localhost:${PORT}`);
});
