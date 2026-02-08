// src/pages/WorkOrderDetailsPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import WoAssignmentsPanel from "../components/WoAssignmentsPanel";
import LaborLogsManager from "../components/LaborLogsManager";

import {
    // work orders
    getWorkOrderById,
    updateWorkOrder,
    startWorkOrder,
    stopWorkOrder,
    reopenWorkOrder,
    cancelWorkOrder,
    type WorkOrderDto,

    // assets / people
    getAssets,
    getPeopleSimple,
    type AssetDto,
    type PersonSimpleDto,

    // parts
    getParts,
    getWorkOrderParts,
    addWorkOrderPart,
    deleteWorkOrderPart,
    setWorkOrderPartQty,
    type PartDto,
    type WorkOrderPartDto,
} from "../api";

import { WorkOrderStatus } from "../domain/enums";

import {
    Button,
    Card,
    EmptyRow,
    ErrorBox,
    Input,
    PageToolbar,
    Select,
    TableShell,
} from "../components/ui";

// ---------------- Helpers ----------------
function toLocalInput(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
    )}:${pad(d.getMinutes())}`;
}

function localToIsoOrNull(v: string): string | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseQty(input: string): number | null {
    const s = (input ?? "").trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function safeArray<T>(x: unknown): T[] {
    return Array.isArray(x) ? (x as T[]) : [];
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
        {children}
    </div>
);

type FormState = {
    title: string;
    description: string;
    status: WorkOrderStatus;
    assetId: string;
    assignedToPersonId: string;
    startAt: string; // datetime-local
    stopAt: string;  // datetime-local
    defect: string;
    cause: string;
    solution: string;
};

export default function WorkOrderDetailsPage() {
    const { id } = useParams<{ id: string }>();

    const [loading, setLoading] = useState(false);          // loadAll
    const [actionLoading, setActionLoading] = useState(false); // save/status
    const [err, setErr] = useState<string | null>(null);

    const [wo, setWo] = useState<WorkOrderDto | null>(null);
    const [assets, setAssets] = useState<AssetDto[]>([]);
    const [people, setPeople] = useState<PersonSimpleDto[]>([]);

    const [form, setForm] = useState<FormState>({
        title: "",
        description: "",
        status: WorkOrderStatus.Open,
        assetId: "",
        assignedToPersonId: "",
        startAt: "",
        stopAt: "",
        defect: "",
        cause: "",
        solution: "",
    });

    const canSave = useMemo(() => form.title.trim().length >= 2 && !actionLoading, [form.title, actionLoading]);

    const sortedAssets = useMemo(() => {
        const a = [...assets];
        a.sort((x, y) => (x.name || "").localeCompare(y.name || "", "ro"));
        return a;
    }, [assets]);

    const sortedPeople = useMemo(() => {
        const p = [...people];
        p.sort((x, y) => (x.displayName || "").localeCompare(y.displayName || "", "ro"));
        return p;
    }, [people]);

    const loadAll = useCallback(async () => {
        if (!id) return;

        setLoading(true);
        setErr(null);

        try {
            const [woData, assetsData, peopleData] = await Promise.all([
                getWorkOrderById(id),
                getAssets({ take: 500, ia: true }),
                getPeopleSimple({ take: 500, includeInactive: true }),
            ]);

            setWo(woData);
            setAssets(safeArray<AssetDto>(assetsData));
            setPeople(safeArray<PersonSimpleDto>(peopleData));

            setForm({
                title: woData.title || "",
                description: woData.description || "",
                status: woData.status,
                assetId: woData.assetId || "",
                assignedToPersonId: woData.assignedToPersonId || "",
                startAt: toLocalInput(woData.startAt),
                stopAt: toLocalInput(woData.stopAt),
                defect: woData.defect || "",
                cause: woData.cause || "",
                solution: woData.solution || "",
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Eroare la incarcarea datelor";
            setErr(msg);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const handleUpdate = useCallback(async () => {
        if (!id) return;
        if (!canSave) return;

        setActionLoading(true);
        setErr(null);

        try {
            await updateWorkOrder(id, {
                title: form.title.trim(),
                description: form.description?.trim() ? form.description.trim() : null,
                status: form.status,
                assetId: form.assetId || null,
                assignedToPersonId: form.assignedToPersonId || null,
                startAt: localToIsoOrNull(form.startAt),
                stopAt: localToIsoOrNull(form.stopAt),
                defect: form.defect?.trim() ? form.defect.trim() : null,
                cause: form.cause?.trim() ? form.cause.trim() : null,
                solution: form.solution?.trim() ? form.solution.trim() : null,
            });
            await loadAll();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Eroare la salvare";
            setErr(msg);
        } finally {
            setActionLoading(false);
        }
    }, [id, form, loadAll, canSave]);

    const handleStatusAction = useCallback(
        async (fn: (id: string) => Promise<unknown>) => {
            if (!id) return;
            if (actionLoading) return;

            setActionLoading(true);
            setErr(null);

            try {
                await fn(id);
                await loadAll();
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Eroare la schimbare status";
                setErr(msg);
            } finally {
                setActionLoading(false);
            }
        },
        [id, loadAll, actionLoading]
    );

    if (loading && !wo) {
        return (
            <AppShell title="Incarcare...">
                <div className="p-8 text-zinc-500">Se incarca...</div>
            </AppShell>
        );
    }

    return (
        <AppShell title="Detalii Ordin Lucru">
            <PageToolbar
                left={
                    <div className="flex flex-col">
                        <Link to="/work-orders" className="text-xs text-teal-500 hover:underline">
                            ← Inapoi la lista
                        </Link>
                        <div className="text-sm font-bold text-zinc-200">
                            #{id?.substring(0, 8)} - {wo?.title}
                        </div>
                    </div>
                }
                right={
                    <div className="flex gap-2">
                        <Button onClick={loadAll} variant="ghost" size="sm" disabled={loading || actionLoading}>
                            Actualizeaza
                        </Button>
                        <Button
                            onClick={() => window.open(`/work-orders/${id}/print`, "_blank")}
                            variant="ghost"
                            size="sm"
                        >
                            🖨️ Print
                        </Button>
                    </div>
                }
            />

            {err ? <ErrorBox message={err} onClose={() => setErr(null)} /> : null}

            {wo ? (
                <div className="grid gap-6 pb-20">
                    <Card title="Echipa & Planificare">
                        <WoAssignmentsPanel workOrderId={id!} />
                    </Card>

                    <Card title="Informatii Generale">
                        <div className="grid gap-4 lg:grid-cols-12">
                            <div className="lg:col-span-8">
                                <Field label="Titlu Lucrare">
                                    <Input
                                        value={form.title}
                                        onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                                    />
                                </Field>
                            </div>

                            <div className="lg:col-span-4">
                                <Field label="Status">
                                    <Select
                                        value={form.status}
                                        onChange={(e) =>
                                            setForm((s) => ({ ...s, status: Number(e.target.value) as WorkOrderStatus }))
                                        }
                                    >
                                        <option value={WorkOrderStatus.Open}>Deschis</option>
                                        <option value={WorkOrderStatus.InProgress}>In Lucru</option>
                                        <option value={WorkOrderStatus.Done}>Finalizat</option>
                                        <option value={WorkOrderStatus.Cancelled}>Anulat</option>
                                    </Select>
                                </Field>
                            </div>

                            <div className="lg:col-span-6">
                                <Field label="Responsabil Principal (Legacy)">
                                    <Select
                                        value={form.assignedToPersonId}
                                        onChange={(e) => setForm((s) => ({ ...s, assignedToPersonId: e.target.value }))}
                                    >
                                        <option value="">(Nealocat)</option>
                                        {sortedPeople.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.displayName}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            </div>

                            <div className="lg:col-span-6">
                                <Field label="Activ / Echipament">
                                    <Select
                                        value={form.assetId}
                                        onChange={(e) => setForm((s) => ({ ...s, assetId: e.target.value }))}
                                    >
                                        <option value="">(Fara activ)</option>
                                        {sortedAssets.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.name} {a.code ? `[${a.code}]` : ""}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            </div>

                            <div className="lg:col-span-3">
                                <Field label="Data Start">
                                    <input
                                        type="datetime-local"
                                        className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100"
                                        value={form.startAt}
                                        onChange={(e) => setForm((s) => ({ ...s, startAt: e.target.value }))}
                                    />
                                </Field>
                            </div>

                            <div className="lg:col-span-3">
                                <Field label="Data Stop">
                                    <input
                                        type="datetime-local"
                                        className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100"
                                        value={form.stopAt}
                                        onChange={(e) => setForm((s) => ({ ...s, stopAt: e.target.value }))}
                                    />
                                </Field>
                            </div>

                            <div className="lg:col-span-12">
                                <Field label="Descriere Detaliata">
                                    <textarea
                                        rows={6}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-100 placeholder-zinc-600"
                                        value={form.description}
                                        onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                                        placeholder="Descrie lucrarea, pasii de executie, observatii..."
                                    />
                                </Field>
                            </div>
                        </div>

                        <div className="mt-6 border-t border-white/5 pt-6 grid gap-4 lg:grid-cols-12">
                            <div className="lg:col-span-12">
                                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">
                                    Raport Tehnic (Interventie)
                                </h3>
                            </div>

                            <div className="lg:col-span-12">
                                <Field label="Defect Constatat">
                                    <textarea
                                        rows={2}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-100 placeholder-zinc-600"
                                        value={form.defect}
                                        onChange={(e) => setForm((s) => ({ ...s, defect: e.target.value }))}
                                        placeholder="Ce a fost defect..."
                                    />
                                </Field>
                            </div>

                            <div className="lg:col-span-12">
                                <Field label="Cauza Defectiunii">
                                    <textarea
                                        rows={2}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-100 placeholder-zinc-600"
                                        value={form.cause}
                                        onChange={(e) => setForm((s) => ({ ...s, cause: e.target.value }))}
                                        placeholder="De ce s-a intamplat..."
                                    />
                                </Field>
                            </div>

                            <div className="lg:col-span-12">
                                <Field label="Solutie Aplicata">
                                    <textarea
                                        rows={3}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-100 placeholder-zinc-600"
                                        value={form.solution}
                                        onChange={(e) => setForm((s) => ({ ...s, solution: e.target.value }))}
                                        placeholder="Ce s-a facut pentru remediere..."
                                    />
                                </Field>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center justify-between border-t border-white/5 pt-4 gap-4">
                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
                                Durata automata:{" "}
                                <span className="text-zinc-300 font-mono">{wo.durationMinutes ?? 0} min</span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button onClick={handleUpdate} disabled={!canSave} variant="primary">
                                    Salveaza Modificari
                                </Button>

                                <div className="w-px h-8 bg-white/10 mx-2" />

                                <Button
                                    onClick={() => handleStatusAction(startWorkOrder)}
                                    variant="ghost"
                                    size="sm"
                                    disabled={actionLoading}
                                >
                                    Start
                                </Button>
                                <Button
                                    onClick={() => handleStatusAction(stopWorkOrder)}
                                    variant="ghost"
                                    size="sm"
                                    disabled={actionLoading}
                                >
                                    Stop
                                </Button>
                                <Button
                                    onClick={() => handleStatusAction(reopenWorkOrder)}
                                    variant="ghost"
                                    size="sm"
                                    disabled={actionLoading}
                                >
                                    Redeschide
                                </Button>
                                <Button
                                    onClick={() => handleStatusAction(cancelWorkOrder)}
                                    variant="ghost"
                                    size="sm"
                                    disabled={actionLoading}
                                >
                                    Anuleaza
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <PartsManager workOrderId={id!} disabled={actionLoading} />
                    <LaborLogsManager workOrderId={id!} />
                </div>
            ) : null}
        </AppShell>
    );
}

// ---------------- PartsManager ----------------
function PartsManager({ workOrderId, disabled }: { workOrderId: string; disabled?: boolean }) {
    const [woParts, setWoParts] = useState<WorkOrderPartDto[]>([]);
    const [catalog, setCatalog] = useState<PartDto[]>([]);
    const [search, setSearch] = useState("");
    const [selectedPartId, setSelectedPartId] = useState("");
    const [qty, setQty] = useState("1");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const [saved, all] = await Promise.all([
                getWorkOrderParts(workOrderId),
                getParts({ take: 50, q: search || undefined, ia: true }),
            ]);
            setWoParts(safeArray<WorkOrderPartDto>(saved));
            setCatalog(safeArray<PartDto>(all));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Eroare la incarcarea pieselor";
            setErr(msg);
            setWoParts([]);
            setCatalog([]);
        } finally {
            setLoading(false);
        }
    }, [workOrderId, search]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAdd = useCallback(async () => {
        const n = parseQty(qty);
        if (!selectedPartId || !n || n <= 0) return;

        setLoading(true);
        setErr(null);
        try {
            await addWorkOrderPart(workOrderId, selectedPartId, n);
            setQty("1");
            setSelectedPartId("");
            await loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Eroare la adaugare piesa";
            setErr(msg);
        } finally {
            setLoading(false);
        }
    }, [qty, selectedPartId, workOrderId, loadData]);

    return (
        <Card title="Piese Utilizate">
            {err ? <ErrorBox message={err} onClose={() => setErr(null)} /> : null}

            <div className="grid gap-4 sm:grid-cols-12 items-end mb-6">
                <div className="sm:col-span-4">
                    <Field label="Cauta in Catalog">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Nume sau cod..."
                            disabled={disabled}
                        />
                    </Field>
                </div>

                <div className="sm:col-span-5">
                    <Field label="Selecteaza Piesa">
                        <Select
                            value={selectedPartId}
                            onChange={(e) => setSelectedPartId(e.target.value)}
                            disabled={disabled}
                        >
                            <option value="">-- Alege piesa --</option>
                            {catalog.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                    {p.code ? ` (${p.code})` : ""}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </div>

                <div className="sm:col-span-2">
                    <Field label="Cantitate">
                        <Input value={qty} onChange={(e) => setQty(e.target.value)} disabled={disabled} />
                    </Field>
                </div>

                <div className="sm:col-span-1">
                    <Button
                        onClick={handleAdd}
                        variant="primary"
                        className="w-full"
                        disabled={disabled || loading}
                    >
                        Adauga
                    </Button>
                </div>
            </div>

            <TableShell>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500 border-b border-white/10">
                            <th className="p-3">Piesa</th>
                            <th className="p-3">Cod</th>
                            <th className="p-3 text-center">Cantitate</th>
                            <th className="p-3 text-right">Actiuni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {woParts.map((p) => (
                            <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="p-3 font-medium text-zinc-200">{p.partName}</td>
                                <td className="p-3 text-zinc-500">{p.partCode}</td>
                                <td className="p-3">
                                    <input
                                        key={p.qtyUsed} // Force re-render if backend value mismatches (e.g. revert)
                                        className="w-20 mx-auto block bg-zinc-900 border border-white/10 rounded px-2 py-1 text-center"
                                        defaultValue={String(p.qtyUsed)}
                                        disabled={disabled || loading}
                                        onBlur={async (e) => {
                                            const val = parseQty(e.target.value);
                                            try {
                                                if (val !== null && val > 0) {
                                                    // Optimization: don't call API if value hasn't changed
                                                    if (val === p.qtyUsed) return;

                                                    await setWorkOrderPartQty(workOrderId, p.id, val);
                                                }
                                            } catch (err: any) {
                                                setErr(err instanceof Error ? err.message : "Eroare la actualizare stoc");
                                            } finally {
                                                // Always reload to ensure UI matches backend (e.g. revert on error)
                                                loadData();
                                            }
                                        }}
                                    />
                                </td>
                                <td className="p-3 text-right">
                                    <button
                                        className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                                        disabled={disabled || loading}
                                        onClick={async () => {
                                            if (!window.confirm("Stergi piesa?")) return;
                                            try {
                                                await deleteWorkOrderPart(workOrderId, p.id);
                                            } catch (err: any) {
                                                setErr(err instanceof Error ? err.message : "Eroare la stergere piesa");
                                            } finally {
                                                loadData();
                                            }
                                        }}
                                    >
                                        Sterge
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {woParts.length === 0 ? <EmptyRow colSpan={4} text={loading ? "Se incarca..." : "Nu exista piese inregistrate."} /> : null}
                    </tbody>
                </table>
            </TableShell>
        </Card>
    );
}
