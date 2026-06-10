import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Pagination from "../components/Pagination.jsx";
import { usePagination } from "../hooks/usePagination.js";

export default function SearchPage() {
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!term.trim()) {
      setRows([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      api(`/api/search?q=${encodeURIComponent(term.trim())}`)
        .then((data) => setRows(data))
        .catch((err) => setError(err.message));
    }, 300);
    return () => clearTimeout(timer);
  }, [term]);

  const { page, setPage, totalPages, paginatedItems, pageSize, totalItems } = usePagination(rows);

  useEffect(() => {
    setPage(1);
  }, [term, setPage]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-white">Search catalog</h2>
        <p className="text-sm text-slate-400">
          Unified fuzzy lookup across hardware tags &amp; software titles.
          <Link className="ml-2 text-sky-300 underline" to="/hardware">
            Jump to browse
          </Link>
          .
        </p>
      </header>
      <input
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none ring-sky-500 focus:ring"
        placeholder="Start typing..."
        value={term}
        onChange={(e) => {
          setError("");
          setTerm(e.target.value);
        }}
      />
      {error ? <p className="text-rose-400">{error}</p> : null}

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <ul className="space-y-3 p-3">
            {paginatedItems.map((r) => (
              <li key={`${r.kind}-${r.id}`} className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{r.kind}</div>
                <div className="text-lg font-semibold text-white">{r.name}</div>
                <div className="text-sm text-slate-400">{r.detail}</div>
                <Link
                  className="text-xs text-sky-300 underline"
                  to={r.kind === "HARDWARE" ? "/hardware" : "/software"}
                >
                  Manage in module
                </Link>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={totalItems}
            pageSize={pageSize}
          />
        </div>
      ) : null}
      {term && rows.length === 0 && !error ? <p className="text-slate-400">Nothing matched.</p> : null}
    </div>
  );
}
