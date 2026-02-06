// src/pages/WorkOrderDetailsPage.tsx
import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import WoAssignmentsPanel from "../components/WoAssignmentsPanel";
import LaborLogsManager from "../components/LaborLogsManager"; // Importul nou
import {
    cancelWorkOrder, getAssets, getPeopleSimple, getWorkOrderById,
    reopenWorkOrder, startWorkOrder, stopWorkOrder, updateWorkOrder,
    getParts, addWorkOrderPart, getWorkOrderParts, deleteWorkOrderPart,
    setWorkOrderPartQty, type AssetDto, type PersonDto, type WorkOrderDetailsDto,
    type PartDto, type WorkOrderPartDto
} from "../api";
import {
    Button, Card, EmptyRow, ErrorBox, Input, PageToolbar,
    Select, TableShell
} from "../components/ui";

// --- Helpers de formatare ---
const toLocalInput = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const parseQty = (input: string): number | null => {
    const s = (input ?? "").trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
        {children}
    </div>
);

export default function WorkOrderDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [wo, setWo] = useState<WorkOrderDetailsDto | null>(null);
    const [assets, setAssets] = useState<AssetDto[]>([]);
    const [people, setPeople] = useState<PersonDto[]>([]);

    const [form, setForm] = useState({
        title: "",
        description: "",
        status: 1,
        assetId: "",
        assignedToPersonId: "",
        startAt: "",
        stopAt: ""
    });

    const canSave = form.title.trim().length >= 2;

    const loadAll = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [woData, assetsData, peopleData] = await Promise.all([
                getWorkOrderById(id),
                getAssets({ take: 500, ia: true }),
                getPeopleSimple()
            ]);

            setWo(woData);
            setAssets(Array.isArray(assetsData) ? assetsData : []);
            setPeople(Array.isArray(peopleData) ? peopleData : []);

            setForm({
                title: woData.title || "",
                description: woData.description || "",
                status: woData.status,
                assetId: woData.assetId || "",
                assignedToPersonId: woData.assignedToPersonId || "",
                startAt: toLocalInput(woData.startAt),
                stopAt: toLocalInput(woData.stopAt)
            });
        } catch (e: any) {
            setErr(e?.message || "Eroare la incarcarea datelor");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { loadAll(); }, [loadAll]);

    async function handleUpdate() {
        if (!id) return;
        try {
            setErr(null);
            await updateWorkOrder(id, {
                ...form,
                startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
                stopAt: form.stopAt ? new Date(form.stopAt).toISOString() : null,
            });
            await loadAll();
        } catch (e: any) { setErr(e.message); }
    }

    async function handleStatusAction(fn: (id: string) => Promise<any>) {
        if (!id) return;
        try {
            setErr(null);
            await fn(id);
            await loadAll();
        } catch (e: any) { setErr(e.message); }
    }

    if (loading && !wo) return <AppShell title="Incarcare..."><div className="p-8 text-zinc-500">Se incarca...</div></AppShell>;

    return (
        <AppShell title="Detalii Ordin Lucru">
            <PageToolbar
                left={
                    <div className="flex flex-col">
                        <Link to="/work-orders" className="text-xs text-teal-500 hover:underline">← Inapoi la lista</Link>
                        <div className="text-sm font-bold text-zinc-200">#{id?.substring(0, 8)} - {wo?.title}</div>
                    </div>
                }
                right={<Button onClick={loadAll} variant="ghost" size="sm">Refresh</Button>}
            />

            {err && <ErrorBox message={err} />}

            {wo && (
                <div className="grid gap-6 pb-20">
                    <Card title="Informatii Generale">
                        <div className="mt-4 mb-6">
                            <WoAssignmentsPanel workOrderId={id!} />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-12">
                            <div className="lg:col-span-6">
                                <Field label="Titlu Lucrare">
                                    <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                                </Field>
                            </div>
                            <div className="lg:col-span-3">
                                <Field label="Status">
                                    <Select value={form.status} onChange={e => setForm({ ...form, status: Number(e.target.value) })}>
                                        <option value={1}>Deschis (Open)</option>
                                        <option value={2}>In Lucru (In Progress)</option>
                                        <option value={3}>Inchis (Closed)</option>
                                        <option value={4}>Anulat (Canceled)</option>
                                    </Select>
                                </Field>
                            </div>
                            <div className="lg:col-span-3">
                                <Field label="Responsabil">
                                    <Select value={form.assignedToPersonId} onChange={e => setForm({ ...form, assignedToPersonId: e.target.value })}>
                                        <option value="">(Nealocat)</option>
                                        {people.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                                    </Select>
                                </Field>
                            </div>

                            <div className="lg:col-span-6">
                                <Field label="Activ / Echipament">
                                    <Select value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })}>
                                        <option value="">(Fara activ)</option>
                                        {assets.map(a => <option key={a.id} value={a.id}>{a.name} {a.code ? `[${a.code}]` : ""}</option>)}
                                    </Select>
                                </Field>
                            </div>
                            <div className="lg:col-span-3">
                                <Field label="Data Start">
                                    <input type="datetime-local" className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100"
                                        value={form.startAt} onChange={e => setForm({ ...form, startAt: e.target.value })} />
                                </Field>
                            </div>
                            <div className="lg:col-span-3">
                                <Field label="Data Stop">
                                    <input type="datetime-local" className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100"
                                        value={form.stopAt} onChange={e => setForm({ ...form, stopAt: e.target.value })} />
                                </Field>
                            </div>

                            <div className="lg:col-span-12">
                                <Field label="Descriere Detaliata">
                                    <textarea rows={3} className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-100"
                                        value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                                </Field>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center justify-between border-t border-white/5 pt-4 gap-4">
                            <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
                                Durata automata: <span className="text-zinc-300 font-mono">{wo.durationMinutes || 0} min</span>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleUpdate} disabled={!canSave} variant="primary">Salveaza Modificari</Button>
                                <div className="w-px h-8 bg-white/10 mx-2" />
                                <Button onClick={() => handleStatusAction(startWorkOrder)} variant="ghost" size="sm">Start</Button>
                                <Button onClick={() => handleStatusAction(stopWorkOrder)} variant="ghost" size="sm">Stop</Button>
                                <Button onClick={() => handleStatusAction(reopenWorkOrder)} variant="ghost" size="sm">Redeschide</Button>
                            </div>
                        </div>
                    </Card>

                    {/* Sectiune Piese */}
                    <PartsManager workOrderId={id!} assetId={form.assetId} />

                    {/* Sectiune Timp Lucrat (Log-uri) */}
                    <LaborLogsManager workOrderId={id!} />
                </div>
            )}
        </AppShell>
    );
}

