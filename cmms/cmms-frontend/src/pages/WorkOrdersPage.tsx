import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  createWorkOrder,
  getAssets,
  getWorkOrders,
  logout,
  startWorkOrder,
  stopWorkOrder,
  cancelWorkOrder,
  reopenWorkOrder,
  type AssetDto,
  type WorkOrderDto,
} from "../api";

function fmt(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function safeArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function woTypeLabel(t: number) {
  switch (t) {
    case 1: return "AdHoc";
    case 2: return "Preventive";
    case 3: return "Extra";
    default: return String(t);
  }
}

function woStatusLabel(s: number) {
  switch (s) {
    case 1: return "Open";
    case 2: return "In Progress";
    case 3: return "Done";
    case 4: return "Cancelled";
    default: return String(s);
  }
}

function badgeStyle(s: number): CSSProperties {
  const base: CSSProperties = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid #ddd",
    background: "#fff",
  };
  if (s === 2) return { ...base, background: "#f7f7f7" }; // In Progress
  if (s === 3) return { ...base, background: "#f0f0f0" }; // Done
  if (s === 4) return { ...base, background: "#f0f0f0", opacity: 0.8 }; // Cancelled
  return base; // Open
}

export default function WorkOrdersPage() {
  const [items, setItems] = useState<WorkOrderDto[]>([]);
  const [total, setTotal] = useState<number>(0);

  const [assets, setAssets] = useState<AssetDto[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // New WO form
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<number>(1);
  const [assetId, setAssetId] = useState<string>("");
  const [startAt, setStartAt] = useState<string>(""); // datetime-local
  const [stopAt, setStopAt] = useState<string>(""); // datetime-local

  const badRange = useMemo(() => {
    if (!startAt || !stopAt) return false;
    const s = new Date(startAt).getTime();
    const e = new Date(stopAt).getTime();
    return Number.isFinite(s) && Number.isFinite(e) && e < s;
  }, [startAt, stopAt]);

  const canCreate = useMemo(
    () => title.trim().length >= 2 && !badRange,
    [title, badRange]
  );

  async function load() {
    setLoadingList(true);
    setErr(null);
    try {
      const resp = await getWorkOrders({ take: 200, skip: 0 });
      const list = safeArray<WorkOrderDto>((resp as any).items);
      setItems(list);
      setTotal(typeof (resp as any).total === "number" ? (resp as any).total : list.length);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAssets({ take: 500 });
        setAssets(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    })();
  }, []);

  async function onCreate() {
    setErr(null);
    setBusy(true);
    try {
      const startIso = startAt ? new Date(startAt).toISOString() : null;
      const stopIso = stopAt ? new Date(stopAt).toISOString() : null;

      await createWorkOrder({
        title: title.trim(),
        type,
        assetId: assetId ? assetId : null,
        startAt: startIso,
        stopAt: stopIso,
      });

      setTitle("");
      setType(1);
      setAssetId("");
      setStartAt("");
      setStopAt("");
      setShowNew(false);

      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onStart(id: string) {
    setErr(null);
    setBusy(true);
    try {
      await startWorkOrder(id);
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onStop(id: string) {
    if (!confirm("Stop work order and mark as Done?")) return;
    setErr(null);
    setBusy(true);
    try {
      await stopWorkOrder(id);
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCancel(id: string) {
    if (!confirm("Cancel work order?")) return;
    setErr(null);
    setBusy(true);
    try {
      await cancelWorkOrder(id);
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReopen(id: string) {
    if (!confirm("Reopen this work order (back to Open)?")) return;
    setErr(null);
    setBusy(true);
    try {
      await reopenWorkOrder(id);
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>Work Orders</h2>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Total: {total}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/assets">Assets</Link>
          <Link to="/locations">Locations</Link>
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

      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        <button onClick={() => setShowNew(true)} disabled={busy}>
          New WO
        </button>
        <button onClick={load} disabled={loadingList || busy}>
          {loadingList ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}

      {showNew && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>New Work Order</div>
            <button onClick={() => setShowNew(false)} disabled={busy}>
              Close
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              style={{ padding: 8, minWidth: 320 }}
            />

            <select value={type} onChange={(e) => setType(Number(e.target.value))} style={{ padding: 8, minWidth: 160 }}>
              <option value={1}>AdHoc</option>
              <option value={2}>Preventive</option>
              <option value={3}>Extra</option>
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

            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} style={{ padding: 8 }} />
            <input type="datetime-local" value={stopAt} onChange={(e) => setStopAt(e.target.value)} style={{ padding: 8 }} />

            <button onClick={onCreate} disabled={!canCreate || busy}>
              Create
            </button>
          </div>

          {badRange && (
            <div style={{ marginTop: 8, fontSize: 12, color: "crimson" }}>
              Stop trebuie sa fie dupa Start.
            </div>
          )}
        </div>
      )}

      <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Title</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Type</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Status</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Asset</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Start</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Stop</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Min</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {safeArray<WorkOrderDto>(items).map((w) => {
            const s = w.status;

            const canStart = s === 1;               // Open
            const canStop = s === 2;                // In Progress
            const canCancel = s === 1 || s === 2;   // Open/InProgress
            const canReopen = s === 3 || s === 4;   // Done/Cancelled

            return (
              <tr key={w.id}>
                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                  <Link to={`/work-orders/${w.id}`}>{w.title}</Link>
                </td>

                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                  {woTypeLabel(w.type)}
                </td>

                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                  <span style={badgeStyle(s)}>{woStatusLabel(s)}</span>
                </td>

                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                  {(w as any).asset?.name || ""}
                </td>

                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                  {fmt(w.startAt)}
                </td>

                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                  {fmt(w.stopAt)}
                </td>

                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px", textAlign: "right" }}>
                  {w.durationMinutes ?? ""}
                </td>

                <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px", textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button onClick={() => onStart(w.id)} disabled={!canStart || busy || loadingList}>Start</button>
                    <button onClick={() => onStop(w.id)} disabled={!canStop || busy || loadingList}>Stop</button>
                    <button onClick={() => onCancel(w.id)} disabled={!canCancel || busy || loadingList}>Cancel</button>
                    <button onClick={() => onReopen(w.id)} disabled={!canReopen || busy || loadingList}>Reopen</button>
                  </div>
                </td>
              </tr>
            );
          })}

          {items.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>
                No work orders.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
