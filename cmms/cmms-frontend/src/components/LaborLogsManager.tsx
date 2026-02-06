// src/components/LaborLogsManager.tsx
import { useState, useEffect, useCallback } from "react";
import {
    getWorkOrderLaborLogs,
    addLaborLog,
    deleteLaborLog,
    getPeople,
    type PersonDto,
    type LaborLogDto // Folosim tipul direct din API
} from "../api";
import { Card, Input, Select, TableShell, EmptyRow } from "./ui";

export default function LaborLogsManager({ workOrderId }: { workOrderId: string }) {
    const [logs, setLogs] = useState<LaborLogDto[]>([]);
    const [people, setPeople] = useState<PersonDto[]>([]);
    const [loading, setLoading] = useState(false);

    const [personId, setPersonId] = useState("");
    const [minutes, setMinutes] = useState("60");
    const [desc, setDesc] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // getPeople asteapta un obiect de configurare, am adaugat {}
            const [logsData, peopleRes] = await Promise.all([
                getWorkOrderLaborLogs(workOrderId),
                getPeople() // Șterge obiectul {}
            ]);

            setLogs(Array.isArray(logsData) ? logsData : []);
            const pList = Array.isArray(peopleRes) ? peopleRes : (peopleRes as any)?.items || [];
            setPeople(pList);
        } catch (e) {
            console.error("Eroare la incarcarea datelor", e);
        } finally {
            setLoading(false);
        }
    }, [workOrderId]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleAddLog = async () => {
        if (!personId || !minutes) return;
        try {
            await addLaborLog(workOrderId, {
                personId,
                minutes: parseInt(minutes),
                // Folosim undefined in loc de null pentru a se potrivi cu tipul din API
                description: desc.trim() || undefined
            });
            setDesc("");
            loadData();
        } catch (e) {
            alert("Eroare la salvarea timpului.");
        }
    };

    const totalMin = logs.reduce((acc, curr) => acc + curr.minutes, 0);

    return (
        <Card title="Timp Lucrat (Labor Logs)">
            <div className="grid gap-3 sm:grid-cols-12 items-end mb-6">
                <div className="sm:col-span-3">
                    <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1 ml-1">Tehnician</div>
                    <Select value={personId} onChange={e => setPersonId(e.target.value)}>
                        <option value="">-- Selecteaza --</option>
                        {people.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.displayName}
                            </option>
                        ))}
                    </Select>
                </div>
                <div className="sm:col-span-2">
                    <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1 ml-1">Minute</div>
                    <Input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} />
                </div>
                <div className="sm:col-span-5">
                    <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1 ml-1">Activitate</div>
                    <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ce s-a lucrat..." />
                </div>
                <div className="sm:col-span-2">
                    <button
                        onClick={handleAddLog}
                        className="w-full h-[38px] bg-teal-600 hover:bg-teal-500 text-white rounded text-sm font-medium transition-colors"
                    >
                        Adauga
                    </button>
                </div>
            </div>

            <TableShell>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500 border-b border-white/10">
                            <th className="p-3 font-semibold">Data</th>
                            <th className="p-3 font-semibold">Persoana</th>
                            <th className="p-3 font-semibold">Descriere</th>
                            <th className="p-3 font-semibold text-center">Minute</th>
                            <th className="p-3 font-semibold text-right">Actiuni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.map(log => (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-3 text-zinc-500">{new Date(log.createdAt).toLocaleDateString()}</td>
                                <td className="p-3 text-zinc-200">{log.personName || "—"}</td>
                                <td className="p-3 text-zinc-400 italic text-xs">{log.description || "—"}</td>
                                <td className="p-3 text-center text-teal-400 font-mono">{log.minutes}</td>
                                <td className="p-3 text-right">
                                    <button
                                        onClick={async () => {
                                            if (confirm("Stergi?")) {
                                                await deleteLaborLog(workOrderId, log.id);
                                                loadData();
                                            }
                                        }}
                                        className="text-zinc-600 hover:text-red-400 text-xs"
                                    >
                                        Sterge
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {logs.length > 0 && (
                            <tr className="bg-white/5 font-bold">
                                <td colSpan={3} className="p-3 text-right text-zinc-500 uppercase text-[10px] tracking-widest">Total:</td>
                                <td className="p-3 text-center text-teal-400 font-mono">{totalMin} min</td>
                                <td></td>
                            </tr>
                        )}
                        {logs.length === 0 && !loading && <EmptyRow colSpan={5} text="Nicio inregistrare gasita." />}
                    </tbody>
                </table>
            </TableShell>
        </Card>
    );
}