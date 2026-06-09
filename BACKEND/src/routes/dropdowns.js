const express = require("express");
const oracledb = require("oracledb");
const { withConnection } = require("../db");
const { rowsToClients } = require("../util");

const router = express.Router();

// Hardware categories
router.get("/hardware/categories", async (_req, res) => {
  try {
    const rows = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT DISTINCT category FROM eam_hardware 
         WHERE category IS NOT NULL 
         ORDER BY category`
      );
      return rowsToClients(r);
    });
    res.json(rows.map(r => r.category));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Hardware models
router.get("/hardware/models", async (_req, res) => {
  try {
    const rows = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT DISTINCT model FROM eam_hardware 
         WHERE model IS NOT NULL 
         ORDER BY model`
      );
      return rowsToClients(r);
    });
    res.json(rows.map(r => r.model));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch models" });
  }
});

// Software license types
router.get("/software/license-types", async (_req, res) => {
  try {
    const rows = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT DISTINCT license_type FROM eam_software 
         WHERE license_type IS NOT NULL 
         ORDER BY license_type`
      );
      return rowsToClients(r);
    });
    res.json(rows.map(r => r.license_type));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch license types" });
  }
});

module.exports = router;
