import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createAsset,
  deleteAsset,
  getAssets,
  getLocs,
  logout,
  type AssetDto,
  type LocDto,
} from "../api";

export default function AssetsPage() {
  const [items, setItems] = useState<AssetDto[]>([]);
  const [q, setQ] = useState("");
  const [showDel, setShowDel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");

  const [locs, setLocs] = useState<LocDto[]>([]);
  const [locId, setLocId] = useState<string>("");

  const canCreate = useMemo(() => newName.trim().length >= 2, [newName]);

  async function loadAssets() {
    setLoading(true);
    setErr(null);
    try {
      const data = await getAssets({
        q: q.trim() || undefined,
        take: 200,
        ia: showDel,
      });
      setItems(data);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadLocations() {
    try {
      const data = await getLocs({ take: 500 });
      setLocs(data);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  useEffect(() => {
    // initial: locatii + assets
    (async () => {
      await loadLocations();
      await loadAssets();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // refresh la schimbarea "Show deleted"
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDel]);

  async function onCreate() {
    setErr(null);
    try {
      await createAsset({
        name: newName.trim(),
        code: newCode.trim() ? newCode.trim() : null,
        locId: locId ? locId : null,
      });

      setNewName("");
      setNewCode("");
      setLocId("");

      await loadAssets();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Soft delete asset?")) return;
    setErr(null);
    try {
      await deleteAsset(id);
      await loadAssets();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Assets</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/work-orders">Work Orders</Link>
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

      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search (q)"
          style={{ padding: 8, minWidth: 260 }}
        />
        <button onClick={loadAssets} disabled={loading}>
          {loading ? "Loading..." : "Search"}
        </button>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={showDel} onChange={(e) => setShowDel(e.target.checked)} />
          Show deleted
        </label>
      </div>

      {err && (
        <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>New Asset</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            style={{ padding: 8, minWidth: 240 }}
          />
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Code (optional)"
            style={{ padding: 8, minWidth: 160 }}
          />

          <select value={locId} onChange={(e) => setLocId(e.target.value)} style={{ padding: 8, minWidth: 260 }}>
            <option value="">(No location)</option>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <button onClick={onCreate} disabled={!canCreate}>
            Create
          </button>
        </div>
      </div>

      <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Name</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Code</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Location</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Status</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: "8px 6px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((x) => (
            <tr key={x.id}>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>{x.name}</td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>{x.code || ""}</td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>{x.locName || ""}</td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px" }}>
                {x.isAct === false ? "Deleted" : "Active"}
              </td>
              <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px 6px", textAlign: "right" }}>
                <button onClick={() => onDelete(x.id)} disabled={x.isAct === false}>
                  Delete
                </button>
              </td>
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 12, opacity: 0.7 }}>
                No assets.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
