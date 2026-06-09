import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Pagination from "../components/Pagination.jsx";
import { usePagination } from "../hooks/usePagination.js";

export default function Dashboard() {
  const [activity, setActivity] = useState(null);
  const [summary, setSummary] = useState(null);
  const [hwReport, setHwReport] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    async function load() {
      setLoading(true);
      try {
        const [act, sums, laptops] = await Promise.all([
          api("/api/dashboard/activity"),
          api("/api/stats/summary"),
          api("/api/hardware?category=laptop"),
        ]);
        if (!canceled) {
          setActivity(act);
          setSummary(sums);
          setHwReport(laptops || []);
        }
      } catch (err) {
        if (!canceled) {
          setError(err.message);
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      canceled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-slate-400">Loading dashboard…</p>;
  }
  if (error) {
    return <p className="text-rose-400">{error}</p>;
  }

  return (
    <DashboardContent activity={activity} summary={summary} hwReport={hwReport} />
  );
}

function DashboardContent({ activity, summary, hwReport }) {
  const { page, setPage, totalPages, paginatedItems, pageSize, totalItems } = usePagination(hwReport);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-sky-300">Current activity</p>
          <h2 className="text-3xl font-semibold text-white">Operations overview</h2>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
            <div className="text-slate-400">Hardware</div>
            <div className="text-2xl font-semibold text-white">{summary?.hardware ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
            <div className="text-slate-400">Software</div>
            <div className="text-2xl font-semibold text-white">{summary?.software ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
            <div className="text-slate-400">Open issues</div>
            <div className="text-2xl font-semibold text-amber-300">{summary?.open_assignments ?? 0}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <header className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Hardware movement</h3>
            <Link className="text-xs text-sky-300 hover:underline" to="/hardware">
              View all
            </Link>
          </header>
          <ul className="space-y-3 text-sm">
            {(activity?.hardware ?? []).slice(0, 8).map((row) => (
              <li key={`${row.assignment_id}-hw`} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-white">{row.label || "Hardware"}</div>
                    <div className="text-xs text-slate-400">
                      {row.holder_name} · {row.asset_tag || "—"}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                      row.state === "OPEN" ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200"
                    }`}
                  >
                    {row.state}
                  </span>
                </div>
              </li>
            ))}
            {activity?.hardware?.length === 0 ? <li className="text-slate-500">No hardware activity yet.</li> : null}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <header className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Software movement</h3>
            <Link className="text-xs text-sky-300 hover:underline" to="/software">
              View all
            </Link>
          </header>
          <ul className="space-y-3 text-sm">
            {(activity?.software ?? []).slice(0, 8).map((row) => (
              <li key={`${row.assignment_id}-sw`} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-white">{row.label || "Software"}</div>
                    <div className="text-xs text-slate-400">{row.holder_name}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                      row.state === "OPEN" ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200"
                    }`}
                  >
                    {row.state}
                  </span>
                </div>
              </li>
            ))}
            {activity?.software?.length === 0 ? <li className="text-slate-500">No software activity yet.</li> : null}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Report preview · Laptops</h3>
            <p className="text-xs text-slate-400">Filtered hardware list mirroring notebook “list of laptops”.</p>
          </div>
          <Link className="text-xs text-sky-300 hover:underline" to="/hardware">
            Manage hardware
          </Link>
        </header>
        <div className="overflow-x-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800 text-left">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Asset tag</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Contract</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {paginatedItems.map((row) => (
                <tr key={row.hardware_id}>
                  <td className="px-3 py-2 font-semibold text-sky-200">{row.asset_tag}</td>
                  <td className="px-3 py-2 text-white">{row.name}</td>
                  <td className="px-3 py-2 text-slate-300">{row.model || "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{row.status}</td>
                  <td className="px-3 py-2 text-slate-300">{row.contract_ref || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hwReport.length === 0 ? <p className="mt-3 text-slate-500">No laptop rows match this filter yet.</p> : null}
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={totalItems}
            pageSize={pageSize}
          />
        </div>
      </section>
    </div>
  );
}
