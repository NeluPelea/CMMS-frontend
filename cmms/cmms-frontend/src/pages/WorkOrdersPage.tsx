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
  reopenWorkOrder,
  startWorkOrder,
  stopWorkOrder,
  updateWorkOrder,
  type AssetDto,
  type LocDto,
  type PersonDto,
  type WorkOrderDto,
} from "../api";
import {
  isoToLocalDisplay,
  isoToLocalInputValue,
  localInputToIso,
} from "../domain/datetime";
import {
  WorkOrderStatus,
  WorkOrderType,
  woStatusLabel,
  woTypeLabel,
} from "../domain/enums";
import AppShell from "../components/AppShell";
import {
  Button,
  Card,
  ErrorBox,
  Input,
  PageToolbar,
  Pill,
  Select,
  cx,
} from "../components/ui";

function safeArray<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function StatusPill({ status }: { status: number }) {
  const label = woStatusLabel(status);
  const tone =
    status === WorkOrderStatus.Done
      ? "emerald"
      : status === WorkOrderStatus.InProgress
      ? "teal"
      : status === WorkOrderStatus.Cancelled
      ? "rose"
      : "zinc";
  return <Pill tone={tone as any}>{label}</Pill>;
}

function TypePill({ type }: { type: number }) {
  // AdHoc / Preventive / Extra
  const label = woTypeLabel(type);
  const tone =
    type === WorkOrderType.Preventive
      ? "amber"
      : type === WorkOrderType.Extra
      ? "teal"
      : "zinc";
  return <Pill tone={tone as any}>{label}</Pill>;
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
  const selected = useMemo(
    () => items.find((x) => x.id === selId) || null,
    [items, selId]
  );

  const [dTitle, setDTitle] = useState("");
  const [dDesc, setDDesc] = useState("");
  const [dStatus, setDStatus] = useState<number>(WorkOrderStatus.Open);
  const [dAssetId, setDAssetId] = useState<string>("");
  const [dAssignedId, setDAssignedId] = useState<string>("");
  const [dStartAt, setDStartAt] = useState<string>(""); // datetime-local
  const [dStopAt, setDStopAt] = useState<string>(""); // datetime-local

  // create form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<number>(WorkOrderType.AdHoc);
  const [newAssetId, setNewAssetId] = useState<string>("");

  const canCreate = useMemo(() => newTitle.trim().length >= 2, [newTitle]);
  const canSave = useMemo(
    () => dTitle.trim().length >= 2 && !!selected,
    [dTitle, selected]
  );

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
      if (selId && !list.some((x) => x.id === selId) && list.length)
        setSelId(list[0].id);
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
      });

      setNewTitle("");
      setNewDesc("");
      setNewAssetId("");

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

      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
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

      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
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
    return assets.filter((a) => (a.locId || "") === locId);
  }, [assets, locId]);

  const canPrev = !loading && skip > 0;
  const canNext = !loading && skip + take < total;

  return (
    <AppShell title="Work Orders">
      {/* Toolbar: search + filters + pagination */}
      <PageToolbar
        left={
          <div className="grid gap-3 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSearch();
                }}
                placeholder="Search title/description..."
              />
            </div>

            <Select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">All status</option>
              <option value={WorkOrderStatus.Open}>Open</option>
              <option value={WorkOrderStatus.InProgress}>In progress</option>
              <option value={WorkOrderStatus.Done}>Done</option>
              <option value={WorkOrderStatus.Cancelled}>Cancelled</option>
            </Select>

            <Select
              value={type}
              onChange={(e) =>
                setType(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">All type</option>
              <option value={WorkOrderType.AdHoc}>AdHoc</option>
              <option value={WorkOrderType.Preventive}>Preventive</option>
              <option value={WorkOrderType.Extra}>Extra</option>
            </Select>

            <Select value={locId} onChange={(e) => setLocId(e.target.value)}>
              <option value="">All locations</option>
              {locs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.code ? `(${l.code})` : ""}
                </option>
              ))}
            </Select>

            <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              <option value="">All assets</option>
              {filteredAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.code ? `(${a.code})` : ""}
                </option>
              ))}
            </Select>
          </div>
        }
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button onClick={onSearch} disabled={loading} variant="ghost">
              {loading ? "Loading..." : "Search"}
            </Button>

            <Button
              onClick={() => {
                const next = Math.max(0, skip - take);
                setSkip(next);
                loadList(next);
              }}
              disabled={!canPrev}
              variant="ghost"
            >
              Prev
            </Button>

            <Button
              onClick={() => {
                const next = skip + take;
                if (next >= total) return;
                setSkip(next);
                loadList(next);
              }}
              disabled={!canNext}
              variant="ghost"
            >
              Next
            </Button>

            <div className="ml-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">
              {pageInfo}
            </div>
          </div>
        }
      />

      {err ? <ErrorBox message={err} /> : null}

      {/* Create card */}
      <Card title="Create work order">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
            />
          </div>

          <Select
            value={newType}
            onChange={(e) => setNewType(Number(e.target.value))}
          >
            <option value={WorkOrderType.AdHoc}>AdHoc</option>
            <option value={WorkOrderType.Preventive}>Preventive</option>
            <option value={WorkOrderType.Extra}>Extra</option>
          </Select>

          <Select
            value={newAssetId}
            onChange={(e) => setNewAssetId(e.target.value)}
          >
            <option value="">(none)</option>
            {filteredAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.code ? `(${a.code})` : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-3">
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
            placeholder="Description (optional)"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-teal-400/40"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <Button onClick={onCreate} disabled={!canCreate} variant="primary">
            Create
          </Button>
        </div>
      </Card>

      {/* Master-detail */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* LEFT: list */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950/30 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
            <div className="text-sm font-semibold text-zinc-200">Work orders</div>
            <div className="text-sm text-zinc-400">{pageInfo}</div>
          </div>

          {loading ? (
            <div className="px-4 py-4 text-sm text-zinc-300">Loading...</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-4 text-sm text-zinc-300">No items.</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {items.map((w) => {
                const isSel = w.id === selId;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSelId(w.id)}
                    className={cx(
                      "w-full text-left px-4 py-3 border-b border-white/5 transition",
                      isSel ? "bg-white/5" : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-100">
                          {w.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                          <TypePill type={w.type} />
                          <span className="truncate">
                            {w.asset?.name ?? "No asset"}
                            {" • "}
                            {w.asset?.location?.name ?? "No location"}
                          </span>
                        </div>
                      </div>

                      <StatusPill status={w.status} />
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
                      <span className="truncate">
                        {w.assignedToPerson?.displayName ?? ""}
                      </span>
                      <span className="whitespace-nowrap">
                        {w.status === WorkOrderStatus.Done &&
                        w.durationMinutes != null
                          ? `Duration: ${w.durationMinutes} min`
                          : `Start: ${isoToLocalDisplay(w.startAt)}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: details */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {!selected ? (
            <div className="text-sm text-zinc-300">Select a work order.</div>
          ) : (
            <>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="text-xs text-zinc-500">Selected</div>
                  <div className="mt-0.5 truncate text-base font-semibold text-zinc-100">
                    {selected.title}
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">
                    {selected.asset?.name ?? "No asset"}
                    {" • "}
                    {selected.asset?.location?.name ?? "No location"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/work-orders/${selected.id}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10"
                  >
                    Open page
                  </Link>

                  <Button
                    onClick={() => applyAction("start")}
                    disabled={selected.status !== WorkOrderStatus.Open}
                    variant="ghost"
                  >
                    Start
                  </Button>
                  <Button
                    onClick={() => applyAction("stop")}
                    disabled={selected.status !== WorkOrderStatus.InProgress}
                    variant="ghost"
                  >
                    Stop
                  </Button>
                  <Button
                    onClick={() => applyAction("cancel")}
                    disabled={selected.status === WorkOrderStatus.Done}
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => applyAction("reopen")}
                    disabled={
                      !(
                        selected.status === WorkOrderStatus.Done ||
                        selected.status === WorkOrderStatus.Cancelled
                      )
                    }
                    variant="ghost"
                  >
                    Reopen
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-zinc-500">Title</div>
                  <Input value={dTitle} onChange={(e) => setDTitle(e.target.value)} />
                </div>

                <div>
                  <div className="mb-1 text-xs text-zinc-500">Status</div>
                  <Select
                    value={dStatus}
                    onChange={(e) => setDStatus(Number(e.target.value))}
                  >
                    <option value={WorkOrderStatus.Open}>Open</option>
                    <option value={WorkOrderStatus.InProgress}>In progress</option>
                    <option value={WorkOrderStatus.Done}>Done</option>
                    <option value={WorkOrderStatus.Cancelled}>Cancelled</option>
                  </Select>
                </div>

                <div>
                  <div className="mb-1 text-xs text-zinc-500">Asset</div>
                  <Select
                    value={dAssetId}
                    onChange={(e) => setDAssetId(e.target.value)}
                  >
                    <option value="">(none)</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} {a.code ? `(${a.code})` : ""}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <div className="mb-1 text-xs text-zinc-500">Assigned</div>
                  <Select
                    value={dAssignedId}
                    onChange={(e) => setDAssignedId(e.target.value)}
                  >
                    <option value="">(none)</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <div className="mb-1 text-xs text-zinc-500">Start (local)</div>
                  <input
                    type="datetime-local"
                    value={dStartAt}
                    onChange={(e) => setDStartAt(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-zinc-500">Stop (local)</div>
                  <input
                    type="datetime-local"
                    value={dStopAt}
                    onChange={(e) => setDStopAt(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
                  />
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 text-xs text-zinc-500">Description</div>
                <textarea
                  value={dDesc}
                  onChange={(e) => setDDesc(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-teal-400/40"
                />
              </div>

              <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="text-xs text-zinc-500">
                  Start: {isoToLocalDisplay(selected.startAt)} • Stop:{" "}
                  {isoToLocalDisplay(selected.stopAt)} • Duration:{" "}
                  {selected.durationMinutes != null
                    ? `${selected.durationMinutes} min`
                    : "-"}
                </div>

                <Button onClick={onSave} disabled={!canSave} variant="primary">
                  Save
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
