import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Card, Button, TableShell, ErrorBox, PageToolbar } from "../components/ui";
import { getGoodsReceipt, type GoodsReceiptDto } from "../api/goodsReceipts";

export default function GoodsReceiptDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [item, setItem] = useState<GoodsReceiptDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        load(id);
    }, [id]);

    async function load(receiptId: string) {
        setLoading(true);
        setErr(null);
        try {
            const data = await getGoodsReceipt(receiptId);
            setItem(data);
        } catch (e: any) {
            setErr(e.message || "Failed to load receipt details.");
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <AppShell title="Detalii Receptie">
                <div className="p-8 text-center text-zinc-500">Se incarca detaliile...</div>
            </AppShell>
        );
    }

    if (err || !item) {
        return (
            <AppShell title="Eroare">
                <ErrorBox message={err || "Receptia nu a fost gasita."} />
                <div className="mt-4">
                    <Button variant="ghost" onClick={() => navigate("/goods-receipts")}>
                        Inapoi la Lista
                    </Button>
                </div>
            </AppShell>
        );
    }

    // Calculate total from lines if not provided by API
    const calculatedTotal = item.lines?.reduce((acc, line) => acc + (line.lineTotal || 0), 0) || 0;
    const notes = item.notes || "-";
    const supplierName = item.supplier?.name || item.supplierName || "-";

    return (
        <AppShell title={`Receptie: ${item.docNo}`}>
            <PageToolbar
                left={
                    <Button variant="ghost" onClick={() => navigate("/goods-receipts")}>
                        &larr; Inapoi
                    </Button>
                }
                right={
                    <div className="text-sm text-zinc-400">
                        Creat de: <span className="text-white">{item.createdBy || "System"}</span> la{" "}
                        <span className="text-white">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString("ro-RO") : "-"}
                        </span>
                    </div>
                }
            />

            <div className="space-y-6 max-w-5xl mx-auto pb-10">
                {/* Header Card */}
                <Card title="Date Document">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                        <div>
                            <div className="text-xs font-semibold text-zinc-500 uppercase mb-1">Data Receptie</div>
                            <div className="text-white font-medium text-lg">
                                {new Date(item.receiptDate).toLocaleDateString("ro-RO")}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-zinc-500 uppercase mb-1">Furnizor</div>
                            <div className="text-white font-medium text-lg">{supplierName}</div>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-zinc-500 uppercase mb-1">Moneda / Curs</div>
                            <div className="text-white">
                                <span className="font-bold text-lg">{item.currency}</span>
                                {item.currency !== "RON" && (
                                    <span className="ml-2 text-zinc-400 text-xs">
                                        (Curs: {item.currency === "EUR" ? item.fxRonEur : item.fxRonUsd})
                                    </span>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-zinc-500 uppercase mb-1">Total Document</div>
                            <div className="text-emerald-400 font-bold text-xl font-mono">
                                {calculatedTotal.toFixed(2)} <span className="text-sm">{item.currency}</span>
                            </div>
                        </div>
                        <div className="col-span-full">
                            <div className="text-xs font-semibold text-zinc-500 uppercase mb-1">Observatii</div>
                            <div className="text-zinc-300 bg-white/5 p-3 rounded border border-white/10 italic">
                                {notes}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Lines Table */}
                <Card title={`Linii Receptie (${item.lines?.length || 0})`}>
                    <TableShell>
                        <table className="w-full text-sm">
                            <thead className="bg-white/5 text-zinc-400 uppercase font-semibold">
                                <tr>
                                    <th className="px-4 py-3 text-left">Articol (SKU)</th>
                                    <th className="px-4 py-3 text-left">U.M.</th>
                                    <th className="px-4 py-3 text-right">Cantitate</th>
                                    <th className="px-4 py-3 text-right">Pret Unitar</th>
                                    <th className="px-4 py-3 text-right">Valoare</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {item.lines?.map((line) => (
                                    <tr key={line.id} className="hover:bg-white/5">
                                        <td className="px-4 py-2">
                                            <div className="text-white font-medium">
                                                {line.partName || "N/A"}
                                            </div>
                                            <div className="text-xs text-zinc-500 font-mono">
                                                {line.partCode || "-"}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-zinc-400">{line.uom || "-"}</td>
                                        <td className="px-4 py-2 text-right font-medium text-white">
                                            {line.qty}
                                        </td>
                                        <td className="px-4 py-2 text-right text-zinc-300">
                                            {line.unitPrice.toFixed(2)} <span className="text-xs text-zinc-500">{line.currency}</span>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono text-emerald-400 font-bold">
                                            {line.lineTotal.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                                {!item.lines?.length && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-zinc-500">
                                            Aceasta receptie nu are linii.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {/* Footer Total */}
                            {item.lines && item.lines.length > 0 && (
                                <tfoot className="bg-white/5 font-bold text-white border-t border-white/20">
                                    <tr>
                                        <td colSpan={4} className="px-4 py-3 text-right uppercase text-zinc-400">Total</td>
                                        <td className="px-4 py-3 text-right font-mono text-emerald-400">
                                            {calculatedTotal.toFixed(2)} <span className="text-xs text-zinc-500">{item.currency}</span>
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </TableShell>
                </Card>
            </div>
        </AppShell>
    );
}
