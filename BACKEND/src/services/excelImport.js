const { withConnection } = require("../db");
const { rowsToClients } = require("../util");
const {
  IMPORT_CATEGORIES,
  parseCategoryWorkbook,
  cellString,
  cellNumber,
  cellEmail,
  parseDate,
  parseHolderRef,
  normalizeStatus,
  normalizeImportAction,
  normalizeAction,
} = require("./excelParser");

function resultBucket() {
  return { inserted: 0, updated: 0, removed: 0, skipped: 0, errors: [] };
}

function addError(bucket, row, message) {
  bucket.errors.push({ row, message });
}

async function findHolderId(conn, { email, fullName }) {
  if (email) {
    const r = await conn.execute(
      `SELECT holder_id FROM eam_holder WHERE LOWER(email) = LOWER(:email)`,
      { email },
    );
    const row = rowsToClients(r)[0];
    if (row) {
      return row.holder_id;
    }
  }
  if (fullName) {
    const r = await conn.execute(
      `SELECT holder_id FROM eam_holder WHERE UPPER(full_name) = UPPER(:fullName)`,
      { fullName },
    );
    const row = rowsToClients(r)[0];
    if (row) {
      return row.holder_id;
    }
  }
  return null;
}

async function resolveAssetRef(conn, ref) {
  if (!ref) {
    return { assetTag: null, softwareName: null };
  }

  const hw = await conn.execute(
    `SELECT hardware_id FROM eam_hardware WHERE UPPER(asset_tag) = UPPER(:ref)`,
    { ref },
  );
  if (rowsToClients(hw)[0]) {
    return { assetTag: ref, softwareName: null };
  }

  const sw = await conn.execute(
    `SELECT software_id FROM eam_software WHERE UPPER(name) = UPPER(:ref)`,
    { ref },
  );
  if (rowsToClients(sw)[0]) {
    return { assetTag: null, softwareName: ref };
  }

  if (/^HW[-_]/i.test(ref) || /^[A-Z]{2,5}-\d+/i.test(ref)) {
    return { assetTag: ref, softwareName: null };
  }

  return { assetTag: null, softwareName: ref };
}

async function closeOpenAssignmentsForHolder(conn, holderId) {
  const openHw = await conn.execute(
    `SELECT a.assignment_id, a.hardware_id
     FROM eam_assignment a
     WHERE a.holder_id = :holderId AND a.hardware_id IS NOT NULL AND a.returned_at IS NULL`,
    { holderId },
  );
  for (const row of rowsToClients(openHw)) {
    await conn.execute(
      `UPDATE eam_assignment SET returned_at = SYSTIMESTAMP WHERE assignment_id = :id`,
      { id: row.assignment_id },
    );
    await conn.execute(`UPDATE eam_hardware SET status = 'AVAILABLE' WHERE hardware_id = :id`, {
      id: row.hardware_id,
    });
  }

  const openSw = await conn.execute(
    `SELECT a.assignment_id, a.software_id
     FROM eam_assignment a
     WHERE a.holder_id = :holderId AND a.software_id IS NOT NULL AND a.returned_at IS NULL`,
    { holderId },
  );
  for (const row of rowsToClients(openSw)) {
    await conn.execute(
      `UPDATE eam_assignment SET returned_at = SYSTIMESTAMP WHERE assignment_id = :id`,
      { id: row.assignment_id },
    );
    await conn.execute(
      `UPDATE eam_software SET seats_in_use = GREATEST(seats_in_use - 1, 0) WHERE software_id = :id`,
      { id: row.software_id },
    );
  }
}

