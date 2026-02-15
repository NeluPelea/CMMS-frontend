import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import AppShell from "../components/AppShell";
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
import {
    createAsset,
    deleteAsset,
    updateAsset,
    getAssets,
    getLocs,
    type AssetDto,
    type LocDto,
    hasPerm,
} from "../api";
import AssetDocumentationModal from "../components/AssetDocumentationModal";

function StatusPill({ isActive }: { isActive: boolean }) {
    if (isActive) return <Pill tone="emerald">Activ</Pill>;
    return <Pill tone="rose">Sters</Pill>;
}





export default function AssetsPage() {
    const navigate = useNavigate();
    const [items, setItems] = useState<AssetDto[]>([]);
    const [locs, setLocs] = useState<LocDto[]>([]);
    // Document Modal State
    const [docAsset, setDocAsset] = useState<AssetDto | null>(null);


    // ... existing state variables (q, showDel, etc.)
    const [q, setQ] = useState("");
    const [showDel, setShowDel] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Create/Edit/Details states...
    const [newName, setNewName] = useState("");
    const [newCode, setNewCode] = useState("");
    const [newRanking, setNewRanking] = useState("");
    const [newSerial, setNewSerial] = useState("");
    const [newInv, setNewInv] = useState("");
    const [locId, setLocId] = useState("");

    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editCode, setEditCode] = useState("");
    const [editRanking, setEditRanking] = useState("");
    const [editSerial, setEditSerial] = useState("");
    const [editInv, setEditInv] = useState("");
    const [editLocId, setEditLocId] = useState("");

    const [editClass, setEditClass] = useState("");
    const [editMan, setEditMan] = useState("");
    const [editYear, setEditYear] = useState("");
    const [editComm, setEditComm] = useState("");

    const [saving, setSaving] = useState(false);
    const [detailItem, setDetailItem] = useState<AssetDto | null>(null);

    const canCreate = useMemo(() => newName.trim().length >= 2, [newName]);

    // ... existing load/loadLocs/useEffect/handleRankingChange/onCreate/onDelete/openEdit/onUpdate functions
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
                serialNumber: newSerial.trim() || undefined,
                inventoryNumber: newInv.trim() || undefined,
            });
            setNewName("");
            setNewCode("");
            setNewRanking("");
            setNewSerial("");
            setNewInv("");
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
        setEditSerial(item.serialNumber || "");
        setEditInv(item.inventoryNumber || "");
        setEditLocId(item.locId || "");
        setEditClass(item.assetClass || "");
        setEditMan(item.manufacturer || "");
        setEditYear(item.manufactureYear?.toString() || "");
        setEditComm(item.commissionedAt ? item.commissionedAt.split("T")[0] : "");
    }

    async function onUpdate() {
        if (!editId) return;
        setSaving(true);
        try {
            const yearNum = editYear ? parseInt(editYear) : undefined;
            await updateAsset(editId, {
                name: editName.trim(),
                code: editCode.trim() || undefined,
                locId: editLocId || undefined,
                ranking: editRanking || undefined,
                serialNumber: editSerial.trim() || undefined,
                inventoryNumber: editInv.trim() || undefined,
                assetClass: editClass.trim() || undefined,
                manufacturer: editMan.trim() || undefined,
                manufactureYear: isNaN(yearNum as number) ? undefined : yearNum,
                commissionedAt: editComm || undefined,
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
            {/* ... Toolbar ... */}
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

            {/* ... Create Card ... */}
            {hasPerm("ASSET_CREATE") && (
                <Card title="Utilaj Nou">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="lg:col-span-2">
                            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nume" />
                        </div>
                        <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Cod" />
                        <Input value={newRanking} onChange={e => handleRankingChange(e.target.value, setNewRanking)} placeholder="Rank (A-Z)" maxLength={1} />
                        <Input value={newSerial} onChange={e => setNewSerial(e.target.value)} placeholder="Seria" />
                        <Input value={newInv} onChange={e => setNewInv(e.target.value)} placeholder="Nr. Inventar" />
                        <div className="lg:col-span-2 flex gap-2">
                            <div className="flex-1">
                                <Select value={locId} onChange={e => setLocId(e.target.value)}>
                                    <option value="">(Fara locatie)</option>
                                    {locs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </Select>
                            </div>
                            <Button onClick={onCreate} disabled={!canCreate} variant="primary">Creeaza</Button>
                        </div>
                    </div>
                </Card>
            )}

            <div className="mt-6" />

            <TableShell minWidth={1000}>
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-white/5 text-zinc-300">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Nume</th>
                            <th className="px-4 py-3 text-left font-semibold">Cod</th>
                            <th className="px-4 py-3 text-left font-semibold">Seria</th>
                            <th className="px-4 py-3 text-left font-semibold">Nr. Inventar</th>
                            <th className="px-4 py-3 text-left font-semibold">Locatie</th>
                            <th className="px-4 py-3 text-left font-semibold w-20 text-center">Rank</th>
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
                                    <td className="px-4 py-3 text-zinc-300">{x.serialNumber ?? "-"}</td>
                                    <td className="px-4 py-3 text-zinc-300">{x.inventoryNumber ?? "-"}</td>
                                    <td className="px-4 py-3 text-zinc-300">{x.locName ?? "-"}</td>
                                    <td className="px-4 py-3 text-center">
                                        {x.ranking ? (
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-indigo-500/20 text-indigo-300 font-bold text-xs ring-1 ring-indigo-500/40">{x.ranking}</span>
                                        ) : <span className="text-zinc-500">-</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusPill isActive={isActive} />
                                    </td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            className="h-7 px-2 text-xs"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDocAsset(x);
                                            }}
                                        >
                                            Documentatie
                                        </Button>
                                        <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDetailItem(x)}>
                                            Detalii
                                        </Button>
                                        {hasPerm("ASSET_UPDATE") && (
                                            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(x)}>
                                                Edit
                                            </Button>
                                        )}
                                        {hasPerm("ASSET_DELETE") && (
                                            <button
                                                onClick={() => onDelete(x.id, isActive)}
                                                disabled={!isActive}
                                                className={cx(
                                                    "rounded px-2 py-1 text-xs font-semibold transition-colors",
                                                    isActive ? "text-red-400 hover:bg-white/5" : "text-zinc-600 cursor-not-allowed"
                                                )}
                                            >
                                                Sterge
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && items.length === 0 ? <EmptyRow colSpan={8} text="Nu au fost gasite utilaje." /> : null}
                    </tbody>
                </table>
            </TableShell>

            {detailItem && (
                <Modal title={`Detalii: ${detailItem.name}`} onClose={() => setDetailItem(null)}>
                    {/* ... Existing Details Modal Content ... */}
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-4">
                            <div><FieldLabel>Tip / Clasa</FieldLabel><div className="text-zinc-100 font-medium">{detailItem.assetClass || "-"}</div></div>
                            <div><FieldLabel>Producator</FieldLabel><div className="text-zinc-100 font-medium">{detailItem.manufacturer || "-"}</div></div>
                            <div><FieldLabel>An fabricatie</FieldLabel><div className="text-zinc-100 font-medium">{detailItem.manufactureYear || "-"}</div></div>
                            <div><FieldLabel>Data PIF</FieldLabel><div className="text-zinc-100 font-medium">{detailItem.commissionedAt ? new Date(detailItem.commissionedAt).toLocaleDateString("ro-RO") : "-"}</div></div>
                            <div><FieldLabel>Cod / ID</FieldLabel><div className="text-zinc-400 text-xs font-mono">{detailItem.code || detailItem.id}</div></div>
                        </div>
                        <div className="flex flex-col items-center justify-center border-t border-white/10 pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                            <div className="rounded-xl bg-white p-3 shadow-xl">
                                <QRCodeSVG value={`ASSET|${detailItem.code || "N/A"}|${detailItem.id}`} size={160} level="M" includeMargin={false} />
                            </div>
                            <div className="mt-3 text-center">
                                <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Scan QR Code</div>
                                <div className="text-zinc-100 font-mono text-xs mt-1">{detailItem.code || detailItem.id.slice(0, 8)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end">
                        <Button variant="ghost" onClick={() => setDetailItem(null)}>Inchide</Button>
                    </div>
                </Modal>
            )}

            {editId && (
                <Modal title="Editeaza Utilaj" onClose={() => setEditId(null)}>
                    {/* ... Existing Edit Modal Content ... */}
                    <div className="space-y-4">
                        <div><FieldLabel>Nume</FieldLabel><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><FieldLabel>Cod</FieldLabel><Input value={editCode} onChange={e => setEditCode(e.target.value)} /></div>
                            <div><FieldLabel>Rank (A-Z)</FieldLabel><Input value={editRanking} onChange={e => handleRankingChange(e.target.value, setEditRanking)} maxLength={1} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><FieldLabel>Seria</FieldLabel><Input value={editSerial} onChange={e => setEditSerial(e.target.value)} /></div>
                            <div><FieldLabel>Nr. Inventar</FieldLabel><Input value={editInv} onChange={e => setEditInv(e.target.value)} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><FieldLabel>Tip / Clasa</FieldLabel><Input value={editClass} onChange={e => setEditClass(e.target.value)} /></div>
                            <div><FieldLabel>Producator</FieldLabel><Input value={editMan} onChange={e => setEditMan(e.target.value)} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><FieldLabel>An fabricatie</FieldLabel><Input type="number" value={editYear} onChange={e => setEditYear(e.target.value)} /></div>
                            <div><FieldLabel>Data PIF</FieldLabel><Input type="date" value={editComm} onChange={e => setEditComm(e.target.value)} /></div>
                        </div>
                        <div>
                            <FieldLabel>Locatie</FieldLabel>
                            <Select value={editLocId} onChange={e => setEditLocId(e.target.value)}>
                                <option value="">(Fara locatie)</option>
                                {locs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setEditId(null)} disabled={saving}>Anuleaza</Button>
                            <Button variant="primary" onClick={onUpdate} disabled={saving}>{saving ? "Se salveaza..." : "Salveaza"}</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {docAsset && (
                <AssetDocumentationModal
                    asset={docAsset}
                    onClose={() => setDocAsset(null)}
                />
            )}

        </AppShell>
    );
}
