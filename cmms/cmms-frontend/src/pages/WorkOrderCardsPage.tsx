// src/pages/WorkOrderCardsPage.tsx
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    getWorkOrders,
    updateWorkOrder,
    startWorkOrder,
    stopWorkOrder,
    reopenWorkOrder,
    type WorkOrderDto,
} from "../api";

import { isoToLocalDisplay } from "../domain/datetime";
import { WorkOrderClassification, WorkOrderStatus, woStatusLabel } from "../domain/enums";
import AppShell from "../components/AppShell";
import {
    Button,
    Drawer,
    ErrorBox,
    PageToolbar,
    Pill
} from "../components/ui";

function StatusPill({ status }: { status: WorkOrderStatus }) {
    const label = woStatusLabel(status);
    let tone: "emerald" | "teal" | "rose" | "zinc" | "amber" = "zinc";
    if (status === WorkOrderStatus.Done) tone = "emerald";
    else if (status === WorkOrderStatus.InProgress) tone = "teal";
    else if (status === WorkOrderStatus.Cancelled) tone = "rose";
    else if (status === WorkOrderStatus.Open) tone = "amber";
    return <Pill tone={tone}>{label}</Pill>;
}

export default function WorkOrderCardsPage() {
    const [open, setOpen] = useState<WorkOrderDto[]>([]);
    const [inProgress, setInProgress] = useState<WorkOrderDto[]>([]);
    const [done, setDone] = useState<WorkOrderDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Selected WO for Drawer
    const [selected, setSelected] = useState<WorkOrderDto | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Draft state for reporting
    const [dDefect, setDDefect] = useState("");
    const [dCause, setDCause] = useState("");
    const [dSolution, setDSolution] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            // 1) Open
            const p1 = getWorkOrders({ status: WorkOrderStatus.Open, take: 200 });

            // 2) InProgress
            const p2 = getWorkOrders({ status: WorkOrderStatus.InProgress, take: 200 });

            // 3) Done (last 30 days)
            const d30 = new Date();
            d30.setDate(d30.getDate() - 30);
            const p3 = getWorkOrders({
                status: WorkOrderStatus.Done,
                from: d30.toISOString(),
                take: 200,
            });

            const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

            setOpen(r1.items);
            setInProgress(r2.items);
            setDone(r3.items);
        } catch (e) {
            const error = e as Error;
            setErr(error.message || "Eroare la incarcare");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Sync draft fields when opening drawer
    useEffect(() => {
        if (selected) {
            setDDefect(selected.defect || "");
            setDCause(selected.cause || "");
            setDSolution(selected.solution || "");
        } else {
            setDDefect("");
            setDCause("");
            setDSolution("");
        }
    }, [selected]);

    const onCardClick = (w: WorkOrderDto) => {
        setSelected(w);
        setDrawerOpen(true);
    };

    const onCloseDrawer = () => {
        setDrawerOpen(false);
        setTimeout(() => setSelected(null), 200);
    };

    // Actions
    const applyAction = async (action: "start" | "stop" | "reopen") => {
        if (!selected) return;
        setActionLoading(true);
        try {
            let updated: WorkOrderDto;
            if (action === "start") updated = await startWorkOrder(selected.id);
            else if (action === "stop") updated = await stopWorkOrder(selected.id);
            else updated = await reopenWorkOrder(selected.id);

            // Update local state
            setSelected(updated);

            // If stopping, maybe we moved to Done, so we should re-sort/move?
            // For simplicity, we just update the item in place or reload.
            // Reloading checks correct buckets.
            await loadData();
        } catch (e) {
            const error = e as Error;
            alert(error.message || "Eroare actiune");
        } finally {
            setActionLoading(false);
        }
    };



    const onSaveReport = async () => {
        if (!selected) return;
        setActionLoading(true);
        try {
            const updated = await updateWorkOrder(selected.id, {
                title: selected.title,
                status: selected.status,
                defect: dDefect,
                cause: dCause,
                solution: dSolution,
            });
            setSelected(updated);
            await loadData();
            // Optional: close drawer or show success?
            // alert("Salvat!");
        } catch (e) {
            const error = e as Error;
            alert(error.message || "Eroare salvare");
        } finally {
            setActionLoading(false);
        }
    };

    const canStart = selected?.status === WorkOrderStatus.Open;
    const canStop = selected?.status === WorkOrderStatus.InProgress;
    // Reopen allowed if Done
    const canReopen = selected?.status === WorkOrderStatus.Done;

    // Render group helper
    const renderGroup = (title: string, items: WorkOrderDto[]) => {
        if (items.length === 0) return null;
        return (
            <div className="mb-8 last:mb-0">
                <h3 className="mb-4 text-lg font-semibold text-zinc-100 px-1 border-l-4 border-teal-500 pl-3">
                    {title} <span className="text-zinc-500 text-sm font-normal">({items.length})</span>
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((w) => (
                        <div
                            key={w.id}
                            onClick={() => onCardClick(w)}
                            className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-white/5 bg-white/5 p-4 transition hover:border-teal-500/30 hover:bg-white/10 active:scale-[0.98]"
                        >
                            <div className="mb-3">
                                <div className="mb-2 flex items-start justify-between gap-2">
                                    <StatusPill status={w.status} />
                                    {w.classification === WorkOrderClassification.Proactive && (
                                        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-200">
                                            Proactiv
                                        </span>
                                    )}
                                </div>
                                <div className="font-semibold text-zinc-100 line-clamp-2 leading-snug">
                                    {w.title}
                                </div>
                            </div>

                            <div className="text-xs text-zinc-400 space-y-1">
                                <div className="flex items-center gap-1">
                                    <span className="i-lucide-map-pin opacity-70">📍</span>
                                    <span className="truncate">
                                        {w.asset?.name ?? "Fara Utilaj"}
                                        {w.asset?.location ? ` · ${w.asset.location.name}` : ""}
                                    </span>
                                </div>
                                <div>
                                    📅 {isoToLocalDisplay(w.startAt || w.id /* fallback to something if needed */)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <AppShell title="Carduri Work Orders">
            <PageToolbar
                left={
                    <div className="flex items-center gap-2">
                        <Button onClick={loadData} variant="ghost" disabled={loading}>
                            Actualizeaza
                        </Button>
                    </div>
                }
            />

            {err && <ErrorBox message={err} onClose={() => setErr(null)} />}

            {loading && !open.length && !inProgress.length && !done.length ? (
                <div className="p-8 text-center text-zinc-500">Incarcare...</div>
            ) : (
                <div className="pb-20">
                    {renderGroup("Deschise", open)}
                    {renderGroup("In Lucru", inProgress)}
                    {renderGroup("Finalizate (Ultimele 30 zile)", done)}

                    {!open.length && !inProgress.length && !done.length && (
                        <div className="text-center text-zinc-500 py-10">Nimic de afisat.</div>
                    )}
                </div>
            )}

            <Drawer
                open={drawerOpen}
                onClose={onCloseDrawer}
                title={selected?.title || "Detalii"}
                widthClassName="w-full sm:w-[600px]"
                footer={
                    <div className="flex justify-between items-center w-full">
                        <div className="text-xs text-zinc-500">
                            {selected?.status}
                        </div>
                        <Button variant="ghost" onClick={onCloseDrawer}>Inchide</Button>
                    </div>
                }
            >
                {selected && (
                    <div className="space-y-8">
                        {/* Header Actions */}
                        <div className="flex flex-wrap gap-3 rounded-xl bg-white/5 p-4 border border-white/10">
                            {canStart && (
                                <Button className="flex-1" variant="primary" onClick={() => applyAction("start")} disabled={actionLoading}>
                                    ▶ Start Interverntie
                                </Button>
                            )}
                            {canStop && (
                                <Button className="flex-1" variant="primary" onClick={() => applyAction("stop")} disabled={actionLoading}>
                                    ⏹ Stop / Finalizare
                                </Button>
                            )}
                            {canReopen && (
                                <Button className="flex-1" onClick={() => applyAction("reopen")} disabled={actionLoading}>
                                    Redeschide
                                </Button>
                            )}

                            <Link to={`/work-orders/${selected.id}`} className="flex-1">
                                <Button className="w-full">
                                    Vezi Detalii Complete
                                </Button>
                            </Link>
                        </div>

                        {/* Raport Tehnic */}
                        <div className="space-y-4">
                            <h4 className="text-zinc-100 font-medium border-b border-white/10 pb-2">Raport Tehnic (Interventie)</h4>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-400">Defect Constatat</label>
                                <textarea
                                    className="min-h-[80px] w-full rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
                                    value={dDefect}
                                    onChange={(e) => setDDefect(e.target.value)}
                                    placeholder="Ce defectiuni ati gasit?"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-400">Cauza Defectiunii</label>
                                <textarea
                                    className="min-h-[60px] w-full rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
                                    value={dCause}
                                    onChange={(e) => setDCause(e.target.value)}
                                    placeholder="De ce a aparut problema?"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-400">Solutie Aplicata</label>
                                <textarea
                                    className="min-h-[80px] w-full rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
                                    value={dSolution}
                                    onChange={(e) => setDSolution(e.target.value)}
                                    placeholder="Ce ati reparat / inlocuit?"
                                />
                            </div>

                            <div className="flex justify-end">
                                <Button onClick={onSaveReport} disabled={actionLoading}>
                                    💾 Salveaza Raport
                                </Button>
                            </div>
                        </div>

                        {/* Piese Utilizate Link */}
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-zinc-200">Piese Utilizate</div>
                                    <div className="text-xs text-zinc-500">Gestioneaza piesele consumate in interventie</div>
                                </div>
                                <Link to={`/work-orders/${selected.id}`}>
                                    <Button variant="ghost">Gestionare Piese &rarr;</Button>
                                </Link>
                            </div>
                        </div>

                    </div>
                )}
            </Drawer>
        </AppShell>
    );
}
