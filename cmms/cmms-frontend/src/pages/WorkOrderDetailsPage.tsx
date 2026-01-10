import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  cancelWorkOrder,
  stopWorkOrder,
  getAssets,
  getPeople,
  getWorkOrderById,
  logout,
  startWorkOrder,
  updateWorkOrder,
  reopenWorkOrder,
  type AssetDto,
  type PersonDto,
  type WorkOrderDetailsDto,
} from "../api";

function fmt(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function toIsoFromDatetimeLocal(v: string): string | null {
  if (!v) return null;
  try {
    return new Date(v).toISOString();
  } catch {
    return null;
  }
}

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function typeLabel(t: number) {
  if (t === 2) return "Preventive";
  if (t === 3) return "Extra";
  return "AdHoc";
}

function statusLabel(s: number) {
  if (s === 2) return "In Progress";
  if (s === 3) return "Done";
  if (s === 4) return "Cancelled";
  return "Open";
}

export default function WorkOrderDetailsPage() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const woId = id || "";

  const [wo, setWo] = useState<WorkOrderDetailsDto | null>(null);
  const [assets, setAssets] = useState<AssetDto[]>([]);
  const [people, setPeople] = useState<PersonDto[]>([]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assetId, setAssetId] = useState<string>("");
  const [personId, setPersonId] = useState<string>("");
  const [startAtLocal, setStartAtLocal] = useState<string>("");
  const [stopAtLocal, setStopAtLocal] = useState<string>("");

  const canSave = useMemo(() => title.trim().length >= 2, [title]);

  async function loadAll() {
    if (!woId) return;
    setBusy(true);
    setErr(null);
    try {
      const [w, a, p] = await Promise.all([
        getWorkOrderById(woId),
        getAssets({ take: 500 }),
        getPeople(),
      ]);

      setWo(w);
      setAssets(Array.isArray(a) ? a : []);
      setPeople(Array.isArray(p) ? p : []);

      setTitle(w.title || "");
      setDescription(w.description || "");
      setAssetId(w.assetId || "");
      setPersonId(w.assignedToPersonId || "");
      setStartAtLocal(toDatetimeLocalValue(w.startAt));
      setStopAtLocal(toDatetimeLocalValue(w.stopAt));
    } catch (e: any) {
      setErr(e?.message || String(e));
      setWo(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [woId]);

  async function onSave() {
    if (!wo) return;
    setBusy(true);
    setErr(null);
    try {
      await updateWorkOrder(wo.id, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        status: wo.status, // status se schimba doar prin Start/Stop/Cancel/Reopen
        assetId: assetId ? assetId : null,
        assignedToPersonId: personId ? personId : null,
        startAt: toIsoFromDatetimeLocal(startAtLocal),
        stopAt: toIsoFromDatetimeLocal(stopAtLocal),
      });

      await loadAll();
      alert("Saved.");
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onStart() {
    if (!wo) return;
    setBusy(true);
    setErr(null);
    try {
      await startWorkOrder(wo.id);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onStop() {
    if (!wo) return;
    if (!confirm("Stop work order and mark as Done?")) return;
    setBusy(true);
    setErr(null);
    try {
      await stopWorkOrder(wo.id);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!wo) return;
    if (!confirm("Cancel this work order?")) return;
    setBusy(true);
    setErr(null);
    try {
      await cancelWorkOrder(wo.id);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReopen() {
    if (!wo) return;
    if (!confirm("Reopen this work order (back to Open)?")) return;
    setBusy(true);
    setErr(null);
    try {
      await reopenWorkOrder(wo.id);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!woId) return <div style={{ padding: 16 }}>Missing id.</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>Work Order Details</h2>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>ID: {woId}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/work-orders">Back to Work Orders</Link>
          <button onClick={() => { logout(); location.href = "/login"; }}>Logout</button>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}

      {busy && !wo && <div style={{ marginTop: 12 }}>Loading...</div>}

      {wo && (() => {
        const s = wo.status;

        // LOGICA EXACTA:
        const canStart = s === 1;              // Open
        const canStop = s === 2;               // In Progress
        const canCancel = s === 1 || s === 2;  // Open/In Progress
        const canReopen = s === 3 || s === 4;  // Done/Cancelled

        return (
          <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Type</div>
                <div style={{ fontWeight: 600 }}>{typeLabel(wo.type)}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Status</div>
                <div style={{ fontWeight: 600 }}>{statusLabel(wo.status)}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Duration (min)</div>
                <div style={{ fontWeight: 600 }}>{wo.durationMinutes ?? "-"}</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={onStart} disabled={busy || !canStart}>Start</button>
                <button onClick={onStop} disabled={busy || !canStop}>Stop</button>
                <button onClick={onCancel} disabled={busy || !canCancel}>Cancel</button>
                <button onClick={onReopen} disabled={busy || !canReopen}>Reopen</button>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Title</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Asset</div>
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">(No asset)</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.code ? ` (${a.code})` : ""}{a.locName ? ` - ${a.locName}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Assigned to</div>
                <select
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                  style={{ width: "100%", padding: 8 }}
                >
                  <option value="">(Unassigned)</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.displayName}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Location</div>
                <input
                  value={wo.locName || ""}
                  disabled
                  style={{ width: "100%", padding: 8, boxSizing: "border-box", opacity: 0.7 }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Start</div>
                <input
                  type="datetime-local"
                  value={startAtLocal}
                  onChange={(e) => setStartAtLocal(e.target.value)}
                  style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Stop</div>
                <input
                  type="datetime-local"
                  value={stopAtLocal}
                  onChange={(e) => setStopAtLocal(e.target.value)}
                  style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Description</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: "100%", minHeight: 120, padding: 8, boxSizing: "border-box" }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => nav("/work-orders")} disabled={busy}>Back</button>
                <button onClick={onSave} disabled={!canSave || busy}>Save</button>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Backend values (read-only): StartAt={fmt(wo.startAt)} | StopAt={fmt(wo.stopAt)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
