import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import Pagination from "../components/Pagination.jsx";
import { usePagination } from "../hooks/usePagination.js";

export default function StatsPage() {
  const [contracts, setContracts] = useState(null);
  const [hardware, setHardware] = useState([]);
  const [software, setSoftware] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const [contractData, hw, sw, openAssignments] = await Promise.all([
          api("/api/stats/contracts"),
          api("/api/hardware"),
          api("/api/software"),
          api("/api/assignments/open"),
        ]);
        if (!canceled) {
          setContracts(contractData);
          setHardware(hw || []);
          setSoftware(sw || []);
          setAssignments(openAssignments || []);
        }
      } catch (err) {
        if (!canceled) setError(err.message);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const usedSeats = software.reduce((sum, item) => sum + Number(item.seats_in_use || 0), 0);
    const totalSeats = software.reduce((sum, item) => sum + Number(item.total_licenses || 0), 0);
    return {
      hardwareTotal: hardware.length,
      softwareTotal: software.length,
      activeAssignments: assignments.length,
      usedSeats,
      totalSeats,
    };
  }, [hardware, software, assignments]);

  const assignmentPagination = usePagination(assignments);

  if (error) {
    return (
      <div className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold text-white">Stats</h2>
        <p className="text-sm text-slate-400">Issued assets, contracts, and license usage in one register.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Hardware" value={metrics.hardwareTotal} />
        <SummaryCard title="Software" value={metrics.softwareTotal} />
        <SummaryCard title="Currently issued" value={metrics.activeAssignments} />
        <SummaryCard title="License seats" value={`${metrics.usedSeats}/${metrics.totalSeats}`} />
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-sky-200">People with issued hardware/software</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Division</th>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Issued</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 bg-slate-950/50">
              {assignmentPagination.paginatedItems.map((row) => (
                <tr key={row.assignment_id} className="hover:bg-slate-900">
                  <td className="px-3 py-2 font-semibold text-white">{row.holder_name}</td>
                  <td className="px-3 py-2">{row.holder_department || "-"}</td>
                  <td className="px-3 py-2">{assetName(row)}</td>
                  <td className="px-3 py-2">{row.hardware_id ? "Hardware" : "Software"}</td>
                  <td className="px-3 py-2">{formatDate(row.issued_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="rounded-md border border-sky-700 px-3 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-950"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {assignments.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan="6">
                    No currently issued assets found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination
          page={assignmentPagination.page}
          totalPages={assignmentPagination.totalPages}
          onPageChange={assignmentPagination.setPage}
          totalItems={assignmentPagination.totalItems}
          pageSize={assignmentPagination.pageSize}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <MetricTable title="Open assignments by contract" rows={contracts?.open_by_holder_contract} valueKey="open_assignments" />
        <MetricTable title="Hardware by contract" rows={contracts?.hardware_by_contract} valueKey="hardware_units" />
        <SeatTable rows={contracts?.software_by_contract} />
      </div>

      {selected ? <AssignmentCard row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function MetricTable({ title, rows, valueKey }) {
  const { page, setPage, totalPages, paginatedItems, pageSize, totalItems } = usePagination(rows || []);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="mb-4 text-sm font-semibold text-sky-200">{title}</h3>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="pb-2">Contract</th>
            <th className="pb-2 text-right">Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {paginatedItems.map((r) => (
            <tr key={r.contract_ref}>
              <td className="py-2">{r.contract_ref || "-"}</td>
              <td className="py-2 text-right font-semibold text-sky-200">{r[valueKey]}</td>
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
    </section>
  );
}

function SeatTable({ rows }) {
  const { page, setPage, totalPages, paginatedItems, pageSize, totalItems } = usePagination(rows || []);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="mb-4 text-sm font-semibold text-sky-200">Software seats by contract</h3>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="pb-2">Contract</th>
            <th className="pb-2 text-right">Used</th>
            <th className="pb-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {paginatedItems.map((r) => (
            <tr key={r.contract_ref}>
              <td className="py-2">{r.contract_ref || "-"}</td>
              <td className="py-2 text-right text-amber-200">{r.seats_in_use}</td>
              <td className="py-2 text-right font-semibold text-white">{r.total_licenses}</td>
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
    </section>
  );
}

function AssignmentCard({ row, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">{row.holder_name}</h3>
            <p className="text-sm text-slate-400">{row.hardware_id ? "Hardware issued" : "Software issued"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200">
            Close
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailGroup
            title="Employee"
            rows={[
              ["Name", row.holder_name],
              ["Email", row.holder_email],
              ["Division", row.holder_department],
              ["Contract", row.holder_contract_ref],
            ]}
          />
          <DetailGroup
            title="Issued item"
            rows={[
              ["Asset", assetName(row)],
              ["Asset tag", row.asset_tag],
              ["Model/version", row.hardware_model || row.software_version],
              ["Category/license", row.hardware_category || row.license_type],
              ["Contract", row.hardware_contract_ref || row.software_contract_ref],
              ["Issued date", formatDate(row.issued_at)],
            ]}
          />
        </div>
        {row.notes ? (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{row.notes}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailGroup({ title, rows }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <h4 className="mb-3 text-sm font-semibold text-sky-200">{title}</h4>
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[8rem_1fr] gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-100">{value || "-"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function assetName(row) {
  return row.hardware_name || row.software_name || row.asset_tag || "-";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}
