import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import {
    Button,
    Card,
    EmptyRow,
    ErrorBox,
    IconButton,
    Input,
    PageToolbar,
    Select,
    TableShell,
} from "../components/ui";
import {
    createExtraJob,
    deleteExtraJob,
    type ExtraJobDto,
    listExtraJobs,
    toggleExtraJob,
} from "../api/extraJobs";
import { getPeopleSimple, type PersonSimpleDto } from "../api";

export default function ExtraJobsPage() {
    const [items, setItems] = useState<ExtraJobDto[]>([]);
    const [people, setPeople] = useState<PersonSimpleDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter
    const [showDone, setShowDone] = useState(false);

    // Form
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [personId, setPersonId] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function load() {
        try {
            setLoading(true);
            setError(null);
            const [data, pData] = await Promise.all([
                listExtraJobs(showDone ? undefined : false),
                getPeopleSimple({ includeInactive: false }),
            ]);
            setItems(data);
            setPeople(Array.isArray(pData) ? pData : []);
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
                assignedToPersonId: personId || undefined,
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

    async function handleToggle(id: string) {
        try {
            await toggleExtraJob(id);
            await load();
        } catch (err: any) {
            setError(err.message || "Failed to toggle.");
        }
    }

    return (
        <AppShell title="Activitati Extra (IntExtra)">
            <PageToolbar
                left={<div className="text-xl font-bold text-zinc-100">Activitati Diverse (Regie)</div>}
                right={
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                            <input
                                type="checkbox"
                                className="rounded border-zinc-700 bg-zinc-800"
                                checked={showDone}
                                onChange={(e) => setShowDone(e.target.checked)}
                            />
                            Arata si finalizate
                        </label>
                        <Button onClick={load} variant="ghost" size="sm">
                            Refresh
                        </Button>
                    </div>
                }
            />

            {error && <ErrorBox message={error} onClose={() => setError(null)} />}

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Form */}
                <div className="lg:col-span-4">
                    <Card title="Adauga Activitate Noua">
                        <div className="flex flex-col gap-4">
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

                            <Button
                                variant="primary"
                                onClick={handleAdd}
                                disabled={!title.trim() || submitting}
                                className="mt-2"
                            >
                                Adauga
                            </Button>
                        </div>
                    </Card>
                </div>

                {/* List */}
                <div className="lg:col-span-8">
                    <Card>
                        {loading && <div className="p-4 text-center text-zinc-500">Se incarca...</div>}
                        <TableShell>
                            <table className="w-full text-left text-sm text-zinc-300">
                                <thead className="bg-white/5 text-zinc-400">
                                    <tr>
                                        <th className="px-4 py-3 w-10">Stare</th>
                                        <th className="px-4 py-3">Descriere</th>
                                        <th className="px-4 py-3">Responsabil</th>
                                        <th className="px-4 py-3 text-right">Data</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {items.map((it) => (
                                        <tr key={it.id} className={`hover:bg-white/5 ${it.isDone ? "opacity-50" : ""}`}>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={it.isDone}
                                                    onChange={() => handleToggle(it.id)}
                                                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-teal-500 focus:ring-teal-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className={`font-medium ${it.isDone ? "line-through text-zinc-500" : "text-zinc-200"}`}>
                                                    {it.title}
                                                </div>
                                                {it.description && (
                                                    <div className="text-xs text-zinc-500 mt-1">{it.description}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-zinc-400">
                                                {it.assignedToPersonName || "—"}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-zinc-500 text-xs">
                                                {new Date(it.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <IconButton
                                                    aria-label="Delete"
                                                    variant="danger"
                                                    onClick={() => handleDelete(it.id)}
                                                >
                                                    🗑️
                                                </IconButton>
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && <EmptyRow colSpan={5} text="Nu exista activitati." />}
                                </tbody>
                            </table>
                        </TableShell>
                    </Card>
                </div>
            </div>
        </AppShell>
    );
}
