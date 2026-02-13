// src/pages/AssetsPage.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import AppShell from "../components/AppShell";
import {
    createAsset,
    deleteAsset,
    updateAsset,
    getAssets,
    getLocs,
    type AssetDto,
    type LocDto,
} from "../api";
import {
    Button,
    Card,
    EmptyRow,
    ErrorBox,
    Input,
    PageToolbar,
    Pill,
    Select,
    TableShell,
    Modal,
    FieldLabel,
    cx,
} from "../components/ui";

function StatusPill({ isActive }: { isActive: boolean }) {
    return <Pill tone={isActive ? "emerald" : "zinc"}>{isActive ? "Activ" : "Sters"}</Pill>;
}

export default function AssetsPage() {
    const [items, setItems] = useState<AssetDto[]>([]);
    const [locs, setLocs] = useState<LocDto[]>([]);

    const [q, setQ] = useState("");
    const [showDel, setShowDel] = useState(false);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Create State
    const [newName, setNewName] = useState("");
    const [newCode, setNewCode] = useState("");
    const [newRanking, setNewRanking] = useState("");
    const [locId, setLocId] = useState("");

    // Edit State
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editCode, setEditCode] = useState("");
    const [editRanking, setEditRanking] = useState("");
    const [editLocId, setEditLocId] = useState("");
    const [saving, setSaving] = useState(false);

    const canCreate = useMemo(() => newName.trim().length >= 2, [newName]);

    const load = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const data = await getAssets({
                q: q.trim() || undefined,
                take: 200,
                ia: showDel,
            });
            setItems(Array.isArray(data) ? data : []);
        } catch (e) {
            const error = e as Error;
            setErr(error.message || "A apărut o eroare la încărcarea activelor.");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [q, showDel]);

    const loadLocs = useCallback(async () => {
        try {
            const data = await getLocs({ take: 500 });
            setLocs(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        loadLocs();
        load();
    }, [load, loadLocs]);

    // Validation for Ranking (A-Z)
    const handleRankingChange = (val: string, setter: (v: string) => void) => {
        const v = val.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1);
        setter(v);
    };

    async function onCreate() {
        if (!canCreate) return;
        setErr(null);
        try {
            await createAsset({
                name: newName.trim(),
                code: newCode.trim() || undefined,
                locId: locId || undefined,
                ranking: newRanking || undefined,
            });
            setNewName("");
            setNewCode("");
            setNewRanking("");
            setLocId("");
            await load();
        } catch (e) {
            const error = e as Error;
            setErr(error.message || "Eroare la crearea activului.");
        }
    }

    async function onDelete(id: string, isActive: boolean) {
        if (!isActive) return;
        if (!window.confirm("Stergeti utilajul?")) return;
        setErr(null);
        try {
            await deleteAsset(id);
            await load();
        } catch (e) {
            const error = e as Error;
            setErr(error.message || "Eroare la ștergerea activului.");
        }
    }

    function openEdit(item: AssetDto) {
        setEditId(item.id);
        setEditName(item.name);
        setEditCode(item.code || "");
        setEditRanking(item.ranking || "");
        setEditLocId(item.locId || "");
    }

    async function onUpdate() {
        if (!editId) return;
        setSaving(true);
        try {
            await updateAsset(editId, {
                name: editName.trim(),
                code: editCode.trim() || undefined,
                locId: editLocId || undefined,
                ranking: editRanking || undefined,
            });
            setEditId(null);
            await load();
        } catch (e) {
            alert("Eroare la actualizare: " + (e as Error).message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <AppShell title="Utilaje">
            <PageToolbar
                left={
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex-1">
                            <Input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") load();
                                }}
                                placeholder="Cauta utilaje..."
                            />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showDel}
                                onChange={(e) => setShowDel(e.target.checked)}
                                className="h-4 w-4 rounded border-white/20 bg-white/10"
                            />
                            Arata sterse
                        </label>
                    </div>
                }
                right={
                    <div className="flex items-center gap-2">
                        <Button onClick={load} disabled={loading} variant="ghost">
                            {loading ? "Se incarca..." : "Actualizeaza"}
                        </Button>
                    </div>
                }
            />

            {err ? <ErrorBox message={err} onClose={() => setErr(null)} /> : null}

            <Card title="Utilaj Nou">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="lg:col-span-2">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Nume"
                        />
                    </div>

                    <Input
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        placeholder="Cod"
                    />

                    <Input
                        value={newRanking}
                        onChange={(e) => handleRankingChange(e.target.value, setNewRanking)}
                        placeholder="Rank (A-Z)"
                        maxLength={1}
                    />

                    <div className="col-span-1 flex gap-2">
                        <div className="flex-1">
                            <Select value={locId} onChange={(e) => setLocId(e.target.value)}>
                                <option value="">(Fara locatie)</option>
                                {locs.map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <Button onClick={onCreate} disabled={!canCreate} variant="primary">
                            Creeaza
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="mt-6" />

            <TableShell minWidth={900}>
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-white/5 text-zinc-300">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Nume</th>
                            <th className="px-4 py-3 text-left font-semibold">Cod</th>
                            <th className="px-4 py-3 text-left font-semibold">Locatie</th>
                            <th className="px-4 py-3 text-left font-semibold w-24">Rank</th>
                            <th className="px-4 py-3 text-left font-semibold w-24">Status</th>
                            <th className="px-4 py-3 text-right font-semibold">Actiuni</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-white/10">
                        {items.map((x) => {
                            const isActive = x.isAct !== false;
                            return (
                                <tr key={x.id} className="hover:bg-white/5">
                                    <td className="px-4 py-3 text-zinc-100 font-medium">{x.name}</td>
                                    <td className="px-4 py-3 text-zinc-300">{x.code ?? "-"}</td>
                                    <td className="px-4 py-3 text-zinc-300">{x.locName ?? "-"}</td>
                                    <td className="px-4 py-3">
                                        {x.ranking ? (
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-indigo-500/20 text-indigo-300 font-bold text-xs ring-1 ring-indigo-500/40">
                                                {x.ranking}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-500">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusPill isActive={isActive} />
                                    </td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(x)}>
                                            Edit
                                        </Button>
                                        <button
                                            onClick={() => onDelete(x.id, isActive)}
                                            disabled={!isActive}
                                            className={cx(
                                                "rounded px-2 py-1 text-xs font-semibold transition-colors",
                                                isActive
                                                    ? "text-red-400 hover:bg-white/5"
                                                    : "text-zinc-600 cursor-not-allowed"
                                            )}
                                        >
                                            Sterge
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}

                        {!loading && items.length === 0 ? (
                            <EmptyRow colSpan={6} text="Nu au fost gasite utilaje." />
                        ) : null}
                    </tbody>
                </table>
            </TableShell>

            {editId && (
                <Modal title="Editeaza Utilaj" onClose={() => setEditId(null)}>
                    <div className="space-y-4">
                        <div>
                            <FieldLabel>Nume</FieldLabel>
                            <Input value={editName} onChange={e => setEditName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <FieldLabel>Cod</FieldLabel>
                                <Input value={editCode} onChange={e => setEditCode(e.target.value)} />
                            </div>
                            <div>
                                <FieldLabel>Rank (A-Z)</FieldLabel>
                                <Input
                                    value={editRanking}
                                    onChange={e => handleRankingChange(e.target.value, setEditRanking)}
                                    maxLength={1}
                                />
                            </div>
                        </div>
                        <div>
                            <FieldLabel>Locatie</FieldLabel>
                            <Select value={editLocId} onChange={e => setEditLocId(e.target.value)}>
                                <option value="">(Fara locatie)</option>
                                {locs.map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setEditId(null)} disabled={saving}>Anuleaza</Button>
                            <Button variant="primary" onClick={onUpdate} disabled={saving}>
                                {saving ? "Se salveaza..." : "Salveaza"}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </AppShell>
    );
}