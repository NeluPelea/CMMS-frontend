import { useEffect, useState, useCallback, useMemo } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import AppShell from "../components/AppShell";
import { createLoc, deleteLoc, getLocs, type LocDto } from "../api";
import {
    Button,
    Card,
    EmptyRow,
    ErrorBox,
    Input,
    PageToolbar,
    Pill,
    TableShell,
    cx,
} from "../components/ui";

function StatusPill({ isActive }: { isActive: boolean }) {
    return (
        <Pill tone={isActive ? "emerald" : "zinc"}>
            {isActive ? "Active" : "Deleted"}
        </Pill>
    );
}

export default function LocationsPage() {
    const [items, setItems] = useState<LocDto[]>([]);
    const [q, setQ] = useState("");
    const [showDel, setShowDel] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [newName, setNewName] = useState("");
    const [newCode, setNewCode] = useState("");

    const canCreate = useMemo(() => newName.trim().length >= 2, [newName]);

    // Funcția de încărcare a datelor
    const load = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            // Trimitem explicit parametrul 'ia' bazat pe starea checkbox-ului
            const data = await getLocs({
                q: q.trim() || undefined,
                take: 500,
                ia: showDel,
            });

            // Log pentru debugging în consolă
            console.log("Date primite (showDel=" + showDel + "):", data);

            setItems(Array.isArray(data) ? data : []);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [q, showDel]);

    // Reîncărcăm datele ori de câte ori se schimbă bifa sau textul de căutare (opțional)
    useEffect(() => {
        load();
    }, [load]);

    const onCreate = async () => {
        if (!canCreate) return;
        setErr(null);
        try {
            await createLoc({
                name: newName.trim(),
                code: newCode.trim() || null,
            });
            setNewName("");
            setNewCode("");
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    };

    const onDelete = async (id: string) => {
        if (!confirm("Sigur doriți să ștergeți această locație?")) return;
        setErr(null);
        try {
            await deleteLoc(id);
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <AppShell title="Locations">
            <PageToolbar
                left={
                    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="w-full sm:max-w-md">
                            <Input
                                value={q}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
                                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === "Enter") load();
                                }}
                                placeholder="Căutare locații..."
                            />
                        </div>

                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-300 select-none bg-white/5 px-3 py-2 rounded-md hover:bg-white/10 transition-colors">
                            <input
                                type="checkbox"
                                checked={showDel}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                    setShowDel(e.target.checked);
                                }}
                                className="h-4 w-4 rounded border-white/20 bg-white/10 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                            />
                            <span>Show deleted</span>
                        </label>
                    </div>
                }
                right={
                    <Button onClick={load} disabled={loading} variant="ghost">
                        {loading ? "Loading..." : "Refresh"}
                    </Button>
                }
            />

            {err && <div className="mb-6"><ErrorBox message={err} /></div>}

            <Card title="New Location">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Input
                        value={newName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                        placeholder="Name"
                    />
                    <Input
                        value={newCode}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCode(e.target.value)}
                        placeholder="Code (optional)"
                    />
                    <Button onClick={onCreate} disabled={!canCreate || loading} variant="primary">
                        Create
                    </Button>
                </div>
            </Card>

            <div className="mt-6" />

            <TableShell minWidth={720}>
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-white/5 text-zinc-300">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Name</th>
                            <th className="px-4 py-3 text-left font-semibold">Code</th>
                            <th className="px-4 py-3 text-left font-semibold">Status</th>
                            <th className="px-4 py-3 text-right font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {items.map((x) => (
                            <tr
                                key={x.id}
                                className={cx(
                                    "hover:bg-white/5 transition-colors",
                                    !x.isAct && "bg-rose-500/5 opacity-70"
                                )}
                            >
                                <td className={cx("px-4 py-3", !x.isAct ? "text-zinc-400" : "text-zinc-100")}>
                                    {x.name}
                                </td>
                                <td className="px-4 py-3 text-zinc-300">
                                    {x.code ?? <span className="text-zinc-600">-</span>}
                                </td>
                                <td className="px-4 py-3">
                                    <StatusPill isActive={x.isAct} />
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {x.isAct ? (
                                        <Button
                                            onClick={() => onDelete(x.id)}
                                            variant="ghost"
                                            className="h-8 px-3 text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-400/10"
                                        >
                                            Delete
                                        </Button>
                                    ) : (
                                        <span className="text-xs text-rose-300/60 pr-3 font-medium uppercase tracking-wider">
                                            Archived
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!loading && items.length === 0 && (
                            <EmptyRow colSpan={4} text="No locations found." />
                        )}
                    </tbody>
                </table>
            </TableShell>
        </AppShell>
    );
}