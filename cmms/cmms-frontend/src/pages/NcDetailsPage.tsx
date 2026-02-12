import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import {
    ncApi,
    type NcOrderDetailsDto,
    type SupplierDto,
} from "../api";
import { NcOrderStatus, ncStatusLabel } from "../domain/enums";
import {
    Button,
    ErrorBox,
    Input,
    PageToolbar,
    Pill,
    Select,
    TableShell,
} from "../components/ui";
import { localInputToIso, isoToLocalInputValue, isoToLocalDisplay } from "../domain/datetime";

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{children}</div>;
}

export default function NcDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const [order, setOrder] = useState<NcOrderDetailsDto | null>(null);
    const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Form state properties
    const [supplierId, setSupplierId] = useState("");
    const [orderDate, setOrderDate] = useState("");
    const [currency, setCurrency] = useState("RON");
    const [priority, setPriority] = useState(1);
    const [notes, setNotes] = useState("");
    const [reason, setReason] = useState("");
    const [neededByDate, setNeededByDate] = useState("");

    // Line Edit State
    const [linePartName, setLinePartName] = useState("");
    const [lineUom, setLineUom] = useState("BUC");
    const [lineQty, setLineQty] = useState(1);
    const [linePrice, setLinePrice] = useState(0);

    useEffect(() => {
        if (id) {
            loadSuppliers();
            loadOrder();
        }
    }, [id]);

    async function loadSuppliers() {
        try {
            const data = await ncApi.listSuppliers();
            setSuppliers(data);
        } catch (ex: any) { console.error(ex); }
    }

    async function loadOrder() {
        if (!id) return;
        setLoading(true);
        try {
            const data = await ncApi.get(id);
            setOrder(data);
            setSupplierId(data.supplierId);
            setOrderDate(isoToLocalInputValue(data.orderDate));
            setCurrency(data.currency);
            setPriority(data.priority);
            setNotes(data.notes || "");
            setReason(data.reason || "");
            setNeededByDate(data.neededByDate ? isoToLocalInputValue(data.neededByDate) : "");
        } catch (ex: any) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveHeader() {
        if (!id) return;
        setLoading(true);
        try {
            await ncApi.update(id, {
                supplierId,
                currency,
                orderDate: localInputToIso(orderDate) || new Date().toISOString(),
                priority,
                notes,
                reason,
                neededByDate: neededByDate ? (localInputToIso(neededByDate) || undefined) : undefined
            });
            await loadOrder();
        } catch (ex: any) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleAddLine() {
        if (!id) return;
        if (!linePartName) return;
        setLoading(true);
        try {
            await ncApi.addLine(id, {
                partNameManual: linePartName,
                uom: lineUom,
                qty: lineQty,
                unitPrice: linePrice,
                discountPercent: 0,
                sortOrder: (order?.lines.length || 0) + 1
            });
            setLinePartName("");
            setLineQty(1);
            setLinePrice(0);
            await loadOrder();
        } catch (ex: any) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteLine(lineId: string) {
        if (!id) return;
        if (!confirm("Sigur ștergi această linie?")) return;
        setLoading(true);
        try {
            await ncApi.deleteLine(id, lineId);
            await loadOrder();
        } catch (ex: any) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleChangeStatus(newStatus: NcOrderStatus) {
        if (!id) return;
        if (!confirm(`Schimbi statusul în ${ncStatusLabel(newStatus)}?`)) return;
        setLoading(true);
        try {
            await ncApi.changeStatus(id, newStatus);
            await loadOrder();
        } catch (ex: any) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    const canEdit = order?.status === NcOrderStatus.Draft || order?.status === NcOrderStatus.Sent;

    return (
        <AppShell title={order ? `NC: ${order.ncNumber}` : "Încărcare..."}>
            {order && (
                <PageToolbar
                    left={
                        <div className="flex items-center gap-3">
                            <Link to="/nc" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </Link>
                            <div className="flex flex-col">
                                <span className="text-xs text-zinc-500">Creat la {isoToLocalDisplay(order.createdAt)}</span>
                                <Pill tone={order.status === NcOrderStatus.Draft ? "zinc" : order.status === NcOrderStatus.Sent ? "amber" : "teal"}>{ncStatusLabel(order.status)}</Pill>
                            </div>
                        </div>
                    }
                    right={
                        <div className="flex gap-2">
                            <a href={ncApi.getPdfUrl(order.id)} target="_blank" rel="noreferrer">
                                <Button variant="ghost">Generare PDF</Button>
                            </a>
                            {canEdit && <Button variant="primary" onClick={handleSaveHeader}>Salvează Header</Button>}
                            {order.status === NcOrderStatus.Draft && order.lines.length > 0 && <Button variant="primary" className="bg-amber-500 hover:bg-amber-600 text-white border-0" onClick={() => handleChangeStatus(NcOrderStatus.Sent)}>Trimite NC</Button>}
                            {order.status === NcOrderStatus.Sent && <Button variant="primary" className="bg-emerald-500 hover:bg-emerald-600 text-white border-0" onClick={() => handleChangeStatus(NcOrderStatus.Confirmed)}>Confirmă NC</Button>}
                            {order.status !== NcOrderStatus.Cancelled && order.status !== NcOrderStatus.Received && <Button variant="ghost" className="text-rose-400 hover:bg-rose-500/10" onClick={() => handleChangeStatus(NcOrderStatus.Cancelled)}>Anulează</Button>}
                        </div>
                    }
                />
            )}

            {err && <ErrorBox message={err} onClose={() => setErr(null)} />}

            {order && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Header Info */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                            <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest border-b border-white/5 pb-2">Detalii Generale</h3>

                            <div>
                                <FieldLabel>Furnizor</FieldLabel>
                                <Select
                                    disabled={!canEdit}
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                >
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <FieldLabel>Data Comandă</FieldLabel>
                                    <input type="datetime-local" disabled={!canEdit} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40" />
                                </div>
                                <div>
                                    <FieldLabel>Moneda</FieldLabel>
                                    <Select disabled={!canEdit} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                                        <option value="RON">RON</option>
                                        <option value="EUR">EUR</option>
                                        <option value="USD">USD</option>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <FieldLabel>Motiv Achiziție</FieldLabel>
                                <Input disabled={!canEdit} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Defect masina X, Stoc minim..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <FieldLabel>Prioritate</FieldLabel>
                                    <Select disabled={!canEdit} value={priority} onChange={e => setPriority(parseInt(e.target.value))}>
                                        <option value={1}>Normala</option>
                                        <option value={2}>Inalta</option>
                                        <option value={3}>Urgent</option>
                                    </Select>
                                </div>
                                <div>
                                    <FieldLabel>Necesara pana la</FieldLabel>
                                    <input type="datetime-local" disabled={!canEdit} value={neededByDate} onChange={(e) => setNeededByDate(e.target.value)} className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40" />
                                </div>
                            </div>

                            <div>
                                <FieldLabel>Note Aditionale</FieldLabel>
                                <textarea disabled={!canEdit} value={notes} onChange={e => setNotes(e.target.value)} className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40 min-h-[100px]" placeholder="..." />
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                            <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">Sumar Costuri</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-zinc-400"><span>Subtotal:</span><span className="font-mono font-bold text-zinc-200">{order.subtotal.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} {order.currency}</span></div>
                                <div className="flex justify-between text-zinc-400"><span>TVA ({order.vatPercent}%):</span><span className="font-mono font-bold text-zinc-200">{order.vatAmount.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} {order.currency}</span></div>
                                <div className="flex justify-between border-t border-white/5 pt-2 text-lg">
                                    <span className="font-bold text-zinc-100">TOTAL:</span>
                                    <span className="font-mono font-bold text-teal-400">{order.total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} {order.currency}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Lines & Attachments */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                            <div className="p-5 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest">Linii Comandă</h3>
                                <span className="text-xs text-zinc-500">{order.lines.length} articole</span>
                            </div>

                            <div className="overflow-x-auto">
                                <TableShell minWidth={600}>
                                    <table className="w-full border-collapse text-sm">
                                        <thead className="bg-white/5 text-zinc-400 text-xs uppercase tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold">Descriere Articol</th>
                                                <th className="px-4 py-3 text-center font-semibold">UM</th>
                                                <th className="px-4 py-3 text-center font-semibold">Cant</th>
                                                <th className="px-4 py-3 text-right font-semibold">P. Unitar</th>
                                                <th className="px-4 py-3 text-right font-semibold">Total</th>
                                                {canEdit && <th className="px-4 py-3 text-right"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {order.lines.map(line => (
                                                <tr key={line.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-zinc-100">{line.partNameManual}</td>
                                                    <td className="px-4 py-3 text-center text-zinc-400">{line.uom}</td>
                                                    <td className="px-4 py-3 text-center font-bold">{line.qty}</td>
                                                    <td className="px-4 py-3 text-right font-mono">{line.unitPrice.toLocaleString("ro-RO")}</td>
                                                    <td className="px-4 py-3 text-right font-mono font-bold text-zinc-200">{line.lineTotal.toLocaleString("ro-RO", { minimumFractionDigits: 2 })}</td>
                                                    {canEdit && (
                                                        <td className="px-4 py-3 text-right">
                                                            <button onClick={() => handleDeleteLine(line.id)} className="text-rose-400/50 hover:text-rose-400 transition-colors">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}

                                            {canEdit && (
                                                <tr className="bg-teal-400/5 border-t border-teal-400/10">
                                                    <td className="px-3 py-3">
                                                        <input type="text" placeholder="Descriere articol..." value={linePartName} onChange={e => setLinePartName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-teal-400" />
                                                    </td>
                                                    <td className="px-2 py-3">
                                                        <input type="text" value={lineUom} onChange={e => setLineUom(e.target.value)} className="w-12 mx-auto block bg-white/5 border border-white/10 rounded-lg px-1 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-teal-400" />
                                                    </td>
                                                    <td className="px-2 py-3">
                                                        <input type="number" value={lineQty} onChange={e => setLineQty(parseFloat(e.target.value))} className="w-16 mx-auto block bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-teal-400" />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <input type="number" placeholder="0.00" value={linePrice} onChange={e => setLinePrice(parseFloat(e.target.value))} className="w-24 ml-auto block bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-right text-sm outline-none focus:ring-1 focus:ring-teal-400" />
                                                    </td>
                                                    <td className="px-3 py-3 text-right font-mono font-bold text-teal-400">
                                                        {(lineQty * linePrice).toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-3 py-3 text-right">
                                                        <Button size="sm" variant="primary" onClick={handleAddLine} disabled={!linePartName || loading}>Adaugă</Button>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </TableShell>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
                            <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">Atașamente</h3>
                            <div className="text-center py-10 border-2 border-dashed border-white/5 rounded-2xl text-zinc-500">
                                <svg className="w-10 h-10 mx-auto mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                <p className="text-sm">Funcționalitatea de upload va fi implementată în faza următoare.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