async function removePerson(conn, row, bucket) {
  const email = cellEmail(row.email);
  const fullName = cellString(row.full_name);

  if (!email && !fullName) {
    addError(bucket, row.__row, "email or full_name required to remove a person");
    bucket.skipped += 1;
    return;
  }

  const holderId = await findHolderId(conn, { email, fullName });
  if (!holderId) {
    addError(bucket, row.__row, "Person not found");
    bucket.skipped += 1;
    return;
  }

  await closeOpenAssignmentsForHolder(conn, holderId);
  await conn.execute(`DELETE FROM eam_assignment WHERE holder_id = :id`, { id: holderId });
  const del = await conn.execute(`DELETE FROM eam_holder WHERE holder_id = :id`, { id: holderId });
  if (del.rowsAffected) {
    bucket.removed += 1;
  } else {
    addError(bucket, row.__row, "Person could not be deleted");
    bucket.skipped += 1;
  }
}

async function removeHardware(conn, row, bucket) {
  const assetTag = cellString(row.asset_tag);
  if (!assetTag) {
    addError(bucket, row.__row, "asset_tag is required to remove hardware");
    bucket.skipped += 1;
    return;
  }

  const hwRows = await conn.execute(
    `SELECT hardware_id FROM eam_hardware WHERE UPPER(asset_tag) = UPPER(:assetTag)`,
    { assetTag },
  );
  const hw = rowsToClients(hwRows)[0];
  if (!hw) {
    addError(bucket, row.__row, `Hardware not found: ${assetTag}`);
    bucket.skipped += 1;
    return;
  }

  const open = await conn.execute(
    `SELECT assignment_id FROM eam_assignment
     WHERE hardware_id = :id AND returned_at IS NULL`,
    { id: hw.hardware_id },
  );
  for (const a of rowsToClients(open)) {
    await conn.execute(
      `UPDATE eam_assignment SET returned_at = SYSTIMESTAMP WHERE assignment_id = :aid`,
      { aid: a.assignment_id },
    );
  }

  await conn.execute(`DELETE FROM eam_assignment WHERE hardware_id = :id`, { id: hw.hardware_id });
  const del = await conn.execute(`DELETE FROM eam_hardware WHERE hardware_id = :id`, {
    id: hw.hardware_id,
  });
  if (del.rowsAffected) {
    bucket.removed += 1;
  } else {
    addError(bucket, row.__row, "Hardware could not be deleted");
    bucket.skipped += 1;
  }
}

async function removeSoftware(conn, row, bucket) {
  const name = cellString(row.name);
  const versionLabel = cellString(row.version_label) || "-";

  if (!name) {
    addError(bucket, row.__row, "name is required to remove software");
    bucket.skipped += 1;
    return;
  }

  const swRows = await conn.execute(
    `SELECT software_id FROM eam_software
     WHERE UPPER(name) = UPPER(:name) AND NVL(version_label, '-') = :versionLabel`,
    { name, versionLabel },
  );
  const sw = rowsToClients(swRows)[0];
  if (!sw) {
    addError(bucket, row.__row, `Software not found: ${name}`);
    bucket.skipped += 1;
    return;
  }

  const open = await conn.execute(
    `SELECT assignment_id FROM eam_assignment
     WHERE software_id = :id AND returned_at IS NULL`,
    { id: sw.software_id },
  );
  for (const a of rowsToClients(open)) {
    await conn.execute(
      `UPDATE eam_assignment SET returned_at = SYSTIMESTAMP WHERE assignment_id = :aid`,
      { aid: a.assignment_id },
    );
  }

  await conn.execute(`DELETE FROM eam_assignment WHERE software_id = :id`, { id: sw.software_id });
  const del = await conn.execute(`DELETE FROM eam_software WHERE software_id = :id`, {
    id: sw.software_id,
  });
  if (del.rowsAffected) {
    bucket.removed += 1;
  } else {
    addError(bucket, row.__row, "Software could not be deleted");
    bucket.skipped += 1;
  }
}

