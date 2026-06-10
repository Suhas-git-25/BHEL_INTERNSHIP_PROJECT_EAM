const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const samplesDir = path.join(__dirname, "..", "..", "samples");

function prependActionColumn(filePath, sheetName, removeExampleRow) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (!rows.length) {
    return;
  }

  const header = rows[0];
  if (String(header[0] || "").toLowerCase().includes("action")) {
    console.log("Skip (already has action):", filePath);
    return;
  }

  const newRows = [[`action*`, ...header]];
  for (let i = 1; i < rows.length; i += 1) {
    newRows.push(["add", ...rows[i]]);
  }
  if (removeExampleRow) {
    newRows.push(removeExampleRow);
  }

  const newSheet = XLSX.utils.aoa_to_sheet(newRows);
  wb.Sheets[sheetName] = newSheet;
  XLSX.writeFile(wb, filePath);
  console.log("Updated:", filePath);
}

prependActionColumn(path.join(samplesDir, "People.xlsx"), "People", [
  "remove",
  "",
  "bob.martinez@company.com",
  "",
  "",
]);

prependActionColumn(path.join(samplesDir, "Hardware.xlsx"), "Hardware", [
  "remove",
  "HW-0999",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
]);

prependActionColumn(path.join(samplesDir, "Software.xlsx"), "Software", [
  "remove",
  "Old Product",
  "1.0",
  "",
  "",
  "",
  "",
  "",
]);

console.log("Issues.xlsx already uses action column (issue | return | remove).");
