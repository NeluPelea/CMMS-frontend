// src/pages/WorkOrdersPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createWorkOrder, getAssets, getWorkOrders, logout, type AssetDto, type WorkOrderDto } from "../api";

function fmt(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function typeLabel(t: number) {
  if (t === 1) return "AdHoc";
  if (t === 2) return "Preventive";
  if (t === 3) return "Extra";
  return String(t);
}

function statusLabel(s: number) {
  // ajustează după enum-ul tău din backend dacă diferă
  if (s === 1) return "Open";
  if (s === 2) return "In Progress";
  if (s === 3) return "Closed";
  if (s === 4) return "Canceled";
  return String(s);
}

export default function WorkOrdersPage() {
  const [items, setItems] = useState<WorkOrderDto[]>([]);
  const [total, setTotal] = useState(0);
  const [assets, setAssets] = useState<AssetDto[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<number>(1);
  const [assetId, setAssetId] = useState<string>("");
  const [startAt, setStartAt] = useState<string>("");
  const [stopAt, setStopAt] = useState<string>("");

  const canCreate = useMemo(() => title.trim().length >= 2, [title]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const resp = await getWorkOrders({ take: 200, skip: 0 });
      const list = Array.isArray(resp.items) ? resp.items : [];
      setItems(list);
      setTotal(typeof resp.total === "number" ? resp.total : list.length);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function loadAssets() {
    try {
      const data = await getAssets({ take: 500 });
      setAssets(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setAssets([]);
    }
  }

  useEffect(() => {
    (async () => {
      await loadAssets();
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate() {
    setErr(null);
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
        <button onClick={() => setShowNew(true)}>New WO</button>
        <button onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err && <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>{err}</div>}

      {showNew && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>New Work Order</div>
            <button onClick={() => setShowNew(false)}>Close</button>
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

            <button onClick={onCreate} disabled={!canCreate}>
              Create
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Start/Stop sunt opționale. Dacă sunt completate, backend calculează DurationMinutes (UTC).
          </div>
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
          </tr>
        </thead>
        <tbody>
          {items.map((w) => (
            <tr key={w.id}>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                <Link to={`/work-orders/${w.id}`}>{w.title}</Link>
              </td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>{typeLabel(w.type)}</td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>{statusLabel(w.status)}</td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>{(w as any).asset?.name || ""}</td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>{fmt(w.startAt)}</td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>{fmt(w.stopAt)}</td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px", textAlign: "right" }}>{w.durationMinutes ?? ""}</td>
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
                No work orders.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