async function importPeople(conn, rows, bucket) {
  for (const row of rows) {
    const rowAction = normalizeImportAction(row.action);

    if (rowAction === "remove") {
      try {
        await removePerson(conn, row, bucket);
      } catch (err) {
        addError(bucket, row.__row, err.message);
        bucket.skipped += 1;
      }
      continue;
    }

    const fullName = cellString(row.full_name);
    const email = cellEmail(row.email);
    const department = cellString(row.department);
    const contractRef = cellString(row.contract_ref);

    if (!fullName) {
      addError(bucket, row.__row, "full_name is required");
      bucket.skipped += 1;
      continue;
    }

    try {
      if (email) {
        const existing = await conn.execute(
          `SELECT holder_id FROM eam_holder WHERE LOWER(email) = :email`,
          { email },
        );
        const hit = rowsToClients(existing)[0];
        if (hit) {
          await conn.execute(
            `UPDATE eam_holder
             SET full_name = :fullName,
                 department = :department,
                 contract_ref = :contractRef
             WHERE holder_id = :id`,
            { fullName, department, contractRef, id: hit.holder_id },
          );
          bucket.updated += 1;
          continue;
        }
      }

      await conn.execute(
        `INSERT INTO eam_holder (full_name, email, department, contract_ref)
         VALUES (:fullName, :email, :department, :contractRef)`,
        { fullName, email, department, contractRef },
      );
      bucket.inserted += 1;
    } catch (err) {
      addError(bucket, row.__row, err.message);
      bucket.skipped += 1;
    }
  }
}

async function importHardware(conn, rows, bucket) {
  for (const row of rows) {
    const rowAction = normalizeImportAction(row.action);

    if (rowAction === "remove") {
      try {
        await removeHardware(conn, row, bucket);
      } catch (err) {
        addError(bucket, row.__row, err.message);
        bucket.skipped += 1;
      }
      continue;
    }

    const assetTag = cellString(row.asset_tag);
    const name = cellString(row.name);
    const category = cellString(row.category);
    const model = cellString(row.model);
    const status = normalizeStatus(row.status);
    const contractRef = cellString(row.contract_ref);
    const purchaseDate = parseDate(row.purchase_date);
    const notes = cellString(row.notes);

    if (!assetTag || !name) {
      addError(bucket, row.__row, "asset_tag and name are required");
      bucket.skipped += 1;
      continue;
    }

    try {
      const existing = await conn.execute(
        `SELECT hardware_id FROM eam_hardware WHERE UPPER(asset_tag) = UPPER(:assetTag)`,
        { assetTag },
      );
      const hit = rowsToClients(existing)[0];
      if (hit) {
        await conn.execute(
          `UPDATE eam_hardware
           SET name = :name,
               category = :category,
               model = :model,
               status = :status,
               contract_ref = :contractRef,
               purchase_date = :purchaseDate,
               notes = :notes
           WHERE hardware_id = :id`,
          { name, category, model, status, contractRef, purchaseDate, notes, id: hit.hardware_id },
        );
        bucket.updated += 1;
      } else {
        await conn.execute(
          `INSERT INTO eam_hardware (asset_tag, name, category, model, status, contract_ref, purchase_date, notes)
           VALUES (:assetTag, :name, :category, :model, :status, :contractRef, :purchaseDate, :notes)`,
          { assetTag, name, category, model, status, contractRef, purchaseDate, notes },
        );
        bucket.inserted += 1;
      }
    } catch (err) {
      addError(bucket, row.__row, err.message);
      bucket.skipped += 1;
    }
  }
}

