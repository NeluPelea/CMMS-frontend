// src/pages/AssetsPage.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
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
    getAssetDocuments,
    uploadAssetDocument,
    updateAssetDocumentTitle,
    deleteAssetDocument,
    getAssetDocumentDownloadUrl,
    getAssetDocumentPreviewUrl,
    type AssetDocumentDto,
} from "../api";

// ... existing imports

// --- Document Modal ---
function AssetDocumentationModal({ asset, onClose }: { asset: AssetDto; onClose: () => void }) {
    const [docs, setDocs] = useState<AssetDocumentDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Upload state
    const [title, setTitle] = useState("");
    const [file, setFile] = useState<File | null>(null);

    // Preview
    const [previewDoc, setPreviewDoc] = useState<AssetDocumentDto | null>(null);

    const loadDocs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAssetDocuments(asset.id);
            setDocs(data);
        } catch (e) {
            setErr((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [asset.id]);

    useEffect(() => {
        loadDocs();
    }, [loadDocs]);

    async function onUpload() {
        if (!file || !title.trim()) return;
        setUploading(true);
        setErr(null);
        try {
            await uploadAssetDocument(asset.id, title.trim(), file);
            setTitle("");
            setFile(null);
            // Reset file input if possible, or just let React handle it via key or controlled ref
            // simple way: 
            const fileInput = document.getElementById("doc-file-input") as HTMLInputElement;
            if (fileInput) fileInput.value = "";

            await loadDocs();
        } catch (e) {
            setErr((e as Error).message);
        } finally {
            setUploading(false);
        }
    }

    async function onDeleteDoc(id: string) {
        if (!confirm("Stergeti documentul?")) return;
        try {
            await deleteAssetDocument(asset.id, id);
            if (previewDoc?.id === id) setPreviewDoc(null);
            await loadDocs();
        } catch (e) {
            alert((e as Error).message);
        }
    }

    async function onRename(doc: AssetDocumentDto) {
        const newTitle = prompt("Denumire noua:", doc.title);
        if (!newTitle || newTitle === doc.title) return;
        try {
            await updateAssetDocumentTitle(asset.id, doc.id, newTitle.trim());
            loadDocs();
        } catch (e) {
            alert((e as Error).message);
        }
    }

    const isImage = (ct: string) => ct.startsWith("image/");
    const isPdf = (ct: string) => ct === "application/pdf";

    return (
        <Modal title={`Documentatie: ${asset.name}`} onClose={onClose} widthClassName="max-w-4xl">
            <div className="space-y-6">
                {err && <ErrorBox message={err} onClose={() => setErr(null)} />}
                {/* ... content ... */}
                {/* Upload Section */}
                {hasPerm("ASSET_UPDATE") && (
                    <div className="bg-white/5 p-4 rounded-lg border border-white/10 flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <FieldLabel>Denumire document</FieldLabel>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="ex: Manual utilizare"
                            />
                        </div>
                        <div className="w-full sm:w-auto">
                            <FieldLabel>Fisier</FieldLabel>
                            <input
                                id="doc-file-input"
                                type="file"
                                className="text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                            />
                        </div>
                        <Button
                            variant="primary"
                            onClick={onUpload}
                            disabled={!file || !title.trim() || uploading}
                        >
                            {uploading ? "Se incarca..." : "Incarca"}
                        </Button>
                    </div>
                )}

                {/* List & Preview Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* List */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-zinc-300">Lista Documente</h3>
                        {loading && <div className="text-sm text-zinc-500">Se incarca...</div>}
                        {!loading && docs.length === 0 && <div className="text-sm text-zinc-500 italic">Niciun document atasat.</div>}

                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {docs.map(doc => (
                                <div key={doc.id} className="bg-white/5 p-3 rounded border border-white/10 flex flex-col gap-1">
                                    <div className="flex justify-between items-start">
                                        <div className="font-medium text-zinc-200">{doc.title}</div>
                                        <div className="text-xs text-zinc-500">{new Date(doc.createdAt).toLocaleDateString("ro-RO")}</div>
                                    </div>
                                    <div className="text-xs text-zinc-400 flex gap-2">
                                        <span>{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
                                        <span>•</span>
                                        <span>{doc.fileName}</span>
                                    </div>
                                    <div className="flex gap-2 mt-2 justify-end">
                                        {(isImage(doc.contentType) || isPdf(doc.contentType)) && (
                                            <button
                                                onClick={() => setPreviewDoc(doc)}
                                                className="text-xs text-indigo-300 hover:text-indigo-200"
                                            >
                                                Previzualizeaza
                                            </button>
                                        )}
                                        <a
                                            href={getAssetDocumentDownloadUrl(asset.id, doc.id)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-indigo-300 hover:text-indigo-200"
                                        >
                                            Descarca
                                        </a>
                                        {hasPerm("ASSET_UPDATE") && (
                                            <>
                                                <button onClick={() => onRename(doc)} className="text-xs text-yellow-300 hover:text-yellow-200">Redenumeste</button>
                                                <button onClick={() => onDeleteDoc(doc.id)} className="text-xs text-red-300 hover:text-red-200">Sterge</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-zinc-900 border border-white/10 rounded-lg p-4 min-h-[300px] flex flex-col">
                        <h3 className="text-sm font-semibold text-zinc-300 mb-2">
                            Preview: {previewDoc ? previewDoc.title : "Selecteaza un document"}
                        </h3>
                        <div className="flex-1 flex items-center justify-center bg-black/20 rounded overflow-hidden relative">
                            {previewDoc ? (
                                <>
                                    {isImage(previewDoc.contentType) && (
                                        <img
                                            src={getAssetDocumentPreviewUrl(asset.id, previewDoc.id)}
                                            alt={previewDoc.title}
                                            className="max-w-full max-h-[400px] object-contain"
                                        />
                                    )}
                                    {isPdf(previewDoc.contentType) && (
                                        <iframe
                                            src={getAssetDocumentPreviewUrl(asset.id, previewDoc.id)}
                                            className="w-full h-[400px]"
                                            title={previewDoc.title}
                                        />
                                    )}
                                </>
                            ) : (
                                <div className="text-zinc-600 text-sm">Previzualizare disponibila pentru PDF si Imagini</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function StatusPill({ isActive }: { isActive: boolean }) {
    if (isActive) return <Pill tone="emerald">Activ</Pill>;
    return <Pill tone="rose">Sters</Pill>;
}

export default function AssetsPage() {
    // ... existing state
    const [items, setItems] = useState<AssetDto[]>([]);
    const [locs, setLocs] = useState<LocDto[]>([]);

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

    // Document Modal State
    const [docAsset, setDocAsset] = useState<AssetDto | null>(null);

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
                                            onClick={() => setDocAsset(x)}
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

            {/* Document Modal */}
            {docAsset && (
                <AssetDocumentationModal
                    asset={docAsset}
                    onClose={() => setDocAsset(null)}
                />
            )}
        </AppShell>
    );
}
