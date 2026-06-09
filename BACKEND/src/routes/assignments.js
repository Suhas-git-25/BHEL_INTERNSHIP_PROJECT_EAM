const express = require("express");
const oracledb = require("oracledb");
const { withConnection } = require("../db");
const { rowsToClients } = require("../util");

const router = express.Router();

async function listOpen(req, res) {
  try {
    const rows = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT a.assignment_id, a.holder_id, a.hardware_id, a.software_id,
                a.issued_at, a.returned_at, a.notes, a.issued_by,
                h.full_name AS holder_name, h.email AS holder_email,
                h.department AS holder_department, h.contract_ref AS holder_contract_ref,
                hw.asset_tag, hw.name AS hardware_name, hw.category AS hardware_category,
                hw.model AS hardware_model, hw.contract_ref AS hardware_contract_ref,
                sw.name AS software_name, sw.version_label AS software_version,
                sw.license_type, sw.contract_ref AS software_contract_ref
         FROM eam_assignment a
         JOIN eam_holder h ON h.holder_id = a.holder_id
         LEFT JOIN eam_hardware hw ON hw.hardware_id = a.hardware_id
         LEFT JOIN eam_software sw ON sw.software_id = a.software_id
         WHERE a.returned_at IS NULL
         ORDER BY a.issued_at DESC`,
      );
      return rowsToClients(r);
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load open assignments" });
  }
}

router.get("/open", listOpen);

router.post("/issue-hardware", async (req, res) => {
  const holderId = Number(req.body.holder_id);
  const hardwareId = Number(req.body.hardware_id);
  const notes = req.body.notes || null;
  const issuedBy = Number(req.user.userId);

  if (!holderId || !hardwareId) {
    return res.status(400).json({ error: "holder_id and hardware_id are required" });
  }

  try {
    const row = await withConnection(async (conn) => {
      const hwRows = await conn.execute(
        `SELECT hardware_id, status FROM eam_hardware WHERE hardware_id = :id FOR UPDATE`,
        { id: hardwareId },
      );
      const hw = rowsToClients(hwRows)[0];
      if (!hw) {
        const err = new Error("not_found");
        err.code = "not_found";
        throw err;
      }
      if (hw.status !== "AVAILABLE") {
        const err = new Error("not_available");
        err.code = "not_available";
        throw err;
      }

      const dup = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM eam_assignment
         WHERE hardware_id = :id AND returned_at IS NULL`,
        { id: hardwareId },
      );
      const cntRow = rowsToClients(dup)[0];
      const openCount = cntRow ? Number(cntRow.cnt) : 0;
      if (openCount > 0) {
        const err = new Error("already_issued");
        err.code = "already_issued";
        throw err;
      }

      const ins = await conn.execute(
        `INSERT INTO eam_assignment (holder_id, hardware_id, notes, issued_by)
         VALUES (:holderId, :hardwareId, :notes, :issuedBy)
         RETURNING assignment_id INTO :aid`,
        {
          holderId,
          hardwareId,
          notes,
          issuedBy,
          aid: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        },
      );

      await conn.execute(`UPDATE eam_hardware SET status = 'ISSUED' WHERE hardware_id = :id`, {
        id: hardwareId,
      });

      const aid = ins.outBinds.aid[0];
      const sel = await conn.execute(
        `SELECT a.assignment_id, a.holder_id, a.hardware_id, a.software_id,
                a.issued_at, a.returned_at, a.notes, a.issued_by,
                h.full_name AS holder_name, h.email AS holder_email,
                h.department AS holder_department, h.contract_ref AS holder_contract_ref,
                hw.asset_tag, hw.name AS hardware_name, hw.category AS hardware_category,
                hw.model AS hardware_model, hw.contract_ref AS hardware_contract_ref,
                sw.name AS software_name, sw.version_label AS software_version,
                sw.license_type, sw.contract_ref AS software_contract_ref
         FROM eam_assignment a
         JOIN eam_holder h ON h.holder_id = a.holder_id
         LEFT JOIN eam_hardware hw ON hw.hardware_id = a.hardware_id
         LEFT JOIN eam_software sw ON sw.software_id = a.software_id
         WHERE a.assignment_id = :aid`,
        { aid },
      );

      await conn.commit();
      return rowsToClients(sel)[0];
    });

    res.status(201).json(row);
  } catch (err) {
    if (err.code === "not_found") {
      return res.status(404).json({ error: "Hardware not found" });
    }
    if (err.code === "not_available") {
      return res.status(409).json({ error: "Hardware is not available" });
    }
    if (err.code === "already_issued") {
      return res.status(409).json({ error: "Hardware already has an open assignment" });
    }
    console.error(err);
    res.status(500).json({ error: "Issue transaction failed" });
  }
});