async function importSoftware(conn, rows, bucket) {
  for (const row of rows) {
    const rowAction = normalizeImportAction(row.action);

    if (rowAction === "remove") {
      try {
        await removeSoftware(conn, row, bucket);
      } catch (err) {
        addError(bucket, row.__row, err.message);
        bucket.skipped += 1;
      }
      continue;
    }

    const name = cellString(row.name);
    const versionLabel = cellString(row.version_label) || "-";
    const licenseType = cellString(row.license_type);
    const totalLicenses = cellNumber(row.total_licenses);
    const seatsInUse = cellNumber(row.seats_in_use);
    const contractRef = cellString(row.contract_ref);
    const notes = cellString(row.notes);

    if (!name) {
      addError(bucket, row.__row, "name is required");
      bucket.skipped += 1;
      continue;
    }

    try {
      const existing = await conn.execute(
        `SELECT software_id FROM eam_software
         WHERE UPPER(name) = UPPER(:name)
           AND NVL(version_label, '-') = :versionLabel`,
        { name, versionLabel },
      );
      const hit = rowsToClients(existing)[0];
      if (hit) {
        await conn.execute(
          `UPDATE eam_software
           SET license_type = :licenseType,
               total_licenses = NVL(:totalLicenses, total_licenses),
               seats_in_use = NVL(:seatsInUse, seats_in_use),
               contract_ref = :contractRef,
               notes = :notes
           WHERE software_id = :id`,
          {
            licenseType,
            totalLicenses,
            seatsInUse,
            contractRef,
            notes,
            id: hit.software_id,
          },
        );
        bucket.updated += 1;
      } else {
        await conn.execute(
          `INSERT INTO eam_software (name, version_label, license_type, total_licenses, seats_in_use, contract_ref, notes)
           VALUES (:name, :versionLabel, :licenseType, NVL(:totalLicenses, 0), NVL(:seatsInUse, 0), :contractRef, :notes)`,
          { name, versionLabel, licenseType, totalLicenses, seatsInUse, contractRef, notes },
        );
        bucket.inserted += 1;
      }
    } catch (err) {
      addError(bucket, row.__row, err.message);
      bucket.skipped += 1;
    }
  }
}

async function issueHardware(conn, holderId, assetTag, notes, issuedBy, rowNum, bucket) {
  const hwRows = await conn.execute(
    `SELECT hardware_id, status FROM eam_hardware WHERE UPPER(asset_tag) = UPPER(:assetTag) FOR UPDATE`,
    { assetTag },
  );
  const hw = rowsToClients(hwRows)[0];
  if (!hw) {
    addError(bucket, rowNum, `Hardware not found: ${assetTag}`);
    bucket.skipped += 1;
    return;
  }
  if (hw.status !== "AVAILABLE") {
    addError(bucket, rowNum, `Hardware ${assetTag} is not AVAILABLE`);
    bucket.skipped += 1;
    return;
  }

  const dup = await conn.execute(
    `SELECT COUNT(*) AS cnt FROM eam_assignment WHERE hardware_id = :id AND returned_at IS NULL`,
    { id: hw.hardware_id },
  );
  if (Number(rowsToClients(dup)[0].cnt) > 0) {
    addError(bucket, rowNum, `Hardware ${assetTag} already has an open assignment`);
    bucket.skipped += 1;
    return;
  }

  await conn.execute(
    `INSERT INTO eam_assignment (holder_id, hardware_id, notes, issued_by)
     VALUES (:holderId, :hardwareId, :notes, :issuedBy)`,
    { holderId, hardwareId: hw.hardware_id, notes, issuedBy },
  );
  await conn.execute(`UPDATE eam_hardware SET status = 'ISSUED' WHERE hardware_id = :id`, {
    id: hw.hardware_id,
  });
  bucket.inserted += 1;
}

