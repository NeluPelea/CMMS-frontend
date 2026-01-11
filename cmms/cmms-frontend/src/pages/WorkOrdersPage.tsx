// src/pages/WorkOrdersPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  cancelWorkOrder,
  createWorkOrder,
  getAssets,
  getLocs,
  getPeople,
  getWorkOrders,
  logout,
  reopenWorkOrder,
  startWorkOrder,
  stopWorkOrder,
  updateWorkOrder,
  type AssetDto,
  type LocDto,
  type PersonDto,
  type WorkOrderDto,
} from "../api";
import { isoToLocalDisplay, isoToLocalInputValue, localInputToIso } from "../domain/datetime";
import { WorkOrderStatus, WorkOrderType, woStatusBadgeStyle, woStatusLabel, woTypeLabel } from "../domain/enums";

function safeArray<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

export default function WorkOrdersPage() {
  // list state
  const [items, setItems] = useState<WorkOrderDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<number | "">("");
  const [type, setType] = useState<number | "">("");
  const [locId, setLocId] = useState<string>("");
  const [assetId, setAssetId] = useState<string>("");
  const [take] = useState(50);
  const [skip, setSkip] = useState(0);

  // aux lists
  const [locs, setLocs] = useState<LocDto[]>([]);
  const [assets, setAssets] = useState<AssetDto[]>([]);
  const [people, setPeople] = useState<PersonDto[]>([]);

  // selection + detail draft
  const [selId, setSelId] = useState<string>("");
  const selected = useMemo(() => items.find(x => x.id === selId) || null, [items, selId]);

  const [dTitle, setDTitle] = useState("");
  const [dDesc, setDDesc] = useState("");
  const [dStatus, setDStatus] = useState<number>(WorkOrderStatus.Open);
  const [dAssetId, setDAssetId] = useState<string>("");
  const [dAssignedId, setDAssignedId] = useState<string>("");
  const [dStartAt, setDStartAt] = useState<string>(""); // datetime-local
  const [dStopAt, setDStopAt] = useState<string>("");  // datetime-local

  // create form (compact)
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<number>(WorkOrderType.AdHoc);
  const [newAssetId, setNewAssetId] = useState<string>("");

  const canCreate = useMemo(() => newTitle.trim().length >= 2, [newTitle]);
  const canSave = useMemo(() => dTitle.trim().length >= 2 && !!selected, [dTitle, selected]);

  async function loadList(nextSkip?: number) {
    const realSkip = typeof nextSkip === "number" ? nextSkip : skip;
    setLoading(true);
    setErr(null);
    try {
      const resp = await getWorkOrders({
        q: q.trim() || undefined,
        status: status === "" ? undefined : status,
        type: type === "" ? undefined : type,
        locId: locId || undefined,
        assetId: assetId || undefined,
        take,
        skip: realSkip,
      });

      const list = safeArray<WorkOrderDto>(resp?.items);
      setItems(list);
      setTotal(typeof resp?.total === "number" ? resp.total : list.length);

      // auto-select first item if nothing selected
      if (!selId && list.length) setSelId(list[0].id);
      // if selection disappeared due to filters, reselect
      if (selId && !list.some(x => x.id === selId) && list.length) setSelId(list[0].id);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function loadAux() {
    try {
      const [locData, assetData, peopleData] = await Promise.all([
        getLocs({ take: 500, ia: true }),
        getAssets({ take: 500, ia: true }),
        getPeople(),
      ]);
      setLocs(safeArray<LocDto>(locData));
      setAssets(safeArray<AssetDto>(assetData));
      setPeople(safeArray<PersonDto>(peopleData));
    } catch {
      // nu blocam pagina daca aux fails
    }
  }

  // sync detail form when selection changes
  useEffect(() => {
    if (!selected) {
      setDTitle("");
      setDDesc("");
      setDStatus(WorkOrderStatus.Open);
      setDAssetId("");
      setDAssignedId("");
      setDStartAt("");
      setDStopAt("");
      return;
    }
    setDTitle(selected.title || "");
    setDDesc(selected.description || "");
    setDStatus(selected.status);
    setDAssetId(selected.assetId || "");
    setDAssignedId(selected.assignedToPersonId || "");
    setDStartAt(isoToLocalInputValue(selected.startAt));
    setDStopAt(isoToLocalInputValue(selected.stopAt));
  }, [selected]);

  useEffect(() => {
    loadAux();
    loadList(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filters reload
  useEffect(() => {
    setSkip(0);
    loadList(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type, locId, assetId]);

  async function onSearch() {
    setSkip(0);
    await loadList(0);
  }

  async function onCreate() {
    if (!canCreate) return;
    setErr(null);
    try {
      const wo = await createWorkOrder({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        type: newType,
        assetId: newAssetId || null,
        // start/stop se fac din quick actions sau in detalii
      });

      setNewTitle("");
      setNewDesc("");
      setNewAssetId("");
      // reload list and select created
      await loadList(0);
      setSelId(wo.id);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onSave() {
    if (!selected || !canSave) return;
    setErr(null);
    try {
      const updated = await updateWorkOrder(selected.id, {
        title: dTitle.trim(),
        description: dDesc.trim() || null,
        status: dStatus,
        assetId: dAssetId || null,
        assignedToPersonId: dAssignedId || null,
        startAt: localInputToIso(dStartAt),
        stopAt: localInputToIso(dStopAt),
      });

      setItems(prev => prev.map(x => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function applyAction(action: "start" | "stop" | "cancel" | "reopen") {
    if (!selected) return;
    setErr(null);
    try {
      let updated: WorkOrderDto;
      if (action === "start") updated = await startWorkOrder(selected.id);
      else if (action === "stop") updated = await stopWorkOrder(selected.id);
      else if (action === "cancel") updated = await cancelWorkOrder(selected.id);
      else updated = await reopenWorkOrder(selected.id);

      setItems(prev => prev.map(x => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  const pageInfo = useMemo(() => {
    const from = total === 0 ? 0 : skip + 1;
    const to = Math.min(skip + take, total);
    return `${from}-${to} of ${total}`;
  }, [skip, take, total]);

  const filteredAssets = useMemo(() => {
    if (!locId) return assets;
    return assets.filter(a => (a.locId || "") === locId);
  }, [assets, locId]);

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Work Orders</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link to="/assets">Assets</Link>
          <Link to="/locations">Locations</Link>
          <Link to="/pm-plans">PM Plans</Link>

          <button onClick={() => logout()}>Logout</button>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #999", borderRadius: 8 }}>
          {err}
        </div>
      )}

      {/* Filters + create */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
        <div>
          <label style={{ display: "block", fontSize: 12 }}>Search</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title/description..." style={{ width: "100%" }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12 }}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value === "" ? "" : Number(e.target.value))} style={{ width: "100%" }}>
            <option value="">All</option>
            <option value={WorkOrderStatus.Open}>Open</option>
            <option value={WorkOrderStatus.InProgress}>In progress</option>
            <option value={WorkOrderStatus.Done}>Done</option>
            <option value={WorkOrderStatus.Cancelled}>Cancelled</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12 }}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value === "" ? "" : Number(e.target.value))} style={{ width: "100%" }}>
            <option value="">All</option>
            <option value={WorkOrderType.AdHoc}>AdHoc</option>
            <option value={WorkOrderType.Preventive}>Preventive</option>
            <option value={WorkOrderType.Extra}>Extra</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12 }}>Location</label>
          <select value={locId} onChange={(e) => setLocId(e.target.value)} style={{ width: "100%" }}>
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

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSearch} disabled={loading}>Search</button>
          <button
            onClick={() => {
              const next = Math.max(0, skip - take);
              setSkip(next);
              loadList(next);
            }}
            disabled={loading || skip === 0}
          >
            Prev
          </button>
          <button
            onClick={() => {
              const next = skip + take;
              if (next >= total) return;
              setSkip(next);
              loadList(next);
            }}
            disabled={loading || skip + take >= total}
          >
            Next
          </button>
        </div>
      </div>

      {/* Compact create */}
      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1.2fr auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: 12 }}>New work order title</label>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12 }}>Type</label>
            <select value={newType} onChange={(e) => setNewType(Number(e.target.value))} style={{ width: "100%" }}>
              <option value={WorkOrderType.AdHoc}>AdHoc</option>
              <option value={WorkOrderType.Preventive}>Preventive</option>
              <option value={WorkOrderType.Extra}>Extra</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12 }}>Asset</label>
            <select value={newAssetId} onChange={(e) => setNewAssetId(e.target.value)} style={{ width: "100%" }}>
              <option value="">(none)</option>
              {filteredAssets.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.code ? `(${a.code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onCreate} disabled={!canCreate}>Create</button>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontSize: 12 }}>Description</label>
          <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} style={{ width: "100%" }} />
        </div>
      </div>

      {/* Main master-detail */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "440px 1fr", gap: 12, minHeight: 520 }}>
        {/* LEFT: list */}
        <div style={{ border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: 10, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600 }}>Work orders</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{pageInfo}</div>
          </div>

          {loading ? (
            <div style={{ padding: 12 }}>Loading...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 12 }}>No items.</div>
          ) : (
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              {items.map(w => {
                const isSel = w.id === selId;
                return (
                  <div
                    key={w.id}
                    onClick={() => setSelId(w.id)}
                    style={{
                      padding: 12,
                      cursor: "pointer",
                      borderBottom: "1px solid #f0f0f0",
                      background: isSel ? "#f7f7f7" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {w.title}
                      </div>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          ...woStatusBadgeStyle(w.status),
                        }}
                        title={woStatusLabel(w.status)}
                      >
                        {woStatusLabel(w.status)}
                      </span>
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85, display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {woTypeLabel(w.type)} • {w.asset?.name ?? "No asset"} • {w.asset?.location?.name ?? "No location"}
                      </div>
                      <div style={{ whiteSpace: "nowrap" }}>
                        {w.assignedToPerson?.displayName ?? ""}
                      </div>
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                      {w.status === WorkOrderStatus.Done && w.durationMinutes != null
                        ? `Duration: ${w.durationMinutes} min`
                        : `Start: ${isoToLocalDisplay(w.startAt)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: details */}
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          {!selected ? (
            <div>Select a work order.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Selected</div>
                  <div style={{ fontWeight: 700 }}>{selected.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {selected.asset?.name ?? "No asset"} • {selected.asset?.location?.name ?? "No location"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Link to={`/work-orders/${selected.id}`} style={{ fontSize: 12 }}>Open page</Link>
                  <button onClick={() => applyAction("start")} disabled={selected.status !== WorkOrderStatus.Open}>
                    Start
                  </button>
                  <button onClick={() => applyAction("stop")} disabled={selected.status !== WorkOrderStatus.InProgress}>
                    Stop
                  </button>
                  <button onClick={() => applyAction("cancel")} disabled={selected.status === WorkOrderStatus.Done}>
                    Cancel
                  </button>
                  <button
                    onClick={() => applyAction("reopen")}
                    disabled={!(selected.status === WorkOrderStatus.Done || selected.status === WorkOrderStatus.Cancelled)}
                  >
                    Reopen
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12 }}>Title</label>
                  <input value={dTitle} onChange={(e) => setDTitle(e.target.value)} style={{ width: "100%" }} />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12 }}>Status</label>
                  <select value={dStatus} onChange={(e) => setDStatus(Number(e.target.value))} style={{ width: "100%" }}>
                    <option value={WorkOrderStatus.Open}>Open</option>
                    <option value={WorkOrderStatus.InProgress}>In progress</option>
                    <option value={WorkOrderStatus.Done}>Done</option>
                    <option value={WorkOrderStatus.Cancelled}>Cancelled</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12 }}>Asset</label>
                  <select value={dAssetId} onChange={(e) => setDAssetId(e.target.value)} style={{ width: "100%" }}>
                    <option value="">(none)</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} {a.code ? `(${a.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12 }}>Assigned</label>
                  <select value={dAssignedId} onChange={(e) => setDAssignedId(e.target.value)} style={{ width: "100%" }}>
                    <option value="">(none)</option>
                    {people.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12 }}>Start (local)</label>
                  <input type="datetime-local" value={dStartAt} onChange={(e) => setDStartAt(e.target.value)} style={{ width: "100%" }} />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12 }}>Stop (local)</label>
                  <input type="datetime-local" value={dStopAt} onChange={(e) => setDStopAt(e.target.value)} style={{ width: "100%" }} />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={{ display: "block", fontSize: 12 }}>Description</label>
                <textarea value={dDesc} onChange={(e) => setDDesc(e.target.value)} rows={5} style={{ width: "100%" }} />
              </div>

              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Start: {isoToLocalDisplay(selected.startAt)} • Stop: {isoToLocalDisplay(selected.stopAt)} • Duration:{" "}
                  {selected.durationMinutes != null ? `${selected.durationMinutes} min` : "-"}
                </div>
                <button onClick={onSave} disabled={!canSave}>Save</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
