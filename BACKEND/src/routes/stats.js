const express = require("express");
const { withConnection } = require("../db");
const { rowsToClients } = require("../util");

const router = express.Router();

router.get("/contracts", async (_req, res) => {
  try {
    const byHolder = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT NVL(h.contract_ref, '(none)') AS contract_ref,
                COUNT(*) AS open_assignments
         FROM eam_assignment a
         JOIN eam_holder h ON h.holder_id = a.holder_id
         WHERE a.returned_at IS NULL
         GROUP BY h.contract_ref
         ORDER BY open_assignments DESC`,
      );
      return rowsToClients(r);
    });

    const byHardware = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT NVL(contract_ref, '(none)') AS contract_ref,
                COUNT(*) AS hardware_units
         FROM eam_hardware
         GROUP BY contract_ref
         ORDER BY hardware_units DESC`,
      );
      return rowsToClients(r);
    });

    const bySoftware = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT NVL(contract_ref, '(none)') AS contract_ref,
                SUM(seats_in_use) AS seats_in_use,
                SUM(total_licenses) AS total_licenses
         FROM eam_software
         GROUP BY contract_ref
         ORDER BY seats_in_use DESC`,
      );
      return rowsToClients(r);
    });

    res.json({ open_by_holder_contract: byHolder, hardware_by_contract: byHardware, software_by_contract: bySoftware });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/summary", async (_req, res) => {
  try {
    const counts = await withConnection(async (conn) => {
      const hw = await conn.execute(`SELECT COUNT(*) AS c FROM eam_hardware`, []);
      const sw = await conn.execute(`SELECT COUNT(*) AS c FROM eam_software`, []);
      const open = await conn.execute(
        `SELECT COUNT(*) AS c FROM eam_assignment WHERE returned_at IS NULL`,
        [],
      );
      return {
        hardware: Number(rowsToClients(hw)[0].c),
        software: Number(rowsToClients(sw)[0].c),
        open_assignments: Number(rowsToClients(open)[0].c),
      };
    });
    res.json(counts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

module.exports = router;