async function returnHardware(conn, holderId, assetTag, rowNum, bucket) {
  const hwRows = await conn.execute(
    `SELECT hardware_id FROM eam_hardware WHERE UPPER(asset_tag) = UPPER(:assetTag)`,
    { assetTag },
  );
  const hw = rowsToClients(hwRows)[0];
  if (!hw) {
    addError(bucket, rowNum, `Hardware not found: ${assetTag}`);
    bucket.skipped += 1;
    return;
  }

  const open = await conn.execute(
    `SELECT assignment_id FROM eam_assignment
     WHERE holder_id = :holderId AND hardware_id = :hardwareId AND returned_at IS NULL
     FOR UPDATE`,
    { holderId, hardwareId: hw.hardware_id },
  );
  const assignment = rowsToClients(open)[0];
  if (!assignment) {
    addError(bucket, rowNum, `No open hardware assignment for ${assetTag}`);
    bucket.skipped += 1;
    return;
  }

  await conn.execute(
    `UPDATE eam_assignment SET returned_at = SYSTIMESTAMP WHERE assignment_id = :id`,
    { id: assignment.assignment_id },
  );
  await conn.execute(`UPDATE eam_hardware SET status = 'AVAILABLE' WHERE hardware_id = :id`, {
    id: hw.hardware_id,
  });
  bucket.updated += 1;
}

async function issueSoftware(conn, holderId, softwareName, softwareVersion, notes, issuedBy, rowNum, bucket) {
  const versionLabel = softwareVersion || "-";
  const swRows = await conn.execute(
    `SELECT software_id, total_licenses, seats_in_use FROM eam_software
     WHERE UPPER(name) = UPPER(:name) AND NVL(version_label, '-') = :versionLabel
     FOR UPDATE`,
    { name: softwareName, versionLabel },
  );
  const sw = rowsToClients(swRows)[0];
  if (!sw) {
    addError(bucket, rowNum, `Software not found: ${softwareName} (${versionLabel})`);
    bucket.skipped += 1;
    return;
  }

  const total = Number(sw.total_licenses);
  const used = Number(sw.seats_in_use);
  if (total > 0 && used >= total) {
    addError(bucket, rowNum, `No seats available for ${softwareName}`);
    bucket.skipped += 1;
    return;
  }

  await conn.execute(
    `INSERT INTO eam_assignment (holder_id, software_id, notes, issued_by)
     VALUES (:holderId, :softwareId, :notes, :issuedBy)`,
    { holderId, softwareId: sw.software_id, notes, issuedBy },
  );
  await conn.execute(
    `UPDATE eam_software SET seats_in_use = seats_in_use + 1 WHERE software_id = :id`,
    { id: sw.software_id },
  );
  bucket.inserted += 1;
}

async function returnSoftware(conn, holderId, softwareName, softwareVersion, rowNum, bucket) {
  const versionLabel = softwareVersion || "-";
  const swRows = await conn.execute(
    `SELECT software_id FROM eam_software
     WHERE UPPER(name) = UPPER(:name) AND NVL(version_label, '-') = :versionLabel`,
    { name: softwareName, versionLabel },
  );
  const sw = rowsToClients(swRows)[0];
  if (!sw) {
    addError(bucket, rowNum, `Software not found: ${softwareName}`);
    bucket.skipped += 1;
    return;
  }

  const open = await conn.execute(
    `SELECT assignment_id FROM (
       SELECT assignment_id FROM eam_assignment
       WHERE holder_id = :holderId AND software_id = :softwareId AND returned_at IS NULL
       ORDER BY issued_at DESC
     ) WHERE ROWNUM = 1 FOR UPDATE`,
    { holderId, softwareId: sw.software_id },
  );
  const assignment = rowsToClients(open)[0];
  if (!assignment) {
    addError(bucket, rowNum, `No open software assignment for ${softwareName}`);
    bucket.skipped += 1;
    return;
  }

  await conn.execute(
    `UPDATE eam_assignment SET returned_at = SYSTIMESTAMP WHERE assignment_id = :id`,
    { id: assignment.assignment_id },
  );
  await conn.execute(
    `UPDATE eam_software SET seats_in_use = GREATEST(seats_in_use - 1, 0) WHERE software_id = :id`,
    { id: sw.software_id },
  );
  bucket.updated += 1;
}

