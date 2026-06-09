const XLSX = require("xlsx");

const IMPORT_CATEGORIES = ["people", "hardware", "software", "issues"];

const SHEET_ALIASES = {
  people: ["people", "holders", "holder", "employees"],
  hardware: ["hardware", "hw"],
  software: ["software", "sw", "licenses"],
  issues: ["issues", "assignments", "issue", "transactions"],
};

const COLUMN_ALIASES = {
  full_name: ["full_name", "fullname", "employee_name", "person"],
  email: ["email", "email_address"],
  department: ["department", "dept"],
  contract_ref: ["contract_ref", "contract", "contract_reference", "contract_id"],
  asset_tag: ["asset_tag", "tag", "asset_id", "serial"],
  name: ["name", "product_name", "title"],
  category: ["category", "type", "asset_type"],
  model: ["model", "model_number"],
  status: ["status", "asset_status"],
  purchase_date: ["purchase_date", "purchased", "purchase_dt", "date_purchased"],
  notes: ["notes", "note", "comments", "remark"],
  version_label: ["version_label", "version", "ver", "software_version"],
  license_type: ["license_type", "licence_type", "license"],
  total_licenses: ["total_licenses", "total_seats", "seats", "licenses"],
  seats_in_use: ["seats_in_use", "used_seats", "in_use"],
  action: ["action", "operation", "transaction"],
  holder_email: ["holder_email", "person_email", "employee_email"],
  holder_name: ["holder_name", "person_name", "employee_name"],
  holder_ref: [
    "holder_email_or_holder_name",
    "holder_email_or_name",
    "holder_ref",
    "assignee",
    "holder",
  ],
  hardware_asset_tag: ["hardware_asset_tag", "hw_tag", "hardware_tag"],
  software_name: ["software_name", "sw_name", "license_name"],
  software_version: ["software_version", "sw_version"],
  asset_ref: [
    "hardware_asset_tag_or_software_name",
    "hardware_asset_tag_or_software",
    "asset_ref",
    "asset",
  ],
};

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\*+/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveCanonical(header) {
  const key = normalizeKey(header);
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(key)) {
      return canonical;
    }
  }
  return key;
}

function cellString(value) {
  if (value == null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  return text === "" ? null : text;
}

function cellNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function cellEmail(value) {
  const text = cellString(value);
  return text ? text.toLowerCase() : null;
}

function parseDate(value) {
  if (value == null || value === "") {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const text = String(value).trim();
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  const excelSerial = Number(text);
  if (Number.isFinite(excelSerial) && excelSerial > 20000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + excelSerial);
    return epoch;
  }
  return null;
}

function normalizeStatus(value) {
  const text = cellString(value);
  if (!text) {
    return "AVAILABLE";
  }
  const upper = text.toUpperCase();
  if (["AVAILABLE", "ISSUED", "RETIRED"].includes(upper)) {
    return upper;
  }
  if (upper === "ACTIVE" || upper === "IN STOCK" || upper === "INVENTORY") {
    return "AVAILABLE";
  }
  if (upper.includes("ISSUE") || upper === "IN USE" || upper === "ASSIGNED") {
    return "ISSUED";
  }
  if (upper.includes("RETIRE") || upper === "DISPOSED" || upper === "INACTIVE") {
    return "RETIRED";
  }
  return "AVAILABLE";
}

function normalizeImportAction(value) {
  const text = cellString(value);
  if (!text) {
    return "upsert";
  }
  const lower = text.toLowerCase();
  if (["remove", "delete", "del", "drop"].includes(lower)) {
    return "remove";
  }
  if (["add", "upsert", "update", "insert", "create"].includes(lower)) {
    return "upsert";
  }
  return lower;
}

function normalizeAction(value) {
  const text = cellString(value);
  if (!text) {
    return null;
  }
  const lower = text.toLowerCase();
  if (["issue", "assign", "issued", "allocate", "add"].includes(lower)) {
    return "issue";
  }
  if (
    ["return", "take back", "takeback", "take_back", "returned", "close", "remove", "delete"].includes(
      lower,
    )
  ) {
    return "return";
  }
  return lower;
}

function parseHolderRef(value) {
  const text = cellString(value);
  if (!text) {
    return { email: null, fullName: null };
  }
  if (text.includes("@")) {
    return { email: cellEmail(text), fullName: null };
  }
  return { email: null, fullName: text };
}

function findSheet(workbook, aliases) {
  const names = workbook.SheetNames.map((n) => ({ raw: n, norm: normalizeKey(n) }));
  for (const alias of aliases) {
    const hit = names.find((n) => n.norm === alias);
    if (hit) {
      return hit.raw;
    }
  }
  return null;
}

function matrixToRows(matrix) {
  if (!matrix.length) {
    return [];
  }
  const headerRow = matrix[0].map((h) => resolveCanonical(h));
  const rows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i];
    if (!line || line.every((c) => c == null || String(c).trim() === "")) {
      continue;
    }
    const obj = { __row: i + 1 };
    headerRow.forEach((key, idx) => {
      if (key) {
        obj[key] = line[idx];
      }
    });
    rows.push(obj);
  }
  return rows;
}

function sheetToRows(workbook, sheetAliases) {
  const sheetName = findSheet(workbook, sheetAliases);
  if (!sheetName) {
    return { sheetName: null, rows: [] };
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  return { sheetName, rows: matrixToRows(matrix) };
}

function parseCategoryWorkbook(buffer, category) {
  if (!IMPORT_CATEGORIES.includes(category)) {
    const err = new Error(`Invalid category: ${category}`);
    err.status = 400;
    throw err;
  }

  const workbook = buildWorkbookFromBuffer(buffer);
  let sheetName = findSheet(workbook, SHEET_ALIASES[category]);

  if (!sheetName && workbook.SheetNames.length === 1) {
    [sheetName] = workbook.SheetNames;
  }
  if (!sheetName && workbook.SheetNames.length > 0) {
    [sheetName] = workbook.SheetNames;
  }

  if (!sheetName) {
    const err = new Error("Workbook has no sheets");
    err.status = 400;
    throw err;
  }

  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: false,
  });
  const rows = matrixToRows(matrix);

  if (!rows.length) {
    const err = new Error("No data rows found (row 1 must be headers, data from row 2)");
    err.status = 400;
    throw err;
  }

  return { sheetName, rows, category };
}

function buildWorkbookFromBuffer(buffer) {
  return XLSX.read(buffer, { type: "buffer", cellDates: true });
}

module.exports = {
  IMPORT_CATEGORIES,
  SHEET_ALIASES,
  buildWorkbookFromBuffer,
  parseCategoryWorkbook,
  sheetToRows,
  cellString,
  cellNumber,
  cellEmail,
  parseDate,
  parseHolderRef,
  normalizeStatus,
  normalizeImportAction,
  normalizeAction,
};