// --- Componenta interna PartsManager (neschimbata, inclusa pentru context) ---
function PartsManager({ workOrderId, assetId }: { workOrderId: string, assetId?: string }) {
    const [woParts, setWoParts] = useState<WorkOrderPartDto[]>([]);
    const [catalog, setCatalog] = useState<PartDto[]>([]);
    const [search, setSearch] = useState("");
    const [selectedPartId, setSelectedPartId] = useState("");
    const [qty, setQty] = useState("1");
    const [loading, setLoading] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [saved, all] = await Promise.all([
                getWorkOrderParts(workOrderId),
                getParts({ take: 50, q: search || undefined, assetId: assetId || undefined })
            ]);
            setWoParts(saved);
            setCatalog(all);
        } finally { setLoading(false); }
    }, [workOrderId, search, assetId]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAdd = async () => {
        const n = parseQty(qty);
        if (!selectedPartId || !n) return;
        await addWorkOrderPart(workOrderId, selectedPartId, n);
        setQty("1");
        setSelectedPartId("");
        loadData();
    };

    return (
        <Card title="Piese Utilizate">
            <div className="grid gap-4 sm:grid-cols-12 items-end mb-6">
                <div className="sm:col-span-4">
                    <Field label="Cauta in Catalog">
                        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nume sau cod..." />
                    </Field>
                </div>
                <div className="sm:col-span-5">
                    <Field label="Selecteaza Piesa">
                        <Select value={selectedPartId} onChange={e => setSelectedPartId(e.target.value)}>
                            <option value="">-- Alege piesa --</option>
                            {catalog.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                        </Select>
                    </Field>
                </div>
                <div className="sm:col-span-2">
                    <Field label="Cantitate">
                        <Input value={qty} onChange={e => setQty(e.target.value)} />
                    </Field>
                </div>
                <div className="sm:col-span-1">
                    <Button onClick={handleAdd} variant="primary" className="w-full">Add</Button>
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
                        {woParts.map(p => (
                            <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="p-3 font-medium text-zinc-200">{p.partName}</td>
                                <td className="p-3 text-zinc-500">{p.partCode}</td>
                                <td className="p-3">
                                    <input
                                        className="w-20 mx-auto block bg-zinc-900 border border-white/10 rounded px-2 py-1 text-center"
                                        defaultValue={p.qtyUsed}
                                        onBlur={async (e) => {
                                            const val = parseQty(e.target.value);
                                            if (val !== null) {
                                                await setWorkOrderPartQty(workOrderId, p.id, val);
                                                loadData();
                                            }
                                        }}
                                    />
                                </td>
                                <td className="p-3 text-right">
                                    <button className="text-red-400 hover:text-red-300 text-xs"
                                        onClick={async () => { if (confirm("Stergi piesa?")) { await deleteWorkOrderPart(workOrderId, p.id); loadData(); } }}>
                                        Sterge
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {woParts.length === 0 && <EmptyRow colSpan={4} text="Nu exista piese inregistrate." />}
                    </tbody>
                </table>
            </TableShell>
        </Card>
    );
}