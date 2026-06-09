const path = require("path");
const express = require("express");
const cors = require("cors");

const envPath = path.join(__dirname, "..", ".env");
require("dotenv").config({ path: envPath });

const { initPool, closePool } = require("./db");
const { authRequired } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const holdersRoutes = require("./routes/holders");
const hardwareRoutes = require("./routes/hardware");
const softwareRoutes = require("./routes/software");
const assignmentsRoutes = require("./routes/assignments");
const dashboardRoutes = require("./routes/dashboard");
const statsRoutes = require("./routes/stats");
const searchRoutes = require("./routes/search");
const importRoutes = require("./routes/import");
const dropdownsRoutes = require("./routes/dropdowns");

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, service: "eam-backend" });
});

app.use("/api/auth", authRoutes);

app.use("/api/holders", authRequired, holdersRoutes);
app.use("/api/hardware", authRequired, hardwareRoutes);
app.use("/api/software", authRequired, softwareRoutes);
app.use("/api/assignments", authRequired, assignmentsRoutes);
app.use("/api/dashboard", authRequired, dashboardRoutes);
app.use("/api/stats", authRequired, statsRoutes);
app.use("/api/search", authRequired, searchRoutes);
app.use("/api/import", authRequired, importRoutes);
app.use("/api/dropdowns", authRequired, dropdownsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
});

async function start() {
  await initPool();
  const server = app.listen(port, () => {
    console.log(`EAM API listening on http://localhost:${port}`);
  });

  const shutdown = async () => {
    server.close();
    await closePool();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
