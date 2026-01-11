import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAssets, getLocs, logout, type AssetDto, type LocDto } from "../api";
import { createPmPlan, generateDuePmPlans, getPmPlans, PmFrequency, type PmPlanDto } from "../api/pmPlans";
import { isoToLocalDisplay, localInputToIso } from "../domain/datetime";

function safeArray<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function freqLabel(v: number) {
  switch (v) {
    case PmFrequency.Daily: return "Daily";
    case PmFrequency.Weekly: return "Weekly";
    case PmFrequency.Monthly: return "Monthly";
    default: return `Freq ${v}`;
  }
}

export default function PmPlansPage() {
  const [items, setItems] = useState<PmPlanDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [locs, setLocs] = useState<LocDto[]>([]);
  const [assets, setAssets] = useState<AssetDto[]>([]);

  // filters
  const [locId, setLocId] = useState("");
  const [assetId, setAssetId] = useState("");

  // create
  const [cAssetId, setCAssetId] = useState("");
  const [cName, setCName] = useState("");
  const [cFreq, setCFreq] = useState<number>(PmFrequency.Weekly);
  const [cNextDueLocal, setCNextDueLocal] = useState<string>("");
  const [cChecklist, setCChecklist] = useState<string>("");

  const filteredAssets = useMemo(() => {
    if (!locId) return assets;
    return assets.filter(a => (a.locId || "") === locId);
  }, [assets, locId]);

  const assetNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) map.set(a.id, a.name);
    return map;
  }, [assets]);

  async function loadAux() {
    const [l, a] = await Promise.all([
      getLocs({ take: 500, ia: true }),
      getAssets({ take: 500, ia: true }),
    ]);
    setLocs(safeArray(l));
    setAssets(safeArray(a));
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await getPmPlans({ assetId: assetId || undefined, take: 500 });
      setItems(safeArray(data));
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAux().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  async function onCreate() {
    setErr(null);
    try {
      if (!cAssetId) return setErr("Select asset");
      if (cName.trim().length < 2) return setErr("Name too short");

      const nextIso = cNextDueLocal ? localInputToIso(cNextDueLocal) : null;
      if (cNextDueLocal && !nextIso) return setErr("Invalid Next due");

      const lines = cChecklist
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean);

      await createPmPlan({
        assetId: cAssetId,
        name: cName.trim(),
        frequency: cFreq,
        nextDueAt: nextIso,
        items: lines.length ? lines : null,
      });

      setCName("");
      setCFreq(PmFrequency.Weekly);
      setCNextDueLocal("");
      setCChecklist("");
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onGenerateDue() {
    setErr(null);
    try {
      const res = await generateDuePmPlans(200);
      await load();
      alert(`Generated work orders: ${res.created}\nUpdated plans: ${res.updatedPlans}`);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>PM Plans</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/work-orders">Work Orders</Link>
          <Link to="/assets">Assets</Link>
          <Link to="/locations">Locations</Link>
          <button onClick={() => logout()}>Logout</button>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #999", borderRadius: 8 }}>
          {err}
        </div>
      )}

      {/* Filters */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
        <div>
          <label style={{ display: "block", fontSize: 12 }}>Location</label>
          <select value={locId} onChange={(e) => { setLocId(e.target.value); setAssetId(""); }} style={{ width: "100%" }}>
            <option value="">All</option>
            {locs.map(l => (
              <option key={l.id} value={l.id}>
                {l.name} {l.code ? `(${l.code})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12 }}>Asset</label>
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)} style={{ width: "100%" }}>
            <option value="">All</option>
            {filteredAssets.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} {a.code ? `(${a.code})` : ""}
              </option>
            ))}
          </select>
        </div>

        <button onClick={load} disabled={loading}>Refresh</button>
        <button onClick={onGenerateDue} disabled={loading}>Generate due</button>
      </div>

      {/* Create */}
      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Create PM Plan</div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: 12 }}>Asset</label>
            <select value={cAssetId} onChange={(e) => setCAssetId(e.target.value)} style={{ width: "100%" }}>
              <option value="">Select asset...</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.code ? `(${a.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12 }}>Name</label>
            <input value={cName} onChange={(e) => setCName(e.target.value)} style={{ width: "100%" }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12 }}>Frequency</label>
            <select value={cFreq} onChange={(e) => setCFreq(Number(e.target.value))} style={{ width: "100%" }}>
              <option value={PmFrequency.Daily}>Daily</option>
              <option value={PmFrequency.Weekly}>Weekly</option>
              <option value={PmFrequency.Monthly}>Monthly</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12 }}>Next due (local)</label>
            <input
              type="datetime-local"
              value={cNextDueLocal}
              onChange={(e) => setCNextDueLocal(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontSize: 12 }}>Checklist items (one per line)</label>
          <textarea
            value={cChecklist}
            onChange={(e) => setCChecklist(e.target.value)}
            rows={4}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onCreate} disabled={loading}>Create</button>
        </div>
      </div>

      {/* List */}
      <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: 10, borderBottom: "1px solid #eee", fontWeight: 700 }}>
          Plans ({items.length})
        </div>

        {loading ? (
          <div style={{ padding: 12 }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 12 }}>No plans.</div>
        ) : (
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {items.map(p => (
              <div key={p.id} style={{ padding: 12, borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Next due: {isoToLocalDisplay(p.nextDueAt)}</div>
                </div>

                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                  Asset: {assetNameById.get(p.assetId) ?? p.assetId} • {freqLabel(p.frequency)} • Active: {String(p.isAct)}
                </div>

                {p.items && p.items.length > 0 ? (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {p.items
                      .slice()
                      .sort((a, b) => a.sort - b.sort)
                      .map(i => (
                        <div key={i.id} style={{ opacity: 0.95 }}>- {i.text}</div>
                      ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>No checklist items.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
