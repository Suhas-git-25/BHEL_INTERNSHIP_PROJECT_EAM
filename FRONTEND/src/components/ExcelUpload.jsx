import { useState } from "react";
import { downloadCategorySample, uploadCategoryExcel } from "../api.js";

export default function ExcelUpload({ category, sampleFile, columnsHint, onImported }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function downloadSample() {
    setError("");
    try {
      const blob = await downloadCategorySample(category);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = sampleFile;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setError("Select an Excel file first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const payload = await uploadCategoryExcel(category, file);
      setResult(payload);
      setFile(null);
      e.target.reset();
      if (onImported) {
        onImported(payload);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const summary = result?.summary;

  return (
    <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-sky-300">Import / remove via Excel</h3>
          <p className="mt-1 text-xs text-slate-500">{columnsHint}</p>
          <p className="mt-1 text-xs text-amber-200/90">
            Use <strong className="font-semibold">action</strong>: leave blank or <code className="text-sky-300">add</code> to
            upsert · <code className="text-sky-300">remove</code> to delete from database
          </p>
        </div>
        <button
          type="button"
          onClick={downloadSample}
          className="shrink-0 rounded-md border border-sky-700 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-950"
        >
          Download {sampleFile}
        </button>
      </div>

      <form onSubmit={handleUpload} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm text-slate-300">
          <span className="sr-only">Excel file</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="mt-1 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-white"
            onChange={(ev) => setFile(ev.target.files?.[0] || null)}
          />
        </label>
        <button
          type="submit"
          disabled={loading || !file}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {loading ? "Importing…" : "Upload Excel"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}

      {summary ? (
        <div className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3 text-sm">
          <p className="font-medium text-emerald-200">
            {result.filename} — {summary.rowCount} rows processed
          </p>
          <p className="mt-1 text-slate-300">
            Inserted {summary.inserted} · Updated {summary.updated} · Removed {summary.removed ?? 0} · Skipped{" "}
            {summary.skipped}
          </p>
          {summary.errors?.length ? (
            <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-rose-300">
              {summary.errors.map((err) => (
                <li key={`${err.row}-${err.message}`}>
                  Row {err.row}: {err.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
