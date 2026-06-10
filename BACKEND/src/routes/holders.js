const express = require("express");
const { withConnection } = require("../db");
const { rowsToClients } = require("../util");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT holder_id, full_name, email, department, contract_ref
         FROM eam_holder ORDER BY full_name`,
      );
      return rowsToClients(r);
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list holders" });
  }
});

router.post("/", async (req, res) => {
  const { full_name: fullName, email, department, contract_ref } = req.body || {};
  if (!fullName) {
    return res.status(400).json({ error: "full_name is required" });
  }

  const emailClean = email ? String(email).trim().toLowerCase() : null;

  try {
    const row = await withConnection(async (conn) => {
      const ins = await conn.execute(
        `INSERT INTO eam_holder (full_name, email, department, contract_ref)
         VALUES (:fullName, :email, :department, :contractRef)
         RETURNING holder_id INTO :hid`,
        {
          fullName,
          email: emailClean,
          department: department || null,
          contractRef: contract_ref || null,
        },
      );
      const holderId = ins.outBinds.hid[0];
      const r = await conn.execute(
        `SELECT holder_id, full_name, email, department, contract_ref
         FROM eam_holder WHERE holder_id = :id`,
        { id: holderId },
      );
      await conn.commit();
      return rowsToClients(r)[0];
    });
    res.status(201).json(row);
  } catch (err) {
    if (String(err.message).includes("unique")) {
      return res.status(409).json({ error: "Email already exists for another holder" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create holder" });
  }
});

module.exports = router;
