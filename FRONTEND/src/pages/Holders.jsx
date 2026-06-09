import { useEffect, useState } from "react";
import { api } from "../api.js";
import ExcelUpload from "../components/ExcelUpload.jsx";
import Pagination from "../components/Pagination.jsx";
import { usePagination } from "../hooks/usePagination.js";

export default function HoldersPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    department: "",
    contract_ref: "",
  });

  async function refresh() {
    const data = await api("/api/holders");
    setRows(data);
  }

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const data = await api("/api/holders");
        if (!canceled) {
          setRows(data);
        }
      } catch (err) {
        if (!canceled) {
          setError(err.message);
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const { page, setPage, totalPages, paginatedItems, pageSize, totalItems } = usePagination(rows);

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/holders", { method: "POST", body: form });
      setForm({ full_name: "", email: "", department: "", contract_ref: "" });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold text-white">People receiving assets</h2>
        <p className="text-sm text-slate-400">Each row correlates with contract attribution for analytics.</p>
      </header>

      <ExcelUpload
        category="people"
        sampleFile="People.xlsx"
        columnsHint="action (add | remove), full_name*, email, department, contract_ref"
        onImported={refresh}
      />

      <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:grid-cols-2">
        <label className="text-sm md:col-span-2">
          Full name
          <input
            required
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Email (optional unique)
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Department
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
        </label>
        <label className="text-sm md:col-span-2">
          Contract ref (for assignment stats)
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            value={form.contract_ref}
            onChange={(e) => setForm({ ...form, contract_ref: e.target.value })}
          />
        </label>
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
            Add person
          </button>
        </div>
      </form>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Department</th>
              <th className="px-3 py-2 text-left">Contract</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 bg-slate-950/60">
            {paginatedItems.map((r) => (
              <tr key={r.holder_id}>
                <td className="px-3 py-2 font-semibold text-white">{r.full_name}</td>
                <td className="px-3 py-2">{r.email || "—"}</td>
                <td className="px-3 py-2">{r.department || "—"}</td>
                <td className="px-3 py-2">{r.contract_ref || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