async function importIssues(conn, rows, bucket, issuedBy) {
  for (const row of rows) {
    const action = normalizeAction(row.action);
    const holderFromRef = parseHolderRef(row.holder_ref);
    const holderEmail = cellEmail(row.holder_email) || holderFromRef.email;
    const holderName = cellString(row.holder_name) || holderFromRef.fullName;
    const softwareVersion = cellString(row.software_version) || cellString(row.version_label);
    const notes = cellString(row.notes);

    const explicitTag = cellString(row.hardware_asset_tag);
    const explicitSw = cellString(row.software_name);
    const combinedRef = cellString(row.asset_ref);

    let assetTag = explicitTag;
    let softwareName = explicitSw;

    if (!assetTag && !softwareName && combinedRef) {
      try {
        const resolved = await resolveAssetRef(conn, combinedRef);
        assetTag = resolved.assetTag;
        softwareName = resolved.softwareName;
      } catch (err) {
        addError(bucket, row.__row, err.message);
        bucket.skipped += 1;
        continue;
      }
    }

    if (!action) {
      addError(bucket, row.__row, "action must be issue, return, or remove");
      bucket.skipped += 1;
      continue;
    }
    if (!holderEmail && !holderName) {
      addError(bucket, row.__row, "holder email or name is required");
      bucket.skipped += 1;
      continue;
    }
    if (!assetTag && !softwareName) {
      addError(bucket, row.__row, "asset reference (HW tag or software name) is required");
      bucket.skipped += 1;
      continue;
    }
    if (assetTag && softwareName) {
      addError(bucket, row.__row, "Provide hardware tag OR software name, not both");
      bucket.skipped += 1;
      continue;
    }

    try {
      const holderId = await findHolderId(conn, { email: holderEmail, fullName: holderName });
      if (!holderId) {
        addError(bucket, row.__row, "Holder not found — import People first");
        bucket.skipped += 1;
        continue;
      }

      if (action === "issue") {
        if (assetTag) {
          await issueHardware(conn, holderId, assetTag, notes, issuedBy, row.__row, bucket);
        } else {
          await issueSoftware(
            conn,
            holderId,
            softwareName,
            softwareVersion,
            notes,
            issuedBy,
            row.__row,
            bucket,
          );
        }
      } else if (action === "return") {
        if (assetTag) {
          await returnHardware(conn, holderId, assetTag, row.__row, bucket);
        } else {
          await returnSoftware(conn, holderId, softwareName, softwareVersion, row.__row, bucket);
        }
      } else if (action === "remove") {
        if (assetTag) {
          await returnHardware(conn, holderId, assetTag, row.__row, bucket);
        } else {
          await returnSoftware(conn, holderId, softwareName, softwareVersion, row.__row, bucket);
        }
      } else {
        addError(bucket, row.__row, `Unknown action: ${action}`);
        bucket.skipped += 1;
      }
    } catch (err) {
      addError(bucket, row.__row, err.message);
      bucket.skipped += 1;
    }
  }
}

const IMPORT_HANDLERS = {
  people: importPeople,
  hardware: importHardware,
  software: importSoftware,
  issues: importIssues,
};

async function importCategoryBuffer(buffer, category, issuedBy) {
  if (!IMPORT_CATEGORIES.includes(category)) {
    const err = new Error(`Invalid category. Use: ${IMPORT_CATEGORIES.join(", ")}`);
    err.status = 400;
    throw err;
  }

  const { sheetName, rows } = parseCategoryWorkbook(buffer, category);
  const summary = resultBucket();

  await withConnection(async (conn) => {
    const handler = IMPORT_HANDLERS[category];
    if (category === "issues") {
      await handler(conn, rows, summary, issuedBy);
    } else {
      await handler(conn, rows, summary);
    }
    await conn.commit();
  });

  return {
    category,
    sheetName,
    rowCount: rows.length,
    ...summary,
  };
}

module.exports = {
  IMPORT_CATEGORIES,
  importCategoryBuffer,
};
