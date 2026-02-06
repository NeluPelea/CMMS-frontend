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

// Helper pentru siguranța array-urilor
function safeArray<T>(x: any): T[] {
    return Array.isArray(x) ? (x as T[]) : [];
}

function StatusPill({ status }: { status: number }) {
    const label = woStatusLabel(status);
    let tone: "emerald" | "teal" | "rose" | "zinc" | "amber" = "zinc";

    if (status === WorkOrderStatus.Done) tone = "emerald";
    else if (status === WorkOrderStatus.InProgress) tone = "teal";
    else if (status === WorkOrderStatus.Cancelled) tone = "rose";
    else if (status === WorkOrderStatus.Open) tone = "amber";

    return <Pill tone={tone}>{label}</Pill>;
}

function TypePill({ type }: { type: number }) {
    const label = woTypeLabel(type);
    const tone =
        type === WorkOrderType.Preventive ? "amber" :
            type === WorkOrderType.Project ? "teal" : "zinc";
    return <Pill tone={tone as any}>{label}</Pill>;
}

export default function WorkOrdersPage() {
    // --- List State ---
    const [items, setItems] = useState<WorkOrderDto[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false); // Pentru butoane Save/Start/Stop
    const [err, setErr] = useState<string | null>(null);

    // --- Filters ---
    const [q, setQ] = useState("");
    const [status, setStatus] = useState<number | "">("");
    const [type, setType] = useState<number | "">("");
    const [locId, setLocId] = useState<string>("");
    const [assetId, setAssetId] = useState<string>("");
    const [take] = useState(50);
    const [skip, setSkip] = useState(0);

    // --- Aux Lists ---
    const [locs, setLocs] = useState<LocDto[]>([]);
    const [assets, setAssets] = useState<AssetDto[]>([]);
    const [people, setPeople] = useState<PersonDto[]>([]);

    // --- Selection & Detail Draft ---
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
    const [dStartAt, setDStartAt] = useState<string>("");
    const [dStopAt, setDStopAt] = useState<string>("");

    // --- Create Form ---
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newType, setNewType] = useState<number>(WorkOrderType.Corrective);
    const [newAssetId, setNewAssetId] = useState<string>("");

    const canCreate = useMemo(() => newTitle.trim().length >= 2 && !actionLoading, [newTitle, actionLoading]);
    const canSave = useMemo(() => dTitle.trim().length >= 2 && !!selected && !actionLoading, [dTitle, selected, actionLoading]);

    // --- Data Loading ---
    async function loadList(nextSkip?: number) {
        const realSkip = typeof nextSkip === "number" ? nextSkip : skip;
        setLoading(true);
        try {
            const resp = await getWorkOrders({
                q: q.trim() || undefined,
                status: status === "" ? undefined : (status as number),
                type: type === "" ? undefined : (type as number),
                locId: locId || undefined,
                assetId: assetId || undefined,
                take,
                skip: realSkip,
            });

            const list = safeArray<WorkOrderDto>(resp?.items);
            setItems(list);
            setTotal(resp?.total ?? list.length);

            if (!selId && list.length > 0) setSelId(list[0].id);
        } catch (e: any) {
            setErr(e?.message || "Eroare la încărcarea listei");
        } finally {
            setLoading(false);
        }
    }

    async function loadAux() {
        try {
            const [locData, assetData, peopleData] = await Promise.all([
                getLocs({ take: 1000, ia: true }),
                getAssets({ take: 1000, ia: true }),
                getPeople(),
            ]);
            setLocs(safeArray<LocDto>(locData));
            setAssets(safeArray<AssetDto>(assetData));
            setPeople(safeArray<PersonDto>(peopleData));
        } catch (e) {
            console.error("Aux data failed", e);
        }
    }

    // --- Effects ---
    useEffect(() => {
        loadAux();
        loadList(0);
    }, []);

    useEffect(() => {
        setSkip(0);
        loadList(0);
    }, [status, type, locId, assetId]);

    useEffect(() => {
        if (!selected) {
            resetDetailForm();
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

    function resetDetailForm() {
        setDTitle(""); setDDesc(""); setDStatus(WorkOrderStatus.Open);
        setDAssetId(""); setDAssignedId(""); setDStartAt(""); setDStopAt("");
    }

    // --- Actions ---
    async function onCreate() {
        if (!canCreate) return;
        setActionLoading(true);
        try {
            const wo = await createWorkOrder({
                title: newTitle.trim(),
                description: newDesc.trim() || null,
                type: newType,
                assetId: newAssetId || null,
            });
            setNewTitle(""); setNewDesc(""); setNewAssetId("");
            await loadList(0);
            setSelId(wo.id);
        } catch (e: any) {
            setErr(e?.message || "Eroare la creare");
        } finally {
            setActionLoading(false);
        }
    }

    async function onSave() {
        if (!selected || !canSave) return;
        setActionLoading(true);
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
            setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
        } catch (e: any) {
            setErr(e?.message || "Eroare la salvare");
        } finally {
            setActionLoading(false);
        }
    }

    async function applyAction(action: "start" | "stop" | "cancel" | "reopen") {
        if (!selected || actionLoading) return;
        setActionLoading(true);
        try {
            let updated: WorkOrderDto;
            switch (action) {
                case "start": updated = await startWorkOrder(selected.id); break;
                case "stop": updated = await stopWorkOrder(selected.id); break;
                case "cancel": updated = await cancelWorkOrder(selected.id); break;
                case "reopen": updated = await reopenWorkOrder(selected.id); break;
            }
            setItems(prev => prev.map(x => x.id === updated.id ? updated : x));
        } catch (e: any) {
            setErr(e?.message || "Eroare la schimbarea stării");
        } finally {
            setActionLoading(false);
        }
    }

    // --- Logic Helpers ---
    const filteredAssets = useMemo(() => {
        if (!locId) return assets;
        return assets.filter(a => a.locationId === locId);
    }, [assets, locId]);

    const pageInfo = `${total === 0 ? 0 : skip + 1}-${Math.min(skip + take, total)} of ${total}`;

    return (
        <AppShell title="Work Orders">
            <PageToolbar
                left={
                    <div className="grid gap-3 lg:grid-cols-5">
                        <Input
                            className="lg:col-span-1"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && loadList(0)}
                            placeholder="Search..."
                        />
                        <Select value={status} onChange={(e) => setStatus(e.target.value === "" ? "" : Number(e.target.value))}>
                            <option value="">All Statuses</option>
                            <option value={WorkOrderStatus.Open}>Open</option>
                            <option value={WorkOrderStatus.InProgress}>In Progress</option>
                            <option value={WorkOrderStatus.Done}>Done</option>
                            <option value={WorkOrderStatus.Cancelled}>Cancelled</option>
                        </Select>
                        <Select value={type} onChange={(e) => setType(e.target.value === "" ? "" : Number(e.target.value))}>
                            <option value="">All Types</option>
                            <option value={WorkOrderType.Corrective}>Corrective</option>
                            <option value={WorkOrderType.Preventive}>Preventive</option>
                            <option value={WorkOrderType.Project}>Project</option>
                        </Select>
                        <Select value={locId} onChange={(e) => { setLocId(e.target.value); setAssetId(""); }}>
                            <option value="">All Locations</option>
                            {locs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </Select>
                        <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                            <option value="">All Assets</option>
                            {filteredAssets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </Select>
                    </div>
                }
                right={
                    <div className="flex items-center gap-2">
                        <Button onClick={() => loadList(0)} variant="ghost" disabled={loading}>Refresh</Button>
                        <div className="text-sm text-zinc-400">{pageInfo}</div>
                        <Button onClick={() => { setSkip(s => s - take); loadList(skip - take); }} disabled={skip === 0 || loading} variant="ghost">Prev</Button>
                        <Button onClick={() => { setSkip(s => s + take); loadList(skip + take); }} disabled={skip + take >= total || loading} variant="ghost">Next</Button>
                    </div>
                }
            />

            {err && <ErrorBox message={err} onClose={() => setErr(null)} />}

            <Card title="New Work Order" className="mb-6">
                <div className="grid gap-4 lg:grid-cols-4">
                    <Input className="lg:col-span-2" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="What needs to be done?" />
                    <Select value={newType} onChange={e => setNewType(Number(e.target.value))}>
                        <option value={WorkOrderType.Corrective}>Corrective</option>
                        <option value={WorkOrderType.Preventive}>Preventive</option>
                        <option value={WorkOrderType.Project}>Project</option>
                    </Select>
                    <Select value={newAssetId} onChange={e => setNewAssetId(e.target.value)}>
                        <option value="">Select Asset (Optional)</option>
                        {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                </div>
                <div className="mt-4 flex justify-end">
                    <Button onClick={onCreate} disabled={!canCreate} variant="primary">Create Order</Button>
                </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
                {/* List Side */}
                <div className="rounded-xl border border-white/10 bg-zinc-900/50 overflow-hidden h-fit">
                    <div className="max-h-[70vh] overflow-y-auto">
                        {items.map(w => (
                            <button
                                key={w.id}
                                onClick={() => setSelId(w.id)}
                                className={cx(
                                    "w-full text-left p-4 border-b border-white/5 transition hover:bg-white/5",
                                    selId === w.id && "bg-teal-500/10 border-l-2 border-l-teal-500"
                                )}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-zinc-100 truncate pr-2">{w.title}</span>
                                    <StatusPill status={w.status} />
                                </div>
                                <div className="text-xs text-zinc-400 flex justify-between">
                                    <span>{w.asset?.name || "No Asset"}</span>
                                    <span>{isoToLocalDisplay(w.startAt)}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Detail Side */}
                <div className="space-y-6">
                    {selected ? (
                        <Card title="Edit Work Order">
                            <div className="flex justify-between items-center mb-6 p-3 bg-white/5 rounded-lg">
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => applyAction("start")} disabled={selected.status !== WorkOrderStatus.Open || actionLoading} variant="ghost">Start</Button>
                                    <Button size="sm" onClick={() => applyAction("stop")} disabled={selected.status !== WorkOrderStatus.InProgress || actionLoading} variant="ghost">Stop</Button>
                                    <Button size="sm" onClick={() => applyAction("cancel")} disabled={selected.status === WorkOrderStatus.Done || actionLoading} variant="ghost">Cancel</Button>
                                </div>
                                <Link to={`/work-orders/${selected.id}`} className="text-teal-400 text-sm hover:underline">Full Details →</Link>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                                <Input label="Title" value={dTitle} onChange={e => setDTitle(e.target.value)} />
                                <Select label="Status" value={dStatus} onChange={e => setDStatus(Number(e.target.value))}>
                                    <option value={WorkOrderStatus.Open}>Open</option>
                                    <option value={WorkOrderStatus.InProgress}>In Progress</option>
                                    <option value={WorkOrderStatus.Done}>Done</option>
                                    <option value={WorkOrderStatus.Cancelled}>Cancelled</option>
                                </Select>
                                <Select label="Asset" value={dAssetId} onChange={e => setDAssetId(e.target.value)}>
                                    <option value="">(None)</option>
                                    {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </Select>
                                <Select label="Assign To" value={dAssignedId} onChange={e => setDAssignedId(e.target.value)}>
                                    <option value="">(Unassigned)</option>
                                    {people.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                                </Select>
                                <Input type="datetime-local" label="Start Time" value={dStartAt} onChange={e => setDStartAt(e.target.value)} />
                                <Input type="datetime-local" label="End Time" value={dStopAt} onChange={e => setDStopAt(e.target.value)} />
                            </div>

                            <div className="mt-4">
                                <label className="block text-xs text-zinc-500 mb-1">Description</label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-zinc-100 min-h-[100px]"
                                    value={dDesc}
                                    onChange={e => setDDesc(e.target.value)}
                                />
                            </div>

                            <div className="mt-6 flex justify-between items-center">
                                <div className="text-xs text-zinc-500">
                                    {selected.durationMinutes ? `Final Duration: ${selected.durationMinutes} min` : "Work in progress..."}
                                </div>
                                <Button onClick={onSave} disabled={!canSave} variant="primary">Save Changes</Button>
                            </div>
                        </Card>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-zinc-500 border-2 border-dashed border-white/5 rounded-xl">
                            Select a work order from the list to view details
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}