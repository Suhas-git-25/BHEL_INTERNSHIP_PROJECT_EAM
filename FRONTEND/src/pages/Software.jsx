import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import ExcelUpload from "../components/ExcelUpload.jsx";
import DropdownWithAdd from "../components/DropdownWithAdd.jsx";
import Pagination from "../components/Pagination.jsx";
import { usePagination } from "../hooks/usePagination.js";

const emptyForm = {
  name: "",
  version_label: "",
  platform: "",
  vendor: "",
  license_type: "",
  total_licenses: 0,
  seats_in_use: 0,
  date_purchased: "",
  status: "",
  user_owner: "",
  division: "",
  location: "",
  contract_ref: "",
  comments: "",
  notes: "",
};

export default function SoftwarePage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [licenseTypes, setLicenseTypes] = useState([]);
  const [showDetails, setShowDetails] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function refresh() {
    const data = await api("/api/software");
    setRows(data || []);
  }

  async function loadLicenseTypes() {
    try {
      const data = await api("/api/dropdowns/software/license-types");
      setLicenseTypes(data || []);
    } catch (err) {
      console.error("Failed to load license types:", err);
    }
  }

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const data = await api("/api/software");
        if (!canceled) setRows(data || []);
        await loadLicenseTypes();
      } catch (err) {
        if (!canceled) setError(err.message);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const dropdowns = useMemo(() => ({
    platforms: uniqueOptions(rows.map((row) => row.platform)),
    vendors: uniqueOptions(rows.map((row) => row.vendor)),
    licenseTypes: uniqueOptions([...licenseTypes, ...rows.map((row) => row.license_type)]),
    statuses: uniqueOptions(rows.map((row) => row.status)),
    divisions: uniqueOptions(rows.map((row) => row.division)),
    locations: uniqueOptions(rows.map((row) => row.location)),
  }), [licenseTypes, rows]);

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/software", {
        method: "POST",
        body: {
          ...form,
          notes: form.notes || form.comments,
          total_licenses: Number(form.total_licenses),
          seats_in_use: Number(form.seats_in_use),
        },
      });
      setForm(emptyForm);
      await refresh();
      await loadLicenseTypes();
    } catch (err) {
      setError(err.message);
    }
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const { page, setPage, totalPages, paginatedItems, pageSize, totalItems } = usePagination(rows);

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold text-white">Software inventory</h2>
        <p className="text-sm text-slate-400">Licenses tracked with owners, vendors, and seat counts.</p>
      </header>

      <ExcelUpload
        category="software"
        sampleFile="Software.xlsx"
        columnsHint="action (add | remove), name*, version_label, license_type, total_licenses, seats_in_use, contract_ref, notes"
        onImported={refresh}
      />

      <form onSubmit={create} className="space-y-6 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
        <section>
          <h3 className="mb-3 border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-wide text-sky-200">Software</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Software name" value={form.name} onChange={(val) => update("name", val)} required />
            <Field label="Version" value={form.version_label} onChange={(val) => update("version_label", val)} />
            <DropdownWithAdd label="Platform" value={form.platform} onChange={(val) => update("platform", val)} options={dropdowns.platforms} placeholder="Choose or add platform" />
            <DropdownWithAdd label="Vendor" value={form.vendor} onChange={(val) => update("vendor", val)} options={dropdowns.vendors} placeholder="Choose or add vendor" />
            <DropdownWithAdd label="License type" value={form.license_type} onChange={(val) => update("license_type", val)} options={dropdowns.licenseTypes} placeholder="Choose or add license type" />
            <Field type="number" label="Seats" value={form.total_licenses} onChange={(val) => update("total_licenses", val)} />
            <Field type="number" label="Seats in use" value={form.seats_in_use} onChange={(val) => update("seats_in_use", val)} />
            <Field type="date" label="Date purchased" value={form.date_purchased} onChange={(val) => update("date_purchased", val)} />
            <DropdownWithAdd label="Status" value={form.status} onChange={(val) => update("status", val)} options={dropdowns.statuses} placeholder="Choose or add status" />
            <Field label="User / owner" value={form.user_owner} onChange={(val) => update("user_owner", val)} />
            <DropdownWithAdd label="Division" value={form.division} onChange={(val) => update("division", val)} options={dropdowns.divisions} placeholder="Choose or add division" />
            <DropdownWithAdd label="Location" value={form.location} onChange={(val) => update("location", val)} options={dropdowns.locations} placeholder="Choose or add location" />
            <Field label="Contract ref" value={form.contract_ref} onChange={(val) => update("contract_ref", val)} />
            <TextArea label="Comments" value={form.comments} onChange={(val) => update("comments", val)} />
          </div>
        </section>

        <div className="flex items-center justify-between gap-3">
          {error ? <span className="text-sm text-rose-400">{error}</span> : <span />}
          <button type="submit" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Add software
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Vendor</th>
              <th className="px-3 py-2 text-left">Platform</th>
              <th className="px-3 py-2 text-left">License</th>
              <th className="px-3 py-2 text-left">Seats</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 bg-slate-950/60">
            {paginatedItems.map((r) => (
              <tr key={r.software_id}>
                <td className="px-3 py-2 font-semibold text-white">{r.name}</td>
                <td className="px-3 py-2">{r.vendor || "-"}</td>
                <td className="px-3 py-2">{r.platform || "-"}</td>
                <td className="px-3 py-2">{r.license_type || "-"}</td>
                <td className="px-3 py-2">{r.seats_in_use}/{r.total_licenses}</td>
                <td className="px-3 py-2">{r.user_owner || "-"}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => setShowDetails(r)} className="rounded-md border border-sky-700 px-3 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-950">
                    View
                  </button>
                </td>
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

      {showDetails ? <SoftwareDetails item={showDetails} onClose={() => setShowDetails(null)} /> : null}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      <input
        type={type}
        required={required}
        min={type === "number" ? "0" : undefined}
        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="text-sm text-slate-300 md:col-span-2 lg:col-span-3">
      {label}
      <textarea
        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
        rows="3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SoftwareDetails({ item, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">{item.name}</h3>
            <p className="text-sm text-slate-400">{item.version_label || "Software detail"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200">Close</button>
        </div>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          {[
            ["Platform", item.platform],
            ["Vendor", item.vendor],
            ["License type", item.license_type],
            ["Seats", `${item.seats_in_use}/${item.total_licenses}`],
            ["Date purchased", formatDate(item.date_purchased)],
            ["Status", item.status],
            ["User / owner", item.user_owner],
            ["Division", item.division],
            ["Location", item.location],
            ["Contract", item.contract_ref],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-1 font-medium text-slate-100">{value || "-"}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comments</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">{item.comments || item.notes || "-"}</p>
        </div>
      </div>
    </div>
  );
}

function uniqueOptions(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}
