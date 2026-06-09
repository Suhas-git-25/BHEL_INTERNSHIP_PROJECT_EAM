import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import ExcelUpload from "../components/ExcelUpload.jsx";
import DropdownWithAdd from "../components/DropdownWithAdd.jsx";
import Pagination from "../components/Pagination.jsx";
import { usePagination } from "../hooks/usePagination.js";

const emptyForm = {
  platform: "",
  name: "",
  make: "",
  model: "",
  serial_number: "",
  asset_tag: "",
  asset_number: "",
  asset_group: "",
  asset_source: "",
  contract_ref: "",
  purchase_order: "",
  purchase_date: "",
  warranty_date: "",
  status: "AVAILABLE",
  date_received: "",
  date_issued: "",
  user_name: "",
  staff_no: "",
  user_account: "",
  division: "",
  place: "",
  location: "",
  field_user_address: "",
  comments: "",
  notes: "",
};

export default function HardwarePage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [models, setModels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showDetails, setShowDetails] = useState(null);

  async function refresh() {
    const data = await api("/api/hardware");
    setRows(data || []);
  }

  async function loadDropdownData() {
    try {
      const [catData, modelData] = await Promise.all([
        api("/api/dropdowns/hardware/categories"),
        api("/api/dropdowns/hardware/models"),
      ]);
      setCategories(catData || []);
      setModels(modelData || []);
    } catch (err) {
      console.error("Failed to load dropdown data:", err);
    }
  }

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const data = await api("/api/hardware");
        if (!canceled) setRows(data || []);
        await loadDropdownData();
      } catch (err) {
        if (!canceled) setError(err.message);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const dropdowns = useMemo(() => {
    const fromRows = (key) => rows.map((row) => row[key]).filter(Boolean);
    return {
      platforms: uniqueOptions([...categories, ...fromRows("platform")]),
      types: uniqueOptions([...categories, ...fromRows("name")]),
      makes: uniqueOptions(fromRows("make")),
      models: uniqueOptions([...models, ...fromRows("model")]),
      assetGroups: uniqueOptions(fromRows("asset_group")),
      sources: uniqueOptions([...fromRows("asset_source"), ...rows.map((row) => row.contract_ref).filter(Boolean)]),
      divisions: uniqueOptions(fromRows("division")),
      places: uniqueOptions(fromRows("place")),
    };
  }, [categories, models, rows]);

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        ...form,
        category: form.platform || form.name,
        notes: form.notes || form.comments,
      };
      await api("/api/hardware", { method: "POST", body: payload });
      setForm(emptyForm);
      await refresh();
      await loadDropdownData();
    } catch (err) {
      setError(err.message);
    }
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold text-white">Hardware inventory</h2>
        <p className="text-sm text-slate-400">Add assets and review full hardware register.</p>
      </header>

      <ExcelUpload
        category="hardware"
        sampleFile="Hardware.xlsx"
        columnsHint="action (add | remove), asset_tag*, name*, category, model, status, contract_ref, purchase_date, notes"
        onImported={refresh}
      />

      <form onSubmit={create} className="space-y-6 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
        <FormSection title="Asset">
          <DropdownWithAdd label="Platform" value={form.platform} onChange={(val) => update("platform", val)} options={dropdowns.platforms} placeholder="Choose or add platform" />
          <DropdownWithAdd label="Hardware type" value={form.name} onChange={(val) => update("name", val)} options={dropdowns.types} placeholder="Choose or add hardware type" required />
          <DropdownWithAdd label="Make" value={form.make} onChange={(val) => update("make", val)} options={dropdowns.makes} placeholder="Choose or add make" />
          <DropdownWithAdd label="Model" value={form.model} onChange={(val) => update("model", val)} options={dropdowns.models} placeholder="Choose or add model" />
          <Field label="Serial number" value={form.serial_number} onChange={(val) => update("serial_number", val)} />
          <Field label="Asset tag" value={form.asset_tag} onChange={(val) => update("asset_tag", val)} required />
          <Field label="Asset number" value={form.asset_number} onChange={(val) => update("asset_number", val)} />
          <DropdownWithAdd label="Asset group" value={form.asset_group} onChange={(val) => update("asset_group", val)} options={dropdowns.assetGroups} placeholder="Choose or add group" />
          <DropdownWithAdd label="Asset source / rate contract" value={form.asset_source} onChange={(val) => update("asset_source", val)} options={dropdowns.sources} placeholder="Choose or add source" />
          <Field label="Purchase order" value={form.purchase_order} onChange={(val) => update("purchase_order", val)} />
          <Field label="Contract ref" value={form.contract_ref} onChange={(val) => update("contract_ref", val)} />
        </FormSection>

        <FormSection title="Dates and status">
          <Field type="date" label="Date purchased" value={form.purchase_date} onChange={(val) => update("purchase_date", val)} />
          <Field type="date" label="Warranty date" value={form.warranty_date} onChange={(val) => update("warranty_date", val)} />
          <label className="text-sm text-slate-300">
            Status
            <select
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              value={form.status}
              onChange={(e) => update("status", e.target.value)}
            >
              <option value="AVAILABLE">Inventory</option>
              <option value="ISSUED">Issued</option>
              <option value="RETIRED">Retired</option>
            </select>
          </label>
          <Field type="date" label="Date received" value={form.date_received} onChange={(val) => update("date_received", val)} />
          <Field type="date" label="Date issued" value={form.date_issued} onChange={(val) => update("date_issued", val)} />
        </FormSection>

        <FormSection title="User">
          <Field label="User" value={form.user_name} onChange={(val) => update("user_name", val)} />
          <Field label="Staff no" value={form.staff_no} onChange={(val) => update("staff_no", val)} />
          <Field label="User account" value={form.user_account} onChange={(val) => update("user_account", val)} />
          <DropdownWithAdd label="Division" value={form.division} onChange={(val) => update("division", val)} options={dropdowns.divisions} placeholder="Choose or add division" />
          <DropdownWithAdd label="Place" value={form.place} onChange={(val) => update("place", val)} options={dropdowns.places} placeholder="Choose or add place" />
          <Field label="Location" value={form.location} onChange={(val) => update("location", val)} />
          <TextArea label="Field user address" value={form.field_user_address} onChange={(val) => update("field_user_address", val)} />
          <TextArea label="Comments" value={form.comments} onChange={(val) => update("comments", val)} />
        </FormSection>

        <div className="flex items-center justify-between gap-3">
          {error ? <span className="text-sm text-rose-400">{error}</span> : <span />}
          <button type="submit" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Add hardware
          </button>
        </div>
      </form>

      <HardwareTable rows={rows} onView={setShowDetails} />

      {showDetails ? <HardwareDetails asset={showDetails} onClose={() => setShowDetails(null)} /> : null}
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <section>
      <h3 className="mb-3 border-b border-slate-800 pb-2 text-sm font-semibold uppercase tracking-wide text-sky-200">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      <input
        type={type}
        required={required}
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

