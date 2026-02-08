import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import {
    getRoles,
    createRole,
    updateRole,
    type RoleDto,
} from "../api/roles";

import { Button, Card, ErrorBox, Input, PageToolbar, TableShell, Pill } from "../components/ui";

function safeArray<T>(x: unknown): T[] {
    return Array.isArray(x) ? (x as T[]) : [];
}

export default function RolesPage() {
    const [items, setItems] = useState<RoleDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [name, setName] = useState("");

    const stats = useMemo(() => {
        const total = items.length;
        const inactive = items.filter((r) => r.isActive === false).length;
        return { total, inactive };
    }, [items]);

    // edit state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const data = await getRoles({ take: 500, includeInactive: true });
            setItems(safeArray<RoleDto>(data));
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function onCreate() {
        const n = (name ?? "").trim();
        if (n.length < 2) return setErr("Nume prea scurt (min 2 caractere).");
        setErr(null);
        try {
            await createRole(n, 0);
            setName("");
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    function startEdit(r: RoleDto) {
        setEditingId(r.id);
        setEditName(r.name ?? "");
    }

    function cancelEdit() {
        setEditingId(null);
        setEditName("");
    }

    async function handleSave(id: string) {
        const n = (editName ?? "").trim();
        if (n.length < 2) return setErr("Nume prea scurt (min 2 caractere).");
        setErr(null);
        try {
            const r = items.find((x) => x.id === id);
            if (!r) throw new Error("Rolul nu a fost gasit");
            await updateRole(id, n, r.sortOrder ?? 0, r.isActive);
            cancelEdit();
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Stergi rolul?")) return;
        setErr(null);
        try {
            const r = items.find((x) => x.id === id);
            if (!r) throw new Error("Rolul nu a fost gasit");
            // soft delete -> set IsActive = false
            await updateRole(id, r.name, r.sortOrder ?? 0, false);
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    return (
        <AppShell title="Roluri">
            <PageToolbar
                left={
                    <div className="flex items-center gap-2">
                        <div className="text-sm text-zinc-400">Gestioneaza rolurile de asignare</div>
                        <div className="ml-4 text-xs text-zinc-500">Exemple: Responsabil, Coordonator, Manipulant</div>
                    </div>
                }
                right={
                    <div className="flex items-center gap-2">
                        <Pill tone="zinc">Randuri: {stats.total}</Pill>
                        {stats.inactive > 0 ? <Pill tone="amber">Inactive: {stats.inactive}</Pill> : null}
                        <Button onClick={load} variant="ghost" disabled={loading}>{loading ? "Se incarca..." : "Actualizeaza"}</Button>
                    </div>
                }
            />

            {err ? <ErrorBox message={err} onClose={() => setErr(null)} /> : null}

            <Card title="Creeaza Rol">
                <div className="grid gap-3 sm:grid-cols-12 items-end">
                    <div className="sm:col-span-9">
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nume rol" />
                    </div>
                    <div className="sm:col-span-3 flex justify-end">
                        <Button variant="primary" onClick={onCreate} disabled={name.trim().length < 2}>{"Creeaza"}</Button>
                    </div>
                </div>
            </Card>

            <div className="mt-6" />

            <TableShell>
                <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-zinc-400">
                        <tr>
                            <th className="px-4 py-3">Nume</th>
                            <th className="px-4 py-3">Actiuni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {items.map((r) => (
                            <tr key={r.id} className="hover:bg-white/5">
                                <td className="px-4 py-3 font-medium text-zinc-100">
                                    {editingId === r.id ? (
                                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                                    ) : (
                                        r.name
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {editingId === r.id ? (
                                            <>
                                                <Button variant="ghost" onClick={cancelEdit}>Anuleaza</Button>
                                                <Button variant="primary" onClick={() => handleSave(r.id)}>Salveaza</Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button variant="ghost" onClick={() => startEdit(r)}>Modifica</Button>
                                                <Button variant="ghost" onClick={() => handleDelete(r.id)}>Sterge</Button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-6 text-zinc-400 text-center">Nu exista roluri definite.</td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </TableShell>
        </AppShell>
    );
}
