import { useEffect, useState } from "react";
import { getWorkOrderEvents, type WorkOrderEventDto } from "../api";
import { TableShell, ErrorBox } from "./ui";

function formatDateTime(iso: string) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("ro-RO", {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function translateKind(k: number) {
    // 1=Created, 2=Updated, 3=StatusChanged, 4=AssignedChanged, 5=CommentAdded, 
    // 6=PartAdded, 7=PartRemoved, 8=Started, 9=Stopped, 10=Cancelled, 11=Reopened
    switch (k) {
        case 1: return "Creat";
        case 2: return "Actualizat";
        case 3: return "Status Schimbat";
        case 4: return "Asignare";
        case 5: return "Comentariu";
        case 6: return "Piesa +";
        case 7: return "Piesa -";
        case 8: return "Start";
        case 9: return "Stop";
        case 10: return "Anulat";
        case 11: return "Redeschis";
        default: return "Eveniment";
    }
}

export default function WorkOrderJournal({ workOrderId }: { workOrderId: string }) {
    const [events, setEvents] = useState<WorkOrderEventDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (!workOrderId) return;
        setLoading(true);
        getWorkOrderEvents(workOrderId, 500)
            .then(res => setEvents(res.items))
            .catch(e => setErr(e.message || "Eroare la incarcare jurnal"))
            .finally(() => setLoading(false));
    }, [workOrderId]);

    if (loading) return <div className="p-4 text-zinc-500 text-sm">Se incarca jurnalul...</div>;
    if (err) return <ErrorBox message={err} onClose={() => setErr(null)} />;
    if (events.length === 0) return <div className="p-4 text-zinc-500 text-sm">Nu exista evenimente inregistrate.</div>;

    return (
        <TableShell>
            <table className="w-full text-xs text-left">
                <thead className="text-zinc-500 border-b border-white/10 bg-white/5">
                    <tr>
                        <th className="p-2">Data/Ora</th>
                        <th className="p-2">Eveniment</th>
                        <th className="p-2">Detalii</th>
                        <th className="p-2">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {events.map(e => (
                        <tr key={e.id} className="hover:bg-white/5">
                            <td className="p-2 text-zinc-400 whitespace-nowrap">
                                {formatDateTime(e.createdAtUtc)}
                            </td>
                            <td className="p-2 font-medium text-zinc-300">
                                {translateKind(e.kind)}
                            </td>
                            <td className="p-2 text-zinc-300">
                                {e.message && <div className="text-zinc-400 italic">{e.message}</div>}
                                {e.field && (
                                    <div>
                                        <span className="text-zinc-500">{e.field}: </span>
                                        <span className="line-through text-red-400/70 mr-2">{e.oldValue || "-"}</span>
                                        <span className="text-emerald-400">{e.newValue || "-"}</span>
                                    </div>
                                )}
                            </td>
                            <td className="p-2">
                                {e.fromStatus && e.toStatus ? (
                                    <div className="flex items-center gap-1">
                                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/5">{e.fromStatus}</span>
                                        <span className="text-zinc-600">→</span>
                                        <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/20">{e.toStatus}</span>
                                    </div>
                                ) : "-"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </TableShell>
    );
}
