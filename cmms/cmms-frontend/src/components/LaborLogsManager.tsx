// src/components/LaborLogsManager.tsx
import { useState, useEffect, useCallback } from "react";
import {
    getWorkOrderLaborLogs,
    addLaborLog,
    deleteLaborLog,
    getPeopleSimple,
    type PersonDto
} from "../api";
import { Card, Button, Input, Select, TableShell, EmptyRow } from "./ui";

interface LaborLogDto {
    id: string;
    personId: string;
    personName: string;
    minutes: number;
    description: string;
    createdAt: string;
}

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
            // Nota: Asigura-te ca aceste functii exista in api/index.ts
            const [logsData, peopleData] = await Promise.all([
                getWorkOrderLaborLogs(workOrderId),
                getPeopleSimple()
            ]);
            setLogs(Array.isArray(logsData) ? logsData : []);
            setPeople(Array.isArray(peopleData) ? peopleData : []);
        } catch (e) {
            console.error("Eroare la incarcarea log-urilor", e);
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
                description: desc.trim() || null
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
                        {people.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
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
                    <Button onClick={handleAddLog} variant="primary" className="w-full">Adauga</Button>
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
                                <td className="p-3 text-zinc-200">{log.personName}</td>
                                <td className="p-3 text-zinc-400 italic text-xs">{log.description || "—"}</td>
                                <td className="p-3 text-center text-teal-400 font-mono">{log.minutes}</td>
                                <td className="p-3 text-right">
                                    <button
                                        onClick={async () => { if (confirm("Stergi?")) { await deleteLaborLog(workOrderId, log.id); loadData(); } }}
                                        className="text-zinc-600 hover:text-red-400 text-xs"
                                    >
                                        Sterge
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {logs.length > 0 && (
                            <tr className="bg-white/5">
                                <td colSpan={3} className="p-3 text-right text-zinc-500 uppercase text-[10px] tracking-widest font-bold">Total:</td>
                                <td className="p-3 text-center text-teal-400 font-bold">{totalMin} min</td>
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