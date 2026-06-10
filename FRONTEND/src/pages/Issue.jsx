import { useEffect, useState } from "react";
import { api } from "../api.js";
import ExcelUpload from "../components/ExcelUpload.jsx";

export default function IssuePage() {
  const [holders, setHolders] = useState([]);
  const [hardwareList, setHardwareList] = useState([]);
  const [softwareList, setSoftwareList] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [hwPayload, setHwPayload] = useState({
    holder_id: "",
    hardware_id: "",
    notes: "",
  });

  const [swPayload, setSwPayload] = useState({
    holder_id: "",
    software_id: "",
    notes: "",
  });

  async function hydrate() {
    const [hs, hw, sw] = await Promise.all([
      api("/api/holders"),
      api("/api/hardware"),
      api("/api/software"),
    ]);
    setHolders(hs);
    setHardwareList(hw.filter((h) => h.status === "AVAILABLE"));
    setSoftwareList(sw);
  }

  useEffect(() => {
    let canceled = false;
    hydrate().catch((err) => {
      if (!canceled) {
        setError(err.message);
      }
    });
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function issueHardware(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/assignments/issue-hardware", {
        method: "POST",
        body: {
          holder_id: Number(hwPayload.holder_id),
          hardware_id: Number(hwPayload.hardware_id),
          notes: hwPayload.notes || null,
        },
      });
      setMessage("Hardware issued successfully.");
      setHwPayload({ holder_id: "", hardware_id: "", notes: "" });
      await hydrate();
    } catch (err) {
      setError(err.message);
    }
  }

  async function issueSoftware(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/assignments/issue-software", {
        method: "POST",
        body: {
          holder_id: Number(swPayload.holder_id),
          software_id: Number(swPayload.software_id),
          notes: swPayload.notes || null,
        },
      });
      setMessage("Software assignment recorded.");
      setSwPayload({ holder_id: "", software_id: "", notes: "" });
      await hydrate();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold text-white">Issue assets</h2>
        <p className="text-sm text-slate-400">
          Issue one asset at a time, or bulk import issue/return rows from Excel.
        </p>
      </header>

      <ExcelUpload
        category="issues"
        sampleFile="Issues.xlsx"
        columnsHint="action* (issue | return | remove), holder (email or name)*, hardware_asset_tag OR software_name, software_version, notes"
        onImported={hydrate}
      />

      <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <header>
          <h3 className="text-lg font-semibold text-white">Issue hardware</h3>
          <p className="text-sm text-slate-400">
            Locks the hardware row while outstanding; status flips to issued automatically.
          </p>
        </header>
        <form onSubmit={issueHardware} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <label className="block text-sm">
            Person / holder
            <select
              required
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              value={hwPayload.holder_id}
              onChange={(e) => setHwPayload({ ...hwPayload, holder_id: e.target.value })}
            >
              <option value="">Select…</option>
              {holders.map((h) => (
                <option key={h.holder_id} value={h.holder_id}>
                  {h.full_name} · {h.contract_ref || "—"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Available hardware
            <select
              required
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              value={hwPayload.hardware_id}
              onChange={(e) => setHwPayload({ ...hwPayload, hardware_id: e.target.value })}
            >
              <option value="">Select…</option>
              {hardwareList.map((h) => (
                <option key={h.hardware_id} value={h.hardware_id}>
                  {h.asset_tag} — {h.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Notes
            <textarea
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              rows="3"
              value={hwPayload.notes}
              onChange={(e) => setHwPayload({ ...hwPayload, notes: e.target.value })}
            />
          </label>
          <button type="submit" className="w-full rounded-md bg-sky-600 py-2 text-sm font-semibold text-white">
            Issue hardware
          </button>
        </form>
      </div>

      <div className="space-y-6">
        <header>
          <h3 className="text-lg font-semibold text-white">Issue software seat</h3>
          <p className="text-sm text-slate-400">Automatically increments occupied seats unless license cap met.</p>
        </header>
        <form onSubmit={issueSoftware} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <label className="block text-sm">
            Person / holder
            <select
              required
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              value={swPayload.holder_id}
              onChange={(e) => setSwPayload({ ...swPayload, holder_id: e.target.value })}
            >
              <option value="">Select…</option>
              {holders.map((h) => (
                <option key={h.holder_id} value={h.holder_id}>
                  {h.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Software entitlement
            <select
              required
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              value={swPayload.software_id}
              onChange={(e) => setSwPayload({ ...swPayload, software_id: e.target.value })}
            >
              <option value="">Select…</option>
              {softwareList.map((s) => (
                <option key={s.software_id} value={s.software_id}>
                  {s.name} · {s.seats_in_use}/{s.total_licenses} seats used
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Notes
            <textarea
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
              rows="3"
              value={swPayload.notes}
              onChange={(e) => setSwPayload({ ...swPayload, notes: e.target.value })}
            />
          </label>
          <button type="submit" className="w-full rounded-md bg-sky-600 py-2 text-sm font-semibold text-white">
            Issue seat
          </button>
        </form>
      </div>

      {message ? (
        <p className="col-span-full rounded-md border border-emerald-900/70 bg-emerald-950/50 px-4 py-3 text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="col-span-full rounded-md border border-rose-900/70 bg-rose-950/40 px-4 py-3 text-rose-200">
          {error}
        </p>
      ) : null}
      </div>
    </div>
  );
}
