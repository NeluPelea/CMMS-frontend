import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Button, Card, Input, Select, PageToolbar, TableShell, ErrorBox } from "../components/ui";
import { getGoodsReceipts, createGoodsReceipt, type CreateGoodsReceiptDto, type GoodsReceiptDto } from "../api/goodsReceipts";
import { hasPerm } from "../api";
import { suppliersApi, type SupplierSummaryDto } from "../api/suppliers";
import { getSettings, type SettingsDto } from "../api/settings";
import { getParts, type PartDto } from "../api/parts"; // Search parts

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export default function GoodsReceiptsPage() {
    const [mode, setMode] = useState<"list" | "create">("list");

    return (
        <AppShell title="Receptie Marfa">
            {mode === "list" ? (
                <GoodsReceiptList onCreate={() => setMode("create")} />
            ) : (
                <GoodsReceiptCreate onCancel={() => setMode("list")} onSuccess={() => setMode("list")} />
            )}
        </AppShell>
    );
}

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------
function GoodsReceiptList({ onCreate }: { onCreate: () => void }) {
    const [items, setItems] = useState<GoodsReceiptDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const navigate = useNavigate();

    async function load() {
        setLoading(true);
        try {
            const res = await getGoodsReceipts({ take: 50 });
            setItems(res.items || []);
        } catch (e: any) {
            setErr(e.message || "Failed to load receipts");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    return (
        <>
            <PageToolbar
                left={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={() => navigate("/procurement")} className="px-2">
                            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Button>
                        <div className="text-xl font-bold">Istoric Receptii</div>
                    </div>
                }
                right={
                    hasPerm("GR_CREATE") && (
                        <Button variant="primary" onClick={onCreate}>
                            + Receptie Noua
                        </Button>
                    )
                }
            />
            {err && <ErrorBox message={err} />}

            <TableShell>
                <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 text-zinc-400 uppercase font-semibold">
                        <tr>
                            <th className="px-4 py-2">Data</th>
                            <th className="px-4 py-2">Nr Doc</th>
                            <th className="px-4 py-2">Furnizor</th>
                            <th className="px-4 py-2 text-right">Total</th>
                            <th className="px-4 py-2 text-center">Moneda</th>
                            <th className="px-4 py-2">Note</th>
                            <th className="px-4 py-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {items.map(x => (
                            <tr key={x.id} className="hover:bg-white/5 cursor-pointer group" onClick={() => navigate(`/goods-receipts/${x.id}`)}>
                                <td className="px-4 py-2 text-zinc-200">{new Date(x.receiptDate).toLocaleDateString("ro-RO")}</td>
                                <td className="px-4 py-2 font-medium text-white group-hover:text-indigo-300 transition-colors">{x.docNo}</td>
                                <td className="px-4 py-2 text-zinc-300">{x.supplierName || "—"}</td>
                                <td className="px-4 py-2 text-right font-mono text-emerald-400 font-bold">
                                    {x.totalAmount?.toFixed(2)}
                                </td>
                                <td className="px-4 py-2 text-center text-zinc-400">{x.currency}</td>
                                <td className="px-4 py-2 text-zinc-500 truncate max-w-xs">{x.notes}</td>
                                <td className="px-4 py-2 text-right">
                                    <span className="text-zinc-500 group-hover:text-white transition-colors">&gt;</span>
                                </td>
                            </tr>
                        ))}
                        {!loading && items.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Nu exista receptii.</td></tr>
                        )}
                    </tbody>
                </table>
            </TableShell>
            {loading && <div className="text-center p-4 text-zinc-500">Loading...</div>}
        </>
    );
}

// ---------------------------------------------------------------------------
// Create View
// ---------------------------------------------------------------------------
type LocalLine = {
    id: string; // temp id
    partData?: PartDto; // for display
    qty: number;
    price: number;
};

