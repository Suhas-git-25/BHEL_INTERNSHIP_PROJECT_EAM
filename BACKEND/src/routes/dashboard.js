const express = require("express");
const { withConnection } = require("../db");
const { rowsToClients } = require("../util");

const router = express.Router();

router.get("/activity", async (_req, res) => {
  try {
    const rows = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT a.assignment_id,
                a.holder_id,
                a.hardware_id,
                a.software_id,
                a.issued_at,
                a.returned_at,
                h.full_name AS holder_name,
                hw.asset_tag,
                hw.name AS hardware_name,
                sw.name AS software_name,
                CASE WHEN a.returned_at IS NULL THEN 'OPEN' ELSE 'RETURNED' END AS state
         FROM eam_assignment a
         JOIN eam_holder h ON h.holder_id = a.holder_id
         LEFT JOIN eam_hardware hw ON hw.hardware_id = a.hardware_id
         LEFT JOIN eam_software sw ON sw.software_id = a.software_id
         ORDER BY COALESCE(a.returned_at, a.issued_at) DESC
         LIMIT 40`,
      );
      return rowsToClients(r);
    });

    const softwareFeed = [];
    const hardwareFeed = [];

    rows.forEach((row) => {
      const enriched = {
        assignment_id: row.assignment_id,
        holder_name: row.holder_name,
        issued_at: row.issued_at,
        returned_at: row.returned_at,
        state: row.state,
        label: row.hardware_name || row.software_name,
        asset_tag: row.asset_tag || null,
      };
      if (row.hardware_id != null) {
        hardwareFeed.push(enriched);
      } else {
        softwareFeed.push(enriched);
      }
    });

    res.json({
      software: softwareFeed,
      hardware: hardwareFeed,
      combined: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard activity" });
  }
});

module.exports = router;
