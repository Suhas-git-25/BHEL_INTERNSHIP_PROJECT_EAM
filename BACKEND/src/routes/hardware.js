const express = require("express");
const { withConnection } = require("../db");
const { rowsToClients } = require("../util");

const router = express.Router();

const extraFields = [
  "platform",
  "make",
  "serial_number",
  "asset_number",
  "asset_group",
  "asset_source",
  "purchase_order",
  "warranty_date",
  "date_received",
  "date_issued",
  "user_name",
  "staff_no",
  "user_account",
  "division",
  "place",
  "location",
  "field_user_address",
  "comments",
];

function normalizeHardware(row) {
  if (!row) return row;
  const parsed = parseNotes(row.notes);
  return {
    ...row,
    notes: parsed.notes,
    ...parsed.extra,
  };
}

function parseNotes(notes) {
  if (!notes) return { notes: "", extra: {} };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && parsed.__eam_extra === true) {
      return { notes: parsed.notes || "", extra: parsed.extra || {} };
    }
  } catch {
    /* Existing imported notes may be plain text. */
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

router.get("/", async (req, res) => {
  const cat = req.query.category;
  try {
    const rows = await withConnection(async (conn) => {
      const binds = {};
      let sql = `SELECT hardware_id, asset_tag, name, category, model, status, contract_ref,
                        purchase_date, notes, created_at
                 FROM eam_hardware`;

      if (cat) {
        sql += ` WHERE LOWER(category) LIKE '%' || LOWER(:cat) || '%'`;
        binds.cat = cat;
      }
      sql += ` ORDER BY asset_tag`;

      const r = await conn.execute(sql, binds);
      return rowsToClients(r).map(normalizeHardware);
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list hardware" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const row = await withConnection(async (conn) => {
      const r = await conn.execute(
        `SELECT hardware_id, asset_tag, name, category, model, status, contract_ref,
                purchase_date, notes, created_at
         FROM eam_hardware WHERE hardware_id = :id`,
        { id: Number(req.params.id) },
      );
      return normalizeHardware(rowsToClients(r)[0]);
    });
    if (!row) {
      return res.status(404).json({ error: "Hardware not found" });
    }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load hardware" });
  }
});

router.post("/", async (req, res) => {
  const body = req.body || {};
  const assetTag = String(body.asset_tag || "").trim();
  const name = String(body.name || "").trim();
  if (!assetTag || !name) {
    return res.status(400).json({ error: "asset_tag and name are required" });
  }

  try {
    const row = await withConnection(async (conn) => {
      const ins = await conn.execute(
        `INSERT INTO eam_hardware (asset_tag, name, category, model, status, contract_ref, purchase_date, notes)
         VALUES (:assetTag, :name, :category, :model, NVL(:status, 'AVAILABLE'), :contractRef, :purchaseDate, :notes)
         RETURNING hardware_id INTO :hid`,
        {
          assetTag,
          name,
          category: body.category || null,
          model: body.model || null,
          status: body.status || "AVAILABLE",
          contractRef: body.contract_ref || null,
          purchaseDate: body.purchase_date ? new Date(body.purchase_date) : null,
          notes: packNotes(body),
        },
      );
      const id = ins.outBinds.hid[0];
      const r = await conn.execute(
        `SELECT hardware_id, asset_tag, name, category, model, status, contract_ref,
                purchase_date, notes, created_at
         FROM eam_hardware WHERE hardware_id = :id`,
        { id },
      );
      await conn.commit();
      return normalizeHardware(rowsToClients(r)[0]);
    });
    res.status(201).json(row);
  } catch (err) {
    if (String(err.message).includes("unique")) {
      return res.status(409).json({ error: "asset_tag must be unique" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create hardware" });
  }
});

module.exports = router;
