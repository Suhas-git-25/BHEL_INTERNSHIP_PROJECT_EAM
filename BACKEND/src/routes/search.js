const express = require("express");
const { withConnection } = require("../db");
const { rowsToClients } = require("../util");

const router = express.Router();

router.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) {
    return res.json([]);
  }

  try {
    const rows = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT 'HARDWARE' AS kind,
                TO_CHAR(hardware_id) AS id,
                name,
                asset_tag AS detail
         FROM eam_hardware
         WHERE LOWER(name) LIKE '%' || :q || '%' OR LOWER(asset_tag) LIKE '%' || :q || '%'
         UNION ALL
         SELECT 'SOFTWARE' AS kind,
                TO_CHAR(software_id) AS id,
                name,
                version_label AS detail
         FROM eam_software
         WHERE LOWER(name) LIKE '%' || :q || '%'`,
        { q },
      );
      return rowsToClients(r);
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

module.exports = router;
