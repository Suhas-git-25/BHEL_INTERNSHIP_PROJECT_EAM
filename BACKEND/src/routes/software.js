const express = require("express");
const { withConnection } = require("../db");
const { rowsToClients } = require("../util");

const router = express.Router();

const extraFields = ["platform", "vendor", "date_purchased", "status", "user_owner", "division", "location", "comments"];

function normalizeSoftware(row) {
  if (!row) return row;
  const parsed = parseNotes(row.notes);
  return { ...row, notes: parsed.notes, ...parsed.extra };
}

function parseNotes(notes) {
  if (!notes) return { notes: "", extra: {} };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && parsed.__eam_extra === true) {
      return { notes: parsed.notes || "", extra: parsed.extra || {} };
    }
  } catch {
    /* Existing notes may be plain text. */
  }
  return { notes, extra: { comments: notes } };
}

function packNotes(body) {
  const extra = {};
  for (const field of extraFields) {
    if (body[field] != null && String(body[field]).trim() !== "") {
      extra[field] = String(body[field]).trim();
    }
  }
  const notes = String(body.notes || body.comments || "").trim();
  if (Object.keys(extra).length === 0) {
    return notes || null;
  }
  return JSON.stringify({ __eam_extra: true, notes, extra });
}

router.get("/", async (_req, res) => {
  try {
    const rows = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT software_id, name, version_label, license_type, total_licenses, seats_in_use,
                contract_ref, notes, created_at
         FROM eam_software ORDER BY name`,
      );
      return rowsToClients(r).map(normalizeSoftware);
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list software" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const row = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT software_id, name, version_label, license_type, total_licenses, seats_in_use,
                contract_ref, notes, created_at
         FROM eam_software WHERE software_id = :id`,
        { id: Number(req.params.id) },
      );
      return normalizeSoftware(rowsToClients(r)[0]);
    });
    if (!row) {
      return res.status(404).json({ error: "Software not found" });
    }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load software" });
  }
});

router.post("/", async (req, res) => {
  const body = req.body || {};
  const name = String(body.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const row = await withConnection(async (conn) => {
      const ins = await conn.execute(
        `INSERT INTO eam_software (name, version_label, license_type, total_licenses, seats_in_use, contract_ref, notes)
         VALUES (:name, :versionLabel, :licenseType, NVL(:totalLicenses, 0), NVL(:seatsInUse, 0), :contractRef, :notes)
         RETURNING software_id INTO :sid`,
        {
          name,
          versionLabel: body.version_label || null,
          licenseType: body.license_type || null,
          totalLicenses: body.total_licenses != null ? Number(body.total_licenses) : 0,
          seatsInUse: body.seats_in_use != null ? Number(body.seats_in_use) : 0,
          contractRef: body.contract_ref || null,
          notes: packNotes(body),
        },
      );
      const id = ins.outBinds.sid[0];
      const r = await conn.execute(
        `SELECT software_id, name, version_label, license_type, total_licenses, seats_in_use,
                contract_ref, notes, created_at
         FROM eam_software WHERE software_id = :id`,
        { id },
      );
      await conn.commit();
      return normalizeSoftware(rowsToClients(r)[0]);
    });
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create software" });
  }
});

module.exports = router;
