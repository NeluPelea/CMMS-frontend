// src/pages/WorkOrderDetailsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  cancelWorkOrder,
  getAssets,
  getPeople,
  getWorkOrderById,
  logout,
  reopenWorkOrder,
  startWorkOrder,
  stopWorkOrder,
  updateWorkOrder,
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

function toLocalInputValue(iso?: string | null) {
  // expects ISO; returns "YYYY-MM-DDTHH:mm" for datetime-local
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function WorkOrderDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const [wo, setWo] = useState<WorkOrderDetailsDto | null>(null);
  const [assets, setAssets] = useState<AssetDto[]>([]);
  const [people, setPeople] = useState<PersonDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // edit form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<number>(1);
  const [assetId, setAssetId] = useState<string>("");
  const [assignedToPersonId, setAssignedToPersonId] = useState<string>("");
  const [startAt, setStartAt] = useState<string>("");
  const [stopAt, setStopAt] = useState<string>("");

  const canSave = useMemo(() => title.trim().length >= 2, [title]);

  async function load() {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await getWorkOrderById(id);
      setWo(data);

      setTitle(data.title || "");
      setDescription(data.description || "");
      setStatus(data.status);
      setAssetId(data.assetId || "");
      setAssignedToPersonId(data.assignedToPersonId || "");
      setStartAt(toLocalInputValue(data.startAt));
      setStopAt(toLocalInputValue(data.stopAt));
    } catch (e: any) {
      setErr(e?.message || String(e));
      setWo(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadRefs() {
    try {
      const a = await getAssets({ take: 500 });
      setAssets(Array.isArray(a) ? a : []);
    } catch {
      setAssets([]);
    }

    try {
      const p = await getPeople();
      setPeople(Array.isArray(p) ? p : []);
    } catch {
      setPeople([]);
    }
  }

  useEffect(() => {
    (async () => {
      await loadRefs();
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSave() {
    if (!id) return;
    setErr(null);
    try {
      const startIso = startAt ? new Date(startAt).toISOString() : null;
      const stopIso = stopAt ? new Date(stopAt).toISOString() : null;

      await updateWorkOrder(id, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        status,
        assetId: assetId ? assetId : null,
        assignedToPersonId: assignedToPersonId ? assignedToPersonId : null,
        startAt: startIso,
        stopAt: stopIso,
      });

      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function action(fn: (id: string) => Promise<any>) {
    if (!id) return;
    setErr(null);
    try {
      await fn(id);
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>Work Order Details</h2>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>ID: {id}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/work-orders">Back</Link>
          <Link to="/assets">Assets</Link>
          <button
            onClick={() => {
              logout();
              location.href = "/login";
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {loading && <div style={{ marginTop: 12, opacity: 0.7 }}>Loading...</div>}
      {err && <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>{err}</div>}

      {wo && (
        <>
          <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Edit</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ padding: 8, minWidth: 360 }} />

              <select value={status} onChange={(e) => setStatus(Number(e.target.value))} style={{ padding: 8, minWidth: 180 }}>
                <option value={1}>Open</option>
                <option value={2}>In Progress</option>
                <option value={3}>Closed</option>
                <option value={4}>Canceled</option>
              </select>

              <select value={assetId} onChange={(e) => setAssetId(e.target.value)} style={{ padding: 8, minWidth: 260 }}>
                <option value="">(No asset)</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.code ? ` (${a.code})` : ""}
                    {a.locName ? ` - ${a.locName}` : ""}
                  </option>
                ))}
              </select>

              <select value={assignedToPersonId} onChange={(e) => setAssignedToPersonId(e.target.value)} style={{ padding: 8, minWidth: 260 }}>
                <option value="">(Unassigned)</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>

              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} style={{ padding: 8 }} />
              <input type="datetime-local" value={stopAt} onChange={(e) => setStopAt(e.target.value)} style={{ padding: 8 }} />

              <button onClick={onSave} disabled={!canSave} style={{ padding: "8px 12px" }}>
                Save
              </button>
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              style={{ marginTop: 10, width: "100%", minHeight: 90, padding: 8 }}
            />

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Backend values: Start={fmt(wo.startAt)} Stop={fmt(wo.stopAt)} Duration={wo.durationMinutes ?? ""} min
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => action(startWorkOrder)}>Start</button>
            <button onClick={() => action(stopWorkOrder)}>Stop</button>
            <button onClick={() => action(cancelWorkOrder)}>Cancel</button>
            <button onClick={() => action(reopenWorkOrder)}>Reopen</button>
          </div>
        </>
      )}

      {!loading && !wo && (
        <div style={{ marginTop: 16, opacity: 0.7 }}>
          Work order not found (sau nu ai acces).
        </div>
      )}
    </div>
  );
}
