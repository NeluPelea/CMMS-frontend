// src/pages/LocationsPage.tsx
import { useEffect, useState, useCallback, useMemo } from "react";
// Folosim 'import type' pentru a evita erorile de verbatimModuleSyntax
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

    // Funcție de încărcare stabilă
    const load = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const data = await getLocs({
                q: q.trim() || undefined,
                take: 500,
                ia: showDel, // Parametrul pentru include inactive
            });

            // LOG de confirmare: dacă nu vezi acest log exact în consolă, build-ul încă eșuează
            console.log(`[LOCS] Reîncărcare: ia=${showDel}, total=${data.length}`);

            setItems(Array.isArray(data) ? data : []);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [q, showDel]);

    // Reîncărcăm automat când se schimbă bifa
    useEffect(() => {
        load();
    }, [load]);

    async function onCreate() {
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
    }

    async function onDelete(id: string, isActive: boolean) {
        if (!isActive) return;
        if (!confirm("Sigur doriți să ștergeți locația?")) return;

        setErr(null);
        try {
            await deleteLoc(id);
            await load();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    }

    return (
        <AppShell title="Locations">
            <PageToolbar
                left={
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="w-full sm:max-w-md">
                            <Input
                                value={q}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
                                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === "Enter") load();
                                }}
                                placeholder="Search locations..."
                            />
                        </div>

                        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300 select-none">
                            <input
                                type="checkbox"
                                checked={showDel}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setShowDel(e.target.checked)}
                                className="h-4 w-4 rounded border-white/20 bg-white/10"
                            />
                            Show deleted
                        </label>
                    </div>
                }
                right={
                    <div className="flex items-center gap-2">
                        <Button onClick={load} disabled={loading} variant="ghost">
                            {loading ? "Loading..." : "Refresh"}
                        </Button>
                    </div>
                }
            />

            {/* REPARAT: Fără className pentru a trece de build */}
            {err && <ErrorBox message={err} />}

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
                    <Button
                        onClick={onCreate}
                        disabled={!canCreate || loading}
                        variant="primary"
                    >
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
                        {items.map((x) => {
                            const active = x.isAct !== false;
                            return (
                                <tr key={x.id} className={cx("hover:bg-white/5", !active && "bg-rose-500/5 opacity-70")}>
                                    <td className={cx("px-4 py-3", active ? "text-zinc-100" : "text-zinc-400")}>{x.name}</td>
                                    <td className="px-4 py-3 text-zinc-300">{x.code ?? "-"}</td>
                                    <td className="px-4 py-3">
                                        <StatusPill isActive={active} />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {active ? (
                                            <Button
                                                onClick={() => onDelete(x.id, active)}
                                                variant="ghost"
                                                className="h-8 px-3 text-xs text-zinc-400 hover:text-rose-400"
                                            >
                                                Delete
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-rose-300/60 pr-3 font-medium uppercase">Archived</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && items.length === 0 && (
                            <EmptyRow colSpan={4} text="No locations found." />
                        )}
                    </tbody>
                </table>
            </TableShell>
        </AppShell>
    );
}