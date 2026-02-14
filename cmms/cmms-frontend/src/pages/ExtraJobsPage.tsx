import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import {
    Button,
    Card,
    EmptyRow,
    ErrorBox,
    IconButton,
    Input,
    Select,
    TableShell,
} from "../components/ui";
import {
    createExtraJob,
    deleteExtraJob,
    type ExtraJobDto,
    listExtraJobs,
    WorkOrderStatus,
    startExtraJob,
    stopExtraJob,
    cancelExtraJob,
    reopenExtraJob,
} from "../api/extraJobs";
import { getPeopleSimple, type PersonSimpleDto, hasPerm, getCurrentUser } from "../api";

export default function ExtraJobsPage() {
    const [items, setItems] = useState<ExtraJobDto[]>([]);
    const [people, setPeople] = useState<PersonSimpleDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter
    const [showDone, setShowDone] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Form
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [personId, setPersonId] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const user = getCurrentUser();
    const isR0 = user?.roles?.some(r => r.rank === 0 || r.code === "R0_SYSTEM_ADMIN");

    async function load() {
        try {
            setLoading(true);
            setError(null);

            // Always load extra jobs (user has EXTRA_READ to access this page)
            const data = await listExtraJobs(showDone ? undefined : false);
            setItems(data);

            // Conditionally load people if user has permission
            if (hasPerm("PEOPLE_READ")) {
                try {
                    const pData = await getPeopleSimple({ includeInactive: false });
                    setPeople(Array.isArray(pData) ? pData : []);
                } catch (err) {
                    // Silently fail - people dropdown will be empty
                    console.warn("Failed to load people:", err);
                    setPeople([]);
                }
            } else {
                setPeople([]);
            }
        } catch (err: any) {
            setError(err.message || "Failed to load jobs.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, [showDone]);

    async function handleAdd() {
        if (!title.trim()) return;
        try {
            setSubmitting(true);
            await createExtraJob({
                title: title.trim(),
                description: desc.trim() || undefined,
                assignedToPersonId: isR0 ? (personId || undefined) : undefined, // Backend will auto-assign for non-R0
            });
            setTitle("");
            setDesc("");
            setPersonId("");
            await load();
        } catch (err: any) {
            setError(err.message || "Failed to add job.");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure?")) return;
        try {
            await deleteExtraJob(id);
            await load();
        } catch (err: any) {
            setError(err.message || "Failed to delete.");
        }
    }

    async function handleAction(id: string, action: "start" | "stop" | "cancel" | "reopen") {
        try {
            if (action === "start") await startExtraJob(id);
            else if (action === "stop") await stopExtraJob(id);
            else if (action === "cancel") await cancelExtraJob(id);
            else if (action === "reopen") await reopenExtraJob(id);
            await load();
        } catch (err: any) {
            setError(err.message || `Failed to ${action}.`);
        }
    }

    function renderStatus(s: WorkOrderStatus) {
        switch (s) {
            case WorkOrderStatus.Open:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900 text-blue-100">Open</span>;
            case WorkOrderStatus.InProgress:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-900 text-yellow-100 animate-pulse">In Progress</span>;
            case WorkOrderStatus.Done:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900 text-green-100">Done</span>;
            case WorkOrderStatus.Cancelled:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-700 text-zinc-300">Cancelled</span>;
            default:
                return <span className="text-zinc-500">?</span>;
        }
    }

    function canManage(it: ExtraJobDto) {
        if (isR0) return true;
        if (it.createdByUserId === user?.id) return true;
        if (it.assignedToPersonId === user?.personId) return true;
        return false;
    }

    const filteredItems = items.filter(it => {
        const matchesOwnership = isR0 || it.createdByUserId === user?.id || it.assignedToPersonId === user?.personId;
        if (!matchesOwnership) return false;

        if (searchTerm.trim()) {
            const s = searchTerm.toLowerCase();
            const match =
                it.title.toLowerCase().includes(s) ||
                (it.description?.toLowerCase().includes(s)) ||
                (it.assignedToPersonName?.toLowerCase().includes(s));
            if (!match) return false;
        }

        return true;
    });

    return (
        <AppShell
            title="Activitati Extra (IntExtra)"
            headerActions={
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer bg-white/5 px-2 py-1 h-8 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-white/20 bg-white/10"
                            checked={showDone}
                            onChange={(e) => setShowDone(e.target.checked)}
                        />
                        <span className="hidden sm:inline">Arata si finalizate</span>
                        <span className="sm:hidden">Finalizate</span>
                    </label>

                    <div className="w-40 sm:w-64">
                        <input
                            type="text"
                            placeholder="Cauta in activitati..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/10 px-3 h-8 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-teal-400/40"
                        />
                    </div>

                    <Button onClick={load} disabled={loading} variant="ghost" size="sm" className="h-8 px-3 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                        {loading ? "..." : "Actualizeaza"}
                    </Button>
                </div>
            }
        >

            {error && <ErrorBox message={error} onClose={() => setError(null)} />}
            {/* Form */}
            {hasPerm("EXTRA_CREATE") && (
                <Card title="Adauga Activitate Noua">
                    <div className={hasPerm("PEOPLE_READ") ? "grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end" : "grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end"}>
                        <Input
                            label="Titlu Activitate"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Curatenie, Vopsit..."
                        />
                        <Input
                            label="Detalii (Optional)"
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                        />

                        {hasPerm("PEOPLE_READ") && (
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-semibold uppercase text-zinc-500">Responsabil</span>
                                <Select
                                    value={personId}
                                    onChange={(e) => setPersonId(e.target.value)}
                                >
                                    <option value="">-- Nimeni --</option>
                                    {people.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.displayName}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}

                        <Button
                            variant="primary"
                            onClick={handleAdd}
                            disabled={!title.trim() || submitting}
                            className="h-10"
                        >
                            Adauga
                        </Button>
                    </div>
                </Card>
            )}

            {/* List */}
            <div className="mt-6" />

            {loading && <div className="mb-4 text-center text-zinc-500 font-mono">Se incarca...</div>}

            <TableShell minWidth={900}>
                <table className="w-full text-left text-sm text-zinc-300">
                    <thead className="bg-white/5 text-zinc-400">
                        <tr>
                            <th className="px-3 py-2 w-24">Stare</th>
                            <th className="px-3 py-2">Descriere</th>
                            <th className="px-3 py-2">Responsabil</th>
                            <th className="px-3 py-2 text-right">Start / Stop</th>
                            <th className="px-3 py-2 text-right w-40">Actiuni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredItems.map((it) => (
                            <tr key={it.id} className={`hover:bg-white/5 ${it.status === WorkOrderStatus.Cancelled ? "opacity-50" : ""}`}>
                                <td className="px-3 py-1.5">
                                    {renderStatus(it.status)}
                                </td>
                                <td className="px-3 py-1.5">
                                    <div className="font-medium text-zinc-200 truncate max-w-[300px]" title={it.title}>
                                        {it.title}
                                    </div>
                                    {it.description && (
                                        <div className="text-[10px] text-zinc-500 truncate max-w-[300px]" title={it.description}>{it.description}</div>
                                    )}
                                </td>
                                <td className="px-3 py-1.5 text-zinc-400 text-xs">
                                    {it.responsibleName || "—"}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-zinc-500 text-[10px] leading-tight">
                                    {it.startAt ? new Date(it.startAt).toLocaleString() : "—"}
                                    <br />
                                    {it.stopAt ? new Date(it.stopAt).toLocaleString() : "—"}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        {hasPerm("EXTRA_EXECUTE") && canManage(it) && (
                                            <>
                                                {it.status === WorkOrderStatus.Open && (
                                                    <>
                                                        <Button size="sm" variant="primary" className="h-7 px-2" onClick={() => handleAction(it.id, "start")}>Start</Button>
                                                        <Button size="sm" variant="ghost" className="h-7 px-2 border border-zinc-600" onClick={() => handleAction(it.id, "cancel")}>Cancel</Button>
                                                    </>
                                                )}
                                                {it.status === WorkOrderStatus.InProgress && (
                                                    <>
                                                        <Button size="sm" variant="primary" className="h-7 px-2 bg-red-600 hover:bg-red-700 text-white" onClick={() => handleAction(it.id, "stop")}>Stop</Button>
                                                        <Button size="sm" variant="ghost" className="h-7 px-2 border border-zinc-600" onClick={() => handleAction(it.id, "cancel")}>Cancel</Button>
                                                    </>
                                                )}
                                                {(it.status === WorkOrderStatus.Done || it.status === WorkOrderStatus.Cancelled) && (
                                                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleAction(it.id, "reopen")}>Reopen</Button>
                                                )}
                                            </>
                                        )}

                                        {hasPerm("EXTRA_DELETE") && canManage(it) && (
                                            <IconButton
                                                aria-label="Delete"
                                                variant="danger"
                                                size="sm"
                                                onClick={() => handleDelete(it.id)}
                                            >
                                                🗑️
                                            </IconButton>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && <EmptyRow colSpan={5} text="Nu exista activitati." />}
                    </tbody>
                </table>
            </TableShell>
        </AppShell>
    );
}
