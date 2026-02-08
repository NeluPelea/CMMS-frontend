import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    getWorkOrderById,
    getWorkOrderParts,
    getWorkOrderLaborLogs,
    type WorkOrderDto,
    type WorkOrderPartDto,
    type LaborLogDto,
} from "../api";

export default function WorkOrderPrintPage() {
    const { id } = useParams<{ id: string }>();
    const [wo, setWo] = useState<WorkOrderDto | null>(null);
    const [parts, setParts] = useState<WorkOrderPartDto[]>([]);
    const [labor, setLabor] = useState<LaborLogDto[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        Promise.all([
            getWorkOrderById(id),
            getWorkOrderParts(id),
            getWorkOrderLaborLogs(id),
        ])
            .then(([w, p, l]) => {
                setWo(w);
                setParts(Array.isArray(p) ? p : []);
                setLabor(Array.isArray(l) ? l : []);
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="p-8">Se incarca...</div>;
    if (!wo) return <div className="p-8">Ordin de lucru negasit.</div>;

    return (
        <div className="min-h-screen bg-white text-black p-8 font-sans">
            <style>{`
                @media print {
                    @page { margin: 1cm; size: A4; }
                    body { -webkit-print-color-adjust: exact; }
                }
            `}</style>

            <div className="max-w-[210mm] mx-auto border border-gray-300 p-8 shadow-sm print:shadow-none print:border-none print:p-0">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-wider">Bon de Lucru & Consum</h1>
                        <div className="text-sm text-gray-600 mt-1">CMMS System</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-mono font-bold">#{wo.id.substring(0, 8)}</div>
                        <div className="text-sm text-gray-500">{new Date().toLocaleDateString()}</div>
                    </div>
                </div>

                {/* Info Generale */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <h3 className="font-bold text-gray-500 uppercase text-xs mb-1">Titlu si Descriere</h3>
                        <div className="font-semibold text-lg">{wo.title}</div>
                        <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{wo.description || "—"}</div>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-500 uppercase text-xs mb-1">Activ / Locatie</h3>
                        <div className="font-semibold">{wo.asset?.name || "Fara Activ"}</div>
                        <div className="text-sm text-gray-600">
                            {wo.asset?.code && <span>Cod: {wo.asset.code}</span>}
                            {wo.asset?.location && <span> | Loc: {wo.asset.location.name}</span>}
                        </div>
                    </div>
                </div>

                {/* Dates & Status */}
                <div className="grid grid-cols-4 gap-4 mb-8 bg-gray-50 p-4 rounded print:bg-transparent print:p-0">
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold">Start</div>
                        <div className="font-mono">{wo.startAt ? new Date(wo.startAt).toLocaleString() : "—"}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold">Stop</div>
                        <div className="font-mono">{wo.stopAt ? new Date(wo.stopAt).toLocaleString() : "—"}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold">Durata</div>
                        <div className="font-mono">{wo.durationMinutes ? `${wo.durationMinutes} min` : "—"}</div>
                    </div>
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-bold">Status</div>
                        <div>{getStatusName(wo.status)}</div>
                    </div>
                </div>

                {/* Raport Tehnic */}
                {(wo.defect || wo.cause || wo.solution) && (
                    <div className="mb-8 border border-gray-200 rounded p-4 print:border-black">
                        <h3 className="font-bold text-lg mb-4 border-b pb-2">Raport Interventie</h3>
                        <div className="grid gap-4">
                            {wo.defect && (
                                <div>
                                    <span className="font-bold text-sm">Defect:</span>{" "}
                                    <span className="text-sm">{wo.defect}</span>
                                </div>
                            )}
                            {wo.cause && (
                                <div>
                                    <span className="font-bold text-sm">Cauza:</span>{" "}
                                    <span className="text-sm">{wo.cause}</span>
                                </div>
                            )}
                            {wo.solution && (
                                <div>
                                    <span className="font-bold text-sm">Solutie:</span>{" "}
                                    <span className="text-sm">{wo.solution}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Manopera */}
                <div className="mb-8">
                    <h3 className="font-bold text-lg mb-2">Manopera (Labor)</h3>
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b-2 border-black text-left">
                                <th className="py-2">Tehnician</th>
                                <th className="py-2">Descriere</th>
                                <th className="py-2 text-right">Minute</th>
                            </tr>
                        </thead>
                        <tbody>
                            {labor.map((l, i) => (
                                <tr key={l.id || i} className="border-b border-gray-200">
                                    <td className="py-2">{l.personName}</td>
                                    <td className="py-2">{l.description || "—"}</td>
                                    <td className="py-2 text-right font-mono">{l.minutes}</td>
                                </tr>
                            ))}
                            <tr className="font-bold bg-gray-50 print:bg-transparent">
                                <td className="py-2 text-right" colSpan={2}>Total Ore:</td>
                                <td className="py-2 text-right font-mono">
                                    {(labor.reduce((acc, c) => acc + c.minutes, 0) / 60).toFixed(2)} h
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Piese (Bon Consum) */}
                <div className="mb-12">
                    <h3 className="font-bold text-lg mb-2">Piese Utilizate (Bon Consum)</h3>
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b-2 border-black text-left">
                                <th className="py-2">Cod Piesa</th>
                                <th className="py-2">Denumire</th>
                                <th className="py-2 text-right">Cantitate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parts.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="py-4 text-center text-gray-500 italic">Fara piese utilizate.</td>
                                </tr>
                            ) : parts.map((p, i) => (
                                <tr key={p.id || i} className="border-b border-gray-200">
                                    <td className="py-2 font-mono">{p.partCode || "—"}</td>
                                    <td className="py-2">{p.partName}</td>
                                    <td className="py-2 text-right font-mono font-bold">{p.qtyUsed}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-16 mt-12 pt-8 border-t-2 border-black page-break-inside-avoid">
                    <div>
                        <div className="border-t border-black w-2/3 mb-2"></div>
                        <div className="text-sm font-bold uppercase">Semnatura Executant</div>
                    </div>
                    <div>
                        <div className="border-t border-black w-2/3 mb-2"></div>
                        <div className="text-sm font-bold uppercase">Semnatura Beneficiar / Sef Sectie</div>
                    </div>
                </div>

                {/* Print Button (Screen only) */}
                <div className="fixed bottom-8 right-8 print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform transform hover:-translate-y-1"
                    >
                        🖨️ Printeaza
                    </button>
                    <button
                        onClick={() => window.close()}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-full shadow-lg ml-4 transition-transform transform hover:-translate-y-1"
                    >
                        Inchide
                    </button>
                </div>
            </div>
        </div>
    );
}

function getStatusName(s: number) {
    if (s === 1) return "Deschis";
    if (s === 2) return "In Lucru";
    if (s === 3) return "Finalizat";
    if (s === 4) return "Anulat";
    return "Necunoscut";
}
