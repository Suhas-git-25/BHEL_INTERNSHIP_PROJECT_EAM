import { useEffect, useState } from "react";
import { api } from "../api.js";
import ExcelUpload from "../components/ExcelUpload.jsx";
import Pagination from "../components/Pagination.jsx";
import { usePagination } from "../hooks/usePagination.js";

export default function TakeBackPage() {
  const [open, setOpen] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const rows = await api("/api/assignments/open");
    setOpen(rows);
  }

  useEffect(() => {
    let canceled = false;
    refresh()
      .then(() => {
        if (!canceled) {
          setMessage("");
        }
      })
      .catch((err) => {
        if (!canceled) {
          setError(err.message);
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  async function handleReturn(id) {
    setError("");
    try {
      await api(`/api/assignments/${id}/take-back`, { method: "POST" });
      setMessage(`Assignment ${id} closed.`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  const { page, setPage, totalPages, paginatedItems, pageSize, totalItems } = usePagination(open);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-white">Take back assets</h2>
        <p className="text-sm text-slate-400">Outstanding rows reconcile hardware status / license utilization.</p>
      </header>

      <ExcelUpload
        category="issues"
        sampleFile="Issues.xlsx"
        columnsHint="Bulk return: action = return or remove, holder + asset columns (same as Issue page)"
        onImported={refresh}
      />
      {message ? <div className="rounded-md border border-emerald-900/70 bg-emerald-950/50 px-4 py-3 text-emerald-200">{message}</div> : null}
      {error ? <div className="rounded-md border border-rose-900/70 bg-rose-950/40 px-4 py-3 text-rose-200">{error}</div> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <div className="space-y-3 p-3">
        {paginatedItems.map((row) => (
          <div key={row.assignment_id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Assignment #{row.assignment_id}</div>
                <div className="text-lg font-semibold text-white">{row.holder_name}</div>
                <div className="text-sm text-slate-300">
                  {row.hardware_name ? (
                    <>
                      Hardware · <span className="text-sky-200">{row.asset_tag}</span> {row.hardware_name}
                    </>
                  ) : (
                    <>Software · {row.software_name}</>
                  )}
                </div>
                <div className="text-xs text-slate-500">Issued {row.issued_at}</div>
              </div>
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => handleReturn(row.assignment_id)}
              >
                Process return
              </button>
            </div>
          </div>
        ))}
        {open.length === 0 ? <p className="text-slate-400">No open assignments right now.</p> : null}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalItems}
          pageSize={pageSize}
        />
      </div>
    </div>
  );
}
