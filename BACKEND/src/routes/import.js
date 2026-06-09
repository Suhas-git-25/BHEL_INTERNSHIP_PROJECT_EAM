const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { IMPORT_CATEGORIES, importCategoryBuffer } = require("../services/excelImport");

const router = express.Router();

const SAMPLES_DIR = path.join(__dirname, "..", "..", "..", "samples");

const SAMPLE_FILES = {
  people: "People.xlsx",
  hardware: "Hardware.xlsx",
  software: "Software.xlsx",
  issues: "Issues.xlsx",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const name = (file.originalname || "").toLowerCase();
    const ok =
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel";
    if (!ok) {
      return cb(new Error("Only .xlsx or .xls files are allowed"));
    }
    return cb(null, true);
  },
});

router.get("/categories", (_req, res) => {
  res.json({
    categories: IMPORT_CATEGORIES.map((id) => ({
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      table: {
        people: "eam_holder",
        hardware: "eam_hardware",
        software: "eam_software",
        issues: "eam_assignment",
      }[id],
      sampleFile: SAMPLE_FILES[id],
      uploadEndpoint: `/api/import/${id}`,
      sampleEndpoint: `/api/import/samples/${id}`,
    })),
    recommendedOrder: ["people", "hardware", "software", "issues"],
  });
});

router.get("/samples/:category", (req, res) => {
  const category = String(req.params.category || "").toLowerCase();
  const filename = SAMPLE_FILES[category];
  if (!filename) {
    return res.status(404).json({ error: "Unknown category" });
  }

  const filePath = path.join(SAMPLES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Sample file not found: ${filename}` });
  }

  res.download(filePath, filename);
});

IMPORT_CATEGORIES.forEach((category) => {
  router.post(`/${category}`, upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Excel file is required (form field: file)" });
    }

    try {
      const summary = await importCategoryBuffer(
        req.file.buffer,
        category,
        Number(req.user.userId),
      );
      res.json({
        ok: true,
        category,
        filename: req.file.originalname,
        summary,
      });
    } catch (err) {
      console.error(err);
      res.status(err.status || 500).json({ error: err.message || "Import failed" });
    }
  });
});

router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  return next();
});

module.exports = router;