function HardwareTable({ rows, onView }) {
  const { page, setPage, totalPages, paginatedItems, pageSize, totalItems } = usePagination(rows);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left">Asset type</th>
            <th className="px-3 py-2 text-left">Make</th>
            <th className="px-3 py-2 text-left">Model</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">User</th>
            <th className="px-3 py-2 text-left">Division</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-900 bg-slate-950/60">
          {paginatedItems.map((r) => (
            <tr key={r.hardware_id}>
              <td className="px-3 py-2 font-semibold text-sky-200">{r.name}</td>
              <td className="px-3 py-2">{r.make || r.category || "-"}</td>
              <td className="px-3 py-2">{r.model || "-"}</td>
              <td className="px-3 py-2">{r.status}</td>
              <td className="px-3 py-2">{r.user_name || "-"}</td>
              <td className="px-3 py-2">{r.division || "-"}</td>
              <td className="px-3 py-2 text-right">
                <button type="button" onClick={() => onView(r)} className="rounded-md border border-sky-700 px-3 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-950">
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
  );
}

function HardwareDetails({ asset, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">Hardware detail</h3>
            <p className="text-sm text-slate-400">{asset.asset_tag || asset.serial_number || asset.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200">Close</button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <DetailGroup title="Asset" rows={[
            ["Platform", asset.platform || asset.category],
            ["Asset type", asset.name],
            ["Make", asset.make],
            ["Model", asset.model],
            ["Serial number", asset.serial_number],
            ["Asset tag", asset.asset_tag],
            ["Asset number", asset.asset_number],
            ["Asset group", asset.asset_group],
            ["Source / contract", asset.asset_source || asset.contract_ref],
            ["Purchase order", asset.purchase_order],
          ]} />
          <DetailGroup title="Dates and user" rows={[
            ["Status", asset.status],
            ["Date purchased", formatDate(asset.purchase_date)],
            ["Warranty date", formatDate(asset.warranty_date)],
            ["Date received", formatDate(asset.date_received)],
            ["Date issued", formatDate(asset.date_issued)],
            ["User", asset.user_name],
            ["Staff no", asset.staff_no],
            ["User account", asset.user_account],
            ["Division", asset.division],
            ["Place", asset.place],
            ["Location", asset.location],
          ]} />
        </div>
        <div className="mt-4 grid gap-4">
          <DetailBlock title="Field user address" value={asset.field_user_address} />
          <DetailBlock title="Comments" value={asset.comments || asset.notes} />
        </div>
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
          <div key={label} className="grid grid-cols-[9rem_1fr] gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-100">{value || "-"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DetailBlock({ title, value }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">{value || "-"}</p>
    </section>
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
