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
import { hasPerm } from "../api";
import {
    getLaborByPersonReport,
    getPartsReport,
    getLaborByAssetReport,
    getLaborByAssetDailyReport,
    getTopDowntimeReport,
    getExtraJobsReport,
    type PersonnelLaborItem,
    type PartReportItem,
    type AssetLaborItem,
    type AssetLaborDailyItem,
    type AssetDowntimeItem,
    type ExtraJobReportItem,
    type TimelineSegmentDto,
} from "../api/reports";

const translatedStatus: Record<string, string> = {
    "Open": "Deschis",
    "InProgress": "In Lucru",
    "Done": "Finalizat",
    "Cancelled": "Anulat",
};

export default function ReportsPage() {
    return <ReportsContent />;
}

function formatTimelineTime(iso?: string) {
    if (!iso) return "—";
    const parts = iso.split("T");
    if (parts.length < 2) return "—";
    return parts[1].substring(0, 5);
}

function ActivityTimeline({ item }: { item: ExtraJobReportItem }) {
    if (!item.timelineStart || !item.timelineEnd || !item.segments || !item.segments.length) {
        return <div className="text-zinc-600 text-[10px]">—</div>;
    }

    const tStart = new Date(item.timelineStart).getTime();
    const tEnd = new Date(item.timelineEnd).getTime();
    const range = tEnd - tStart;

    if (range <= 0) return <div className="text-zinc-600 text-[10px]">—</div>;

    const statusTones: Record<string, string> = {
        "Open": "bg-blue-500/40 border-blue-500/50 text-blue-200",
        "InProgress": "bg-blue-500/40 border-blue-500/50 text-blue-200",
        "Done": "bg-blue-500/40 border-blue-500/50 text-blue-200",
        "Cancelled": "bg-rose-500/40 border-rose-500/50 text-rose-200",
    };
    const toneClass = (item.status && statusTones[item.status]) || "bg-zinc-500/40 border-zinc-500/50 text-zinc-200";

    return (
        <div className="flex flex-col gap-1 w-full min-w-[160px]">
            <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>{formatTimelineTime(item.timelineStart)}</span>
                <span>{formatTimelineTime(item.timelineEnd)}</span>
            </div>
            <div className="relative h-6 bg-zinc-950/50 rounded border border-white/5 overflow-hidden">
                {item.segments.map((seg, i) => {
                    const s = new Date(seg.startAt).getTime();
                    const e = seg.stopAt ? new Date(seg.stopAt).getTime() : Date.now();

                    const left = Math.max(0, ((s - tStart) / range) * 100);
                    const width = Math.min(100 - left, ((e - s) / range) * 100);

                    if (width < 0.5) return null; // Too small

                    return (
                        <div
                            key={i}
                            className={`absolute top-0 bottom-0 border-x flex items-center justify-center text-[9px] font-bold overflow-hidden px-0.5 ${toneClass}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${Math.round(seg.durationMinutes)} min`}
                        >
                            {width > 12 ? `${Math.round(seg.durationMinutes)}m` : ""}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function InterventionLegend() {
    return (
        <div className="flex flex-wrap items-center gap-6 mb-4 text-[11px] font-semibold text-zinc-400 bg-white/5 p-2 rounded-lg border border-white/5">
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500"></span>
                <span>PM</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-sky-500"></span>
                <span>WO Proactiv</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-rose-500"></span>
                <span>WO Reactiv</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-600"></span>
                <span>Activitati Extra</span>
            </div>
        </div>
    );
}

function AssetInterventionTimeline({ segments, from, to }: { segments: TimelineSegmentDto[], from: string, to: string }) {
    const startObj = new Date(from);
    startObj.setHours(0, 0, 0, 0);
    const start = startObj.getTime();

    const effectiveTo = new Date(to);
    effectiveTo.setHours(23, 59, 59, 999);
    const endMs = effectiveTo.getTime();

    const total = endMs - start;

    if (total <= 0) return <div className="h-5 bg-zinc-900 rounded border border-white/5"></div>;

    const sorted = [...segments].sort((a, b) => (b.minutes - a.minutes));
    const rendered = sorted.slice(0, 20);
    const others = sorted.length - rendered.length;

    const colorMap: Record<string, string> = {
        "PM": "bg-emerald-500",
        "Proactive": "bg-sky-500",
        "Reactive": "bg-rose-500",
        "Extra": "bg-blue-600",
        "Other": "bg-zinc-500"
    };

    return (
        <div className="relative w-full h-5 bg-zinc-900 rounded overflow-hidden flex items-center border border-white/5">
            {rendered.map((seg, idx) => {
                const s = new Date(seg.startUtc).getTime();
                const e = new Date(seg.stopUtc).getTime();

                const clampedS = Math.max(s, start);
                const clampedE = Math.min(e, endMs);

                if (clampedE <= clampedS) return null;

                const left = ((clampedS - start) / total) * 100;
                const width = ((clampedE - clampedS) / total) * 100;

                return (
                    <div
                        key={idx}
                        className={`absolute h-full transition-all hover:brightness-125 hover:z-10 ${colorMap[seg.type] || colorMap.Other}`}
                        style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                        title={`${seg.type}: ${seg.minutes} min (${new Date(seg.startUtc).toLocaleTimeString()} - ${new Date(seg.stopUtc).toLocaleTimeString()})`}
                    />
                );
            })}
            {others > 0 && (
                <span className="absolute right-1 text-[8px] text-zinc-100 bg-black/60 px-1 rounded font-bold pointer-events-none">
                    +{others}
                </span>
            )}
        </div>
    );
}

function ReportsContent() {
    const [tab, setTab] = useState<"labor" | "parts" | "labor-asset" | "labor-asset-daily" | "downtime" | "extra">("labor");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter - Default to current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [from, setFrom] = useState(startOfMonth.toISOString().split("T")[0]);
    const [to, setTo] = useState(now.toISOString().split("T")[0]);

    const [laborData, setLaborData] = useState<PersonnelLaborItem[]>([]);
    const [partsData, setPartsData] = useState<PartReportItem[]>([]);
    const [laborAssetData, setLaborAssetData] = useState<AssetLaborItem[]>([]);
    const [laborAssetDailyData, setLaborAssetDailyData] = useState<AssetLaborDailyItem[]>([]);
    const [downtimeData, setDowntimeData] = useState<AssetDowntimeItem[]>([]);
    const [extraJobsData, setExtraJobsData] = useState<ExtraJobReportItem[]>([]);

    async function handleExportPdf() {
        try {
            setLoading(true);
            const token = localStorage.getItem("cmms_token"); // Simple way as getToken might not be exported here
            const response = await fetch(`${(window as any).VITE_API_BASE || "http://localhost:5026"}/api/reports/extra-jobs/export/pdf?from=${from}&to=${to}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Export esuat (HTTP ${response.status})`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Raport_Activitati_Extra_${from}_${to}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.message || "Eroare la exportul PDF");
        } finally {
            setLoading(false);
        }
    }

    async function handleExportLaborPdf() {
        try {
            setLoading(true);
            const token = localStorage.getItem("cmms_token");
            const response = await fetch(`${(window as any).VITE_API_BASE || "http://localhost:5026"}/api/reports/activity-in-period/export/pdf?from=${from}&to=${to}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Export esuat (HTTP ${response.status})`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Raport_Activitate_in_perioada_${from}_${to}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.message || "Eroare la exportul PDF");
        } finally {
            setLoading(false);
        }
    }

    async function handleExportLaborAssetPdf() {
        try {
            setLoading(true);
            const token = localStorage.getItem("cmms_token");
            const response = await fetch(`${(window as any).VITE_API_BASE || "http://localhost:5026"}/api/reports/interventii-utilaje/export/pdf?from=${from}&to=${to}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Export esuat (HTTP ${response.status})`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Raport_Interventii_pe_utilaje_in_perioada_${from}_${to}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.message || "Eroare la exportul PDF");
        } finally {
            setLoading(false);
        }
    }

    async function handleExportLaborAssetDailyPdf() {
        try {
            setLoading(true);
            const token = localStorage.getItem("cmms_token");
            const response = await fetch(`${(window as any).VITE_API_BASE || "http://localhost:5026"}/api/reports/interventii-utilaje-detaliat/export/pdf?from=${from}&to=${to}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Export esuat (HTTP ${response.status})`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Raport_Interventii_utilaje_detaliat_${from}_${to}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.message || "Eroare la exportul PDF");
        } finally {
            setLoading(false);
        }
    }

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const [labor, parts, laborAsset, laborAssetDaily, downtime, extra] = await Promise.all([
                getLaborByPersonReport(from, to),
                getPartsReport(from, to),
                getLaborByAssetReport(from, to),
                getLaborByAssetDailyReport(from, to),
                getTopDowntimeReport(from, to),
                getExtraJobsReport(from, to),
            ]);

            setLaborData(labor);
            setPartsData(parts);
            setLaborAssetData(laborAsset);
            setLaborAssetDailyData(laborAssetDaily);
            setDowntimeData(downtime);
            setExtraJobsData(extra);
        } catch (err: any) {
            setError(err.message || "Eroare incarcare raport");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <AppShell title="Rapoarte">
            <PageToolbar
                left={<div className="text-xl font-bold text-zinc-100">Rapoarte si Analize</div>}
                right={
                    <div className="flex flex-wrap items-center gap-2 bg-zinc-800 p-1 rounded border border-zinc-700">
                        <input
                            type="date"
                            className="bg-transparent border-none text-sm text-zinc-200 focus:ring-0"
                            value={from}
                            onChange={e => setFrom(e.target.value)}
                        />
                        <span className="text-zinc-500">-</span>
                        <input
                            type="date"
                            className="bg-transparent border-none text-sm text-zinc-200 focus:ring-0"
                            value={to}
                            onChange={e => setTo(e.target.value)}
                        />
                        <Button size="sm" onClick={load}>Aplica</Button>
                    </div>
                }
            />

            {tab === "extra" && !loading && hasPerm("REPORTS_EXPORT") && (
                <div className="flex justify-end mb-4">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleExportPdf}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        📄 Export PDF
                    </Button>
                </div>
            )}

            {tab === "labor" && !loading && hasPerm("REPORTS_EXPORT") && (
                <div className="flex justify-end mb-4">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleExportLaborPdf}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        📄 Export PDF
                    </Button>
                </div>
            )}

            {tab === "labor-asset" && !loading && hasPerm("REPORTS_EXPORT") && (
                <div className="flex justify-end mb-4">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleExportLaborAssetPdf}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        📄 Export PDF
                    </Button>
                </div>
            )}

            {tab === "labor-asset-daily" && !loading && hasPerm("REPORTS_EXPORT") && (
                <div className="flex justify-end mb-4">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleExportLaborAssetDailyPdf}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        📄 Export PDF
                    </Button>
                </div>
            )}

            {error && <ErrorBox message={error} onClose={() => setError(null)} />}

            <div className="flex gap-4 border-b border-zinc-700 mb-6 overflow-x-auto">
                <button
                    onClick={() => setTab("labor")}
                    className={`pb-2 text-sm font-medium whitespace-nowrap ${tab === "labor" ? "text-teal-400 border-b-2 border-teal-400" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                    Activitate in perioada
                </button>
                <button
                    onClick={() => setTab("parts")}
                    className={`pb-2 text-sm font-medium whitespace-nowrap ${tab === "parts" ? "text-teal-400 border-b-2 border-teal-400" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                    Piese de schimb
                </button>
                <button
                    onClick={() => setTab("labor-asset")}
                    className={`pb-2 text-sm font-medium whitespace-nowrap ${tab === "labor-asset" ? "text-teal-400 border-b-2 border-teal-400" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                    Interventii pe utilaje in perioada
                </button>
                <button
                    onClick={() => setTab("labor-asset-daily")}
                    className={`pb-2 text-sm font-medium whitespace-nowrap ${tab === "labor-asset-daily" ? "text-teal-400 border-b-2 border-teal-400" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                    Interventii utilaje detaliat
                </button>
                <button
                    onClick={() => setTab("downtime")}
                    className={`pb-2 text-sm font-medium whitespace-nowrap ${tab === "downtime" ? "text-teal-400 border-b-2 border-teal-400" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                    Top Stationari (Downtime)
                </button>
                <button
                    onClick={() => setTab("extra")}
                    className={`pb-2 text-sm font-medium whitespace-nowrap ${tab === "extra" ? "text-teal-400 border-b-2 border-teal-400" : "text-zinc-400 hover:text-zinc-200"}`}
                >
                    Activitati Extra
                </button>
            </div>

            {loading && <div className="text-center py-8 text-zinc-500">Se incarca datele...</div>}

            {
                !loading && tab === "labor" && (
                    <div className="grid gap-6">
                        <InterventionLegend />
                        <Card>
                            <TableShell>
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-white/5 text-zinc-400">
                                        <tr>
                                            <th className="px-4 py-3">Angajat</th>
                                            <th className="px-4 py-3">Rol / Functie</th>
                                            <th className="px-4 py-3 min-w-[200px]">Grafic activitate in perioada</th>
                                            <th className="px-4 py-3 text-right">Timp PM (min)</th>
                                            <th className="px-4 py-3 text-right">Timp WO proactiv (min)</th>
                                            <th className="px-4 py-3 text-right">Timp WO reactiv (min)</th>
                                            <th className="px-4 py-3 text-right">Timp Extra (min)</th>
                                            <th className="px-4 py-3 text-right">Timp total lucrat (min)</th>
                                            <th className="px-4 py-3 text-right">% Lucrat</th>
                                            <th className="px-4 py-3 text-right text-rose-400">% Reactiv</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {laborData.map((it, idx) => (
                                            <tr key={idx} className="hover:bg-white/5">
                                                <td className="px-4 py-3 font-medium text-zinc-200">{it.personName}</td>
                                                <td className="px-4 py-3 text-zinc-500 text-xs">{it.jobTitle || "—"}</td>
                                                <td className="px-4 py-3">
                                                    <AssetInterventionTimeline segments={it.timelineSegments} from={from} to={to} />
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-emerald-400">{it.minutesPm} </td>
                                                <td className="px-4 py-3 text-right font-mono text-sky-400">{it.minutesWoProactive} </td>
                                                <td className="px-4 py-3 text-right font-mono text-rose-400">{it.minutesWoReactive} </td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-400">{it.minutesExtra} </td>
                                                <td className="px-4 py-3 text-right font-bold text-teal-400">{it.minutesTotal} </td>
                                                <td className="px-4 py-3 text-right font-mono text-zinc-400">
                                                    {it.workedPct != null ? `${it.workedPct.toFixed(1)}%` : "-"}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-rose-500 bg-rose-500/5">
                                                    {it.reactivePct != null ? `${it.reactivePct.toFixed(1)}%` : "-"}
                                                </td>
                                            </tr>
                                        ))}
                                        {laborData.length === 0 && <EmptyRow colSpan={10} text="Nu exista date." />}
                                    </tbody>
                                </table>
                            </TableShell>
                        </Card>
                    </div>
                )
            }

            {
                !loading && tab === "parts" && (
                    <div className="grid gap-6">
                        <Card>
                            <TableShell>
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-white/5 text-zinc-400">
                                        <tr>
                                            <th className="px-4 py-3">Cod Piesa</th>
                                            <th className="px-4 py-3">Denumire</th>
                                            <th className="px-4 py-3 text-right">Comenzi</th>
                                            <th className="px-4 py-3 text-right">Cantitate Totala</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {partsData.map((it, idx) => (
                                            <tr key={idx} className="hover:bg-white/5">
                                                <td className="px-4 py-3 font-mono text-zinc-400">{it.partCode || "-"}</td>
                                                <td className="px-4 py-3 font-medium text-zinc-200">{it.partName}</td>
                                                <td className="px-4 py-3 text-right">{it.workOrderCount}</td>
                                                <td className="px-4 py-3 text-right font-bold text-teal-400">{it.totalQty}</td>
                                            </tr>
                                        ))}
                                        {partsData.length === 0 && <EmptyRow colSpan={4} text="Nu exista date." />}
                                    </tbody>
                                </table>
                            </TableShell>
                        </Card>
                    </div>
                )
            }

            {
                !loading && tab === "labor-asset" && (
                    <div className="grid gap-6">
                        <InterventionLegend />
                        <Card>
                            <TableShell>
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-white/5 text-zinc-400">
                                        <tr>
                                            <th className="px-4 py-3">Utilaj</th>
                                            <th className="px-4 py-3">Locatie</th>
                                            <th className="px-4 py-3 min-w-[200px]">Interventii in perioada</th>
                                            <th className="px-4 py-3 text-right">WO Proactiv</th>
                                            <th className="px-4 py-3 text-right">WO Reactiv</th>
                                            <th className="px-4 py-3 text-right">PM</th>
                                            <th className="px-4 py-3 text-right text-rose-400">% Reactiv</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {laborAssetData.map((it, idx) => (
                                            <tr key={idx} className="hover:bg-white/5">
                                                <td className="px-4 py-3 font-medium text-zinc-200">{it.assetName}</td>
                                                <td className="px-4 py-3 text-zinc-400">{it.locationName}</td>
                                                <td className="px-4 py-3">
                                                    <AssetInterventionTimeline segments={it.timelineSegments} from={from} to={to} />
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-sky-400">{it.minutesWoProactive} m</td>
                                                <td className="px-4 py-3 text-right font-mono text-rose-400">{it.minutesWoReactive} m</td>
                                                <td className="px-4 py-3 text-right font-mono text-emerald-400">{it.minutesPm} m</td>
                                                <td className="px-4 py-3 text-right font-bold text-rose-500 bg-rose-500/5">{it.reactivePct.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                        {laborAssetData.length === 0 && <EmptyRow colSpan={7} text="Nu exista date pentru perioada selectata." />}
                                    </tbody>
                                </table>
                            </TableShell>
                        </Card>
                    </div>
                )
            }

            {
                !loading && tab === "labor-asset-daily" && (
                    <div className="grid gap-6">
                        <InterventionLegend />
                        <Card>
                            <TableShell>
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-white/5 text-zinc-400">
                                        <tr>
                                            <th className="px-4 py-3">Data</th>
                                            <th className="px-4 py-3">Utilaj</th>
                                            <th className="px-4 py-3">Locatie</th>
                                            <th className="px-4 py-3 min-w-[200px]">Interventii in ziua respectiva</th>
                                            <th className="px-4 py-3 text-right">WO Proactiv</th>
                                            <th className="px-4 py-3 text-right">WO Reactiv</th>
                                            <th className="px-4 py-3 text-right">PM</th>
                                            <th className="px-4 py-3 text-right text-rose-400">% Reactiv</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {laborAssetDailyData.map((it, idx) => {
                                            const rowDate = it.date.split("T")[0];
                                            return (
                                                <tr key={idx} className="hover:bg-white/5">
                                                    <td className="px-4 py-3 font-mono text-zinc-400 text-xs">{new Date(it.date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3 font-medium text-zinc-200">{it.assetName}</td>
                                                    <td className="px-4 py-3 text-zinc-400">{it.locationName}</td>
                                                    <td className="px-4 py-3">
                                                        <AssetInterventionTimeline segments={it.timelineSegments} from={rowDate} to={rowDate} />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sky-400">{it.minutesWoProactive} m</td>
                                                    <td className="px-4 py-3 text-right font-mono text-rose-400">{it.minutesWoReactive} m</td>
                                                    <td className="px-4 py-3 text-right font-mono text-emerald-400">{it.minutesPm} m</td>
                                                    <td className="px-4 py-3 text-right font-bold text-rose-500 bg-rose-500/5">
                                                        {it.reactivePct > 0 ? `${it.reactivePct.toFixed(1)}%` : "-"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {laborAssetDailyData.length === 0 && <EmptyRow colSpan={8} text="Nu exista date pentru perioada selectata." />}
                                    </tbody>
                                </table>
                            </TableShell>
                        </Card>
                    </div>
                )
            }

            {
                !loading && tab === "downtime" && (
                    <div className="grid gap-6">
                        <Card>
                            <TableShell>
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-white/5 text-zinc-400">
                                        <tr>
                                            <th className="px-4 py-3">Utilaj</th>
                                            <th className="px-4 py-3 text-right">Nr Comenzi</th>
                                            <th className="px-4 py-3 text-right">Total Ore Downtime</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {downtimeData.map((it, idx) => (
                                            <tr key={idx} className="hover:bg-white/5">
                                                <td className="px-4 py-3 font-medium text-zinc-200">{it.assetName}</td>
                                                <td className="px-4 py-3 text-right">{it.workOrderCount}</td>
                                                <td className="px-4 py-3 text-right font-bold text-red-400">{it.totalHours} h</td>
                                            </tr>
                                        ))}
                                        {downtimeData.length === 0 && <EmptyRow colSpan={3} text="Nu exista date." />}
                                    </tbody>
                                </table>
                            </TableShell>
                        </Card>
                    </div>
                )
            }

            {
                !loading && tab === "extra" && (
                    <div className="grid gap-6">
                        <Card>
                            <TableShell>
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-white/5 text-zinc-400">
                                        <tr>
                                            <th className="px-4 py-3">Data Crearii</th>
                                            <th className="px-4 py-3">Creat De</th>
                                            <th className="px-4 py-3">Angajat</th>
                                            <th className="px-4 py-3">Titlu Activitate</th>
                                            <th className="px-4 py-3">Activitate</th>
                                            <th className="px-4 py-3">Detalii</th>
                                            <th className="px-4 py-3 text-right">Timp Total</th>
                                            <th className="px-4 py-3 text-right">Pondere activitate</th>
                                            <th className="px-4 py-3 text-right w-24">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {Array.isArray(extraJobsData) && extraJobsData.map((it) => (
                                            <tr key={it.id} className="hover:bg-white/5">
                                                <td className="px-4 py-3 text-zinc-400 font-mono text-xs">
                                                    {it.createdAt ? new Date(it.createdAt).toLocaleString() : "-"}
                                                </td>
                                                <td className="px-4 py-3 text-zinc-300">
                                                    {it.createdBy}
                                                </td>
                                                <td className="px-4 py-3 text-zinc-300">
                                                    {it.assigneeName || "-"}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-zinc-200">
                                                    {it.title}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <ActivityTimeline item={it} />
                                                </td>
                                                <td className="px-4 py-3 text-zinc-400 text-xs">
                                                    {it.description || "-"}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-teal-400 font-bold whitespace-nowrap">
                                                    {(it.totalMinutes / 60).toFixed(1)} h
                                                    <span className="text-zinc-600 font-normal text-xs ml-1">({it.totalMinutes}m)</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-400">
                                                    {it.weightPct != null ? `${it.weightPct}%` : "-"}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                                                        {translatedStatus[it.status] || it.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!Array.isArray(extraJobsData) || extraJobsData.length === 0) && <EmptyRow colSpan={9} text="Nu exista activitati in perioada selectata." />}
                                    </tbody>
                                </table>
                            </TableShell>
                        </Card>
                    </div>
                )
            }
        </AppShell >
    );
}