function GoodsReceiptCreate({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: () => void }) {
    // Header state
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [supplierId, setSupplierId] = useState("");
    const [docNo, setDocNo] = useState("");
    const [currency, setCurrency] = useState("RON");
    const [notes, setNotes] = useState("");

    // FX / Suppliers
    const [suppliers, setSuppliers] = useState<SupplierSummaryDto[]>([]);
    const [settings, setSettings] = useState<SettingsDto | null>(null);

    // Lines
    const [lines, setLines] = useState<LocalLine[]>([]);

    // Loading
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        // Load dependencies
        Promise.all([
            suppliersApi.list({ take: 1000 }).then(r => r.items).catch(() => []),
            getSettings().catch(() => null)
        ]).then(([s, set]) => {
            setSuppliers(s as SupplierSummaryDto[]);
            setSettings(set as SettingsDto | null);
        });
    }, []);

    const totalValue = useMemo(() => {
        return lines.reduce((acc, l) => acc + (l.qty * l.price), 0);
    }, [lines]);

    function addLine(part: PartDto) {
        // Check if exists? Maybe allow duplicate parts in receipt (e.g. different prices?)
        // Usually yes.
        setLines(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            partData: part,
            qty: 1,
            price: part.purchasePrice || 0
        }]);
    }

    function removeLine(id: string) {
        setLines(prev => prev.filter(l => l.id !== id));
    }

    function updateLine(id: string, field: 'qty' | 'price', val: number) {
        setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
    }

    async function handleSave() {
        if (lines.length === 0) {
            setErr("Cel putin o linie este necesara.");
            return;
        }
        if (!docNo) {
            setErr("Numarul documentului este obligatoriu.");
            return;
        }

        // Basic validation
        if (lines.some(l => l.qty <= 0)) {
            setErr("Toate cantitatile trebuie sa fie pozitive.");
            return;
        }

        setSubmitting(true);
        setErr(null);

        const payload: CreateGoodsReceiptDto = {
            receiptDate: date,
            supplierId: supplierId || undefined,
            docNo,
            currency,
            fxRonEur: settings?.fxRonEur || 1,
            fxRonUsd: settings?.fxRonUsd || 1,
            notes,
            lines: lines.map(l => ({
                partId: l.partData!.id,
                qty: l.qty,
                unitPrice: l.price
            }))
        };

        try {
            await createGoodsReceipt(payload);
            onSuccess();
        } catch (e: any) {
            setErr(e.message || "Eroare la salvarea receptiei.");
            setSubmitting(false);
        }
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Document Receptie</h2>
                <Button variant="ghost" onClick={onCancel}>Anuleaza</Button>
            </div>

            {err && <ErrorBox message={err} />}

            {/* Header Card */}
            <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Data Receptie</label>
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Furnizor</label>
                        <Select value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                            <option value="">-- Alege Furnizor --</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Nr Document</label>
                        <Input placeholder="Factura / Aviz" value={docNo} onChange={e => setDocNo(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Moneda</label>
                        <Select value={currency} onChange={e => setCurrency(e.target.value)}>
                            <option value="RON">RON</option>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                        </Select>
                        <div className="text-xs text-zinc-500 mt-1">
                            Curs: EUR={settings?.fxRonEur}, USD={settings?.fxRonUsd}
                        </div>
                    </div>
                    <div className="col-span-full">
                        <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">Observatii</label>
                        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional..." />
                    </div>
                </div>
            </Card>

            {/* Lines Card */}
            <Card title="Linii Receptie">
                <div className="mb-4">
                    {/* Search Part Component */}
                    <PartSearch onSelect={addLine} />
                </div>

                <TableShell>
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 text-zinc-400 uppercase font-semibold">
                            <tr>
                                <th className="px-3 py-2 text-left">Articol (SKU)</th>
                                <th className="px-3 py-2 text-left w-20">U.M.</th>
                                <th className="px-3 py-2 text-right w-32">Cantitate</th>
                                <th className="px-3 py-2 text-right w-32">Pret / U.M</th>
                                <th className="px-3 py-2 text-center w-20">Moneda</th>
                                <th className="px-3 py-2 text-right w-32">Valoare</th>
                                <th className="px-3 py-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {lines.map(line => (
                                <tr key={line.id} className="hover:bg-white/5">
                                    <td className="px-3 py-2">
                                        <div className="text-white font-medium">{line.partData?.name}</div>
                                        <div className="text-xs text-zinc-500">{line.partData?.code}</div>
                                    </td>
                                    <td className="px-3 py-2 text-zinc-400">{line.partData?.uom || "-"}</td>
                                    <td className="px-3 py-2 text-right">
                                        <input
                                            type="number"
                                            className="w-full bg-transparent border-b border-white/20 text-right focus:border-indigo-500 outline-none py-1"
                                            value={line.qty}
                                            onChange={e => updateLine(line.id, 'qty', parseFloat(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <input
                                            type="number"
                                            className="w-full bg-transparent border-b border-white/20 text-right focus:border-indigo-500 outline-none py-1"
                                            value={line.price}
                                            onChange={e => updateLine(line.id, 'price', parseFloat(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-center text-zinc-500">{currency}</td>
                                    <td className="px-3 py-2 text-right font-mono text-zinc-300">
                                        {(line.qty * line.price).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <button onClick={() => removeLine(line.id)} className="text-red-400 hover:text-red-300 font-bold px-2">
                                            &times;
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {lines.length === 0 && (
                                <tr><td colSpan={7} className="text-center py-6 text-zinc-500">Adauga piese folosind cautarea de mai sus.</td></tr>
                            )}
                        </tbody>
                        {lines.length > 0 && (
                            <tfoot className="bg-white/5 font-bold text-white">
                                <tr>
                                    <td colSpan={5} className="px-3 py-3 text-right text-zinc-400 uppercase">Total Document</td>
                                    <td className="px-3 py-3 text-right font-mono text-emerald-400">{totalValue.toFixed(2)} <span className="text-xs text-zinc-500">{currency}</span></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </TableShell>
            </Card>

            {/* Footer Actions */}
            <div className="flex justify-end gap-4 p-4 bg-zinc-900/80 sticky bottom-0 border-t border-white/10 backdrop-blur-md">
                <div className="flex-1 text-zinc-400 text-sm flex items-center">
                    {lines.length} linii valide. Total: <span className="text-white font-bold ml-1">{totalValue.toFixed(2)} {currency}</span>
                </div>
                <Button variant="ghost" onClick={onCancel}>Anuleaza</Button>
                <Button variant="primary" onClick={handleSave} disabled={submitting || lines.length === 0}>
                    {submitting ? "Se salveaza..." : "Salveaza Receptia"}
                </Button>
            </div>
        </div>
    );
}


// ---------------------------------------------------------------------------
// Helper: Part Search
// ---------------------------------------------------------------------------
function PartSearch({ onSelect }: { onSelect: (p: PartDto) => void }) {
    const [term, setTerm] = useState("");
    const [results, setResults] = useState<PartDto[]>([]);
    const [searching, setSearching] = useState(false);
    const [show, setShow] = useState(false);

    useEffect(() => {
        const t = setTimeout(async () => {
            if (!term.trim()) {
                setResults([]);
                return;
            }
            setSearching(true);
            try {
                const data = await getParts({ q: term, take: 10 });
                setResults(Array.isArray(data) ? data : []);
                setShow(true);
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 400);
        return () => clearTimeout(t);
    }, [term]);

    return (
        <div className="relative max-w-md">
            <div className="text-xs font-semibold text-zinc-400 uppercase mb-1">Adauga Articol</div>
            <Input
                placeholder="Cauta dupa nume sau SKU..."
                value={term}
                onChange={e => {
                    setTerm(e.target.value);
                    setShow(true);
                }}
                onFocus={() => setShow(true)}
            />
            {searching && <div className="absolute right-3 top-8 text-xs text-zinc-500">...</div>}

            {show && results.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-zinc-800 border border-white/10 rounded shadow-xl max-h-60 overflow-y-auto w-[400px]">
                    {results.map(r => (
                        <button
                            key={r.id}
                            className="w-full text-left px-4 py-2 hover:bg-white/10 flex justify-between items-center group"
                            onClick={() => {
                                onSelect(r);
                                setTerm(""); // reset
                                setShow(false);
                            }}
                        >
                            <div>
                                <div className="font-medium text-white group-hover:text-indigo-300">{r.name}</div>
                                <div className="text-xs text-zinc-400">{r.code} | {r.uom}</div>
                            </div>
                            <div className="text-xs text-zinc-500 font-mono">
                                {r.purchasePrice ? r.purchasePrice.toFixed(2) : "-"} {r.purchaseCurrency}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
