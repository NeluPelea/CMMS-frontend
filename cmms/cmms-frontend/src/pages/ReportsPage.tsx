import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import {
    Button,
    Card,
    EmptyRow,
    ErrorBox,
    PageToolbar,
    TableShell,
} from "../components/ui";
import {
    getLaborReport,
    getPartsReport,
    type LaborReportItem,
    type PartReportItem,
} from "../api/reports";

export default function ReportsPage() {
    const [tab, setTab] = useState<"labor" | "parts">("labor");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter - Default to current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [from, setFrom] = useState(startOfMonth.toISOString().split("T")[0]);
    const [to, setTo] = useState(now.toISOString().split("T")[0]);

    const [laborData, setLaborData] = useState<LaborReportItem[]>([]);
    const [partsData, setPartsData] = useState<PartReportItem[]>([]);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            if (tab === "labor") {
                const data = await getLaborReport(from, to);
                setLaborData(data);
            } else {
                const data = await getPartsReport(from, to);
                setPartsData(data);
            }
        } catch (err: any) {
            setError(err.message || "Eroare incarcare raport");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, [tab]); // Don't reload on date change automatically, wait for button? Or auto?
    // Let's reload on button click or tab change.

    return (
        <AppShell title="Rapoarte">
            <PageToolbar
                left={
                    <div className="flex items-center gap-4">
                        <div className="text-xl font-bold text-zinc-100">Rapoarte si Analize</div>
                        <div className="flex items-center gap-2 text-sm text-zinc-400 bg-white/5 p-1 rounded-lg">
                            <input
                                type="date"
                                className="bg-transparent border-none text-zinc-200 focus:ring-0"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                            />
                            <span>—</span>
                            <input
                                type="date"
                                className="bg-transparent border-none text-zinc-200 focus:ring-0"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                            />
                        </div>
                        <Button onClick={load} variant="primary" size="sm" disabled={loading}>
                            Actualizeaza
                        </Button>
                    </div>
                }
                right={null}
            />

            {error && <ErrorBox message={error} onClose={() => setError(null)} />}

            <div className="mb-6 flex gap-2">
                <Button
                    variant={tab === "labor" ? "primary" : "ghost"}
                    onClick={() => setTab("labor")}
                >
                    Manopera (Labor)
                </Button>
                <Button
                    variant={tab === "parts" ? "primary" : "ghost"}
                    onClick={() => setTab("parts")}
                >
                    Consum Piese
                </Button>
            </div>

            <Card>
                {loading && <div className="p-4 text-center text-zinc-500">Se incarca...</div>}
                {!loading && tab === "labor" && (
                    <TableShell>
                        <table className="w-full text-left text-sm text-zinc-300">
                            <thead className="bg-white/5 text-zinc-400">
                                <tr>
                                    <th className="px-4 py-3">Persoana</th>
                                    <th className="px-4 py-3 text-right">Minute Lucrate</th>
                                    <th className="px-4 py-3 text-right">Ore</th>
                                    <th className="px-4 py-3 text-right">Tickete</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {laborData.map((it) => (
                                    <tr key={it.personId} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-medium text-zinc-200">{it.personName}</td>
                                        <td className="px-4 py-3 text-right font-mono">{it.totalMinutes}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-teal-400">
                                            {(it.totalMinutes / 60).toFixed(1)}
                                        </td>
                                        <td className="px-4 py-3 text-right">{it.workOrderCount}</td>
                                    </tr>
                                ))}
                                {laborData.length === 0 && <EmptyRow colSpan={4} text="Nicio data." />}
                            </tbody>
                        </table>
                    </TableShell>
                )}

                {!loading && tab === "parts" && (
                    <TableShell>
                        <table className="w-full text-left text-sm text-zinc-300">
                            <thead className="bg-white/5 text-zinc-400">
                                <tr>
                                    <th className="px-4 py-3">Cod</th>
                                    <th className="px-4 py-3">Denumire Piesa</th>
                                    <th className="px-4 py-3 text-right">Cantitate Totala</th>
                                    <th className="px-4 py-3 text-right">Tickete</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {partsData.map((it) => (
                                    <tr key={it.partId} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-mono text-zinc-400">{it.partCode || "—"}</td>
                                        <td className="px-4 py-3 font-medium text-zinc-200">{it.partName}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-teal-400">
                                            {it.totalQty}
                                        </td>
                                        <td className="px-4 py-3 text-right">{it.workOrderCount}</td>
                                    </tr>
                                ))}
                                {partsData.length === 0 && <EmptyRow colSpan={4} text="Nicio data." />}
                            </tbody>
                        </table>
                    </TableShell>
                )}
            </Card>
        </AppShell>
    );
}