router.post("/issue-software", async (req, res) => {
  const holderId = Number(req.body.holder_id);
  const softwareId = Number(req.body.software_id);
  const notes = req.body.notes || null;
  const issuedBy = Number(req.user.userId);

  if (!holderId || !softwareId) {
    return res.status(400).json({ error: "holder_id and software_id are required" });
  }

  try {
    const row = await withConnection(async (conn) => {
      const swRows = await conn.execute(
        `SELECT software_id, total_licenses, seats_in_use
         FROM eam_software WHERE software_id = :id FOR UPDATE`,
        { id: softwareId },
      );
      const sw = rowsToClients(swRows)[0];
      if (!sw) {
        const err = new Error("not_found");
        err.code = "not_found";
        throw err;
      }

      const total = Number(sw.total_licenses);
      const used = Number(sw.seats_in_use);
      if (total > 0 && used >= total) {
        const err = new Error("no_seats");
        err.code = "no_seats";
        throw err;
      }

      const ins = await conn.execute(
        `INSERT INTO eam_assignment (holder_id, software_id, notes, issued_by)
         VALUES (:holderId, :softwareId, :notes, :issuedBy)
         RETURNING assignment_id INTO :aid`,
        {
          holderId,
          softwareId,
          notes,
          issuedBy,
          aid: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        },
      );

      await conn.execute(
        `UPDATE eam_software SET seats_in_use = seats_in_use + 1 WHERE software_id = :id`,
        { id: softwareId },
      );

      const aid = ins.outBinds.aid[0];
      const sel = await conn.execute(
        `SELECT a.assignment_id, a.holder_id, a.hardware_id, a.software_id,
                a.issued_at, a.returned_at, a.notes, a.issued_by,
                h.full_name AS holder_name, h.email AS holder_email,
                h.department AS holder_department, h.contract_ref AS holder_contract_ref,
                hw.asset_tag, hw.name AS hardware_name, hw.category AS hardware_category,
                hw.model AS hardware_model, hw.contract_ref AS hardware_contract_ref,
                sw.name AS software_name, sw.version_label AS software_version,
                sw.license_type, sw.contract_ref AS software_contract_ref
         FROM eam_assignment a
         JOIN eam_holder h ON h.holder_id = a.holder_id
         LEFT JOIN eam_hardware hw ON hw.hardware_id = a.hardware_id
         LEFT JOIN eam_software sw ON sw.software_id = a.software_id
         WHERE a.assignment_id = :aid`,
        { aid },
      );

      await conn.commit();
      return rowsToClients(sel)[0];
    });

    res.status(201).json(row);
  } catch (err) {
    if (err.code === "not_found") {
      return res.status(404).json({ error: "Software not found" });
    }
    if (err.code === "no_seats") {
      return res.status(409).json({ error: "No available license seats" });
    }
    console.error(err);
    res.status(500).json({ error: "Software issue failed" });
  }
});

router.post("/:id/take-back", async (req, res) => {
  const assignmentId = Number(req.params.id);

  try {
    const row = await withConnection(async (conn) => {
      const cur = await conn.execute(
        `SELECT assignment_id, hardware_id, software_id
         FROM eam_assignment
         WHERE assignment_id = :id AND returned_at IS NULL FOR UPDATE`,
        { id: assignmentId },
      );
      const a = rowsToClients(cur)[0];
      if (!a) {
        const err = new Error("not_found");
        err.code = "not_found";
        throw err;
      }

      await conn.execute(
        `UPDATE eam_assignment SET returned_at = SYSTIMESTAMP WHERE assignment_id = :id`,
        { id: assignmentId },
      );

      if (a.hardware_id != null) {
        await conn.execute(`UPDATE eam_hardware SET status = 'AVAILABLE' WHERE hardware_id = :id`, {
          id: a.hardware_id,
        });
      }

      if (a.software_id != null) {
        await conn.execute(
          `UPDATE eam_software
           SET seats_in_use = GREATEST(seats_in_use - 1, 0)
           WHERE software_id = :id`,
          { id: a.software_id },
        );
      }

      await conn.commit();
      return { ok: true, assignment_id: assignmentId };
    });

    res.json(row);
  } catch (err) {
    if (err.code === "not_found") {
      return res.status(404).json({ error: "Open assignment not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Take-back failed" });
  }
});

module.exports = router;
