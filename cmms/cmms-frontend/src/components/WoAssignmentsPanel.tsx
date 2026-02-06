import { useEffect, useMemo, useState } from "react";
import {
    getRoles,
    getWoAssignments,
    createWoAssignment,
    deleteWoAssignment,
    getAvailablePeople,
    type RoleDto,
    type AssignmentDto,
    type PersonLiteDto,
    type CreateAssignmentReq,
} from "../api";

// --- Helper pentru conversie timp local -> UTC ---
function toIsoUtc(dateLocal: string, timeLocal: string) {
    const d = new Date(`${dateLocal}T${timeLocal}:00`);
    return d.toISOString();
}

export default function WoAssignmentsPanel({ workOrderId }: { workOrderId: string }) {
    const [roles, setRoles] = useState<RoleDto[]>([]);
    const [items, setItems] = useState<AssignmentDto[]>([]);
    const [people, setPeople] = useState<PersonLiteDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Form State
    const [roleId, setRoleId] = useState("");
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [fromTime, setFromTime] = useState("08:00");
    const [toTime, setToTime] = useState("10:00");
    const [q, setQ] = useState("");
    const [personId, setPersonId] = useState("");
    const [notes, setNotes] = useState("");

    const fromUtc = useMemo(() => toIsoUtc(date, fromTime), [date, fromTime]);
    const toUtc = useMemo(() => toIsoUtc(date, toTime), [date, toTime]);

    async function refreshAll() {
        setErr(null);
        setLoading(true);
        try {
            const [r, a] = await Promise.all([getRoles(), getWoAssignments(workOrderId)]);

            const activeRoles = (r ?? [])
                .filter(x => x.isActive)
                .sort((x, y) => (x.sortOrder ?? 0) - (y.sortOrder ?? 0));

            setRoles(activeRoles);
            setItems(Array.isArray(a) ? a : []);

            if (!roleId && activeRoles.length) {
                setRoleId(activeRoles[0].id);
            }
        } catch (e) {
            // Verificam daca 'e' este un obiect care are proprietatea message
            const errorMessage = e instanceof Error ? e.message : "Eroare la incarcarea alocarilor.";
            setErr(errorMessage);
            console.error(e); // Adaugam log pentru a evita eroarea "e is defined but never used"
        } finally {
            setLoading(false);
        }
    }

    async function refreshPeople() {
        try {
            const list = await getAvailablePeople({ fromUtc, toUtc, q: q.trim() || undefined });
            const arr = Array.isArray(list) ? list : [];
            setPeople(arr);
            if (arr.length && !arr.some(p => p.id === personId)) setPersonId(arr[0].id);
            if (!arr.length) setPersonId("");
        } catch (e) {
            console.error("Eroare:", e); // Folosim 'e' ca sa nu mai avem eroarea 'defined but never used'
            setPeople([]);
        }
    }

    useEffect(() => { refreshAll(); }, [workOrderId]);
    useEffect(() => { refreshPeople(); }, [fromUtc, toUtc]);

    async function onAdd() {
        setErr(null);

        // 1. Validari initiale fara diacritice in cod (mesajele catre user pot ramane cu diacritice daca doresti)
        if (!roleId || !personId) {
            return setErr("Selectati rolul si persoana.");
        }

        const start = new Date(fromUtc).getTime();
        const end = new Date(toUtc).getTime();

        if (end <= start) {
            return setErr("Interval orar invalid.");
        }

        const body: CreateAssignmentReq = {
            personId,
            roleId,
            plannedFrom: fromUtc,
            plannedTo: toUtc,
            notes: notes.trim() || undefined,
        };

        setLoading(true);
        try {
            await createWoAssignment(workOrderId, body);
            setNotes("");
            // Refresh date dupa succes
            await refreshAll();
        } catch (e) {
            // 2. Gestionare sigura a erorii (fara : any)
            const msg = e instanceof Error ? e.message : "Eroare la creare.";
            setErr(msg);
            console.error("onAdd error:", e); // Previne eroarea de variabila neutilizata
        } finally {
            setLoading(false);
        }
    }

    async function onDelete(id: string) {
        if (!confirm("Stergi alocarea?")) return;
        setLoading(true);
        try {
            await deleteWoAssignment(workOrderId, id);
            await refreshAll();
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-lg font-bold text-zinc-100 uppercase tracking-tight">Alocari Planificate</h3>
                    <p className="text-xs text-zinc-500">Planifica echipa si rolurile pentru acest ordin</p>
                </div>
                <button
                    onClick={refreshAll}
                    disabled={loading}
                    className="text-xs font-medium text-teal-500 hover:text-teal-400 disabled:opacity-50"
                >
                    {loading ? "Incarcare..." : "Actualizeaza"}
                </button>
            </div>

            {err && (
                <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                    {err}
                </div>
            )}

            {/* Grid Formular */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 mb-6">
                <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1 ml-1">Rol</label>
                    <select
                        className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:border-teal-500/50"
                        value={roleId} onChange={e => setRoleId(e.target.value)}
                    >
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1 ml-1">Data</label>
                    <input
                        type="date" className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none"
                        value={date} onChange={e => setDate(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1 ml-1">De la</label>
                    <input
                        type="time" className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none"
                        value={fromTime} onChange={e => setFromTime(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1 ml-1">Pana la</label>
                    <input
                        type="time" className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none"
                        value={toTime} onChange={e => setToTime(e.target.value)}
                    />
                </div>

                <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1 ml-1">Cauta Personal Disponibil</label>
                    <input
                        className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
                        placeholder="Nume sau specializare..."
                        value={q} onChange={e => setQ(e.target.value)}
                        onBlur={refreshPeople}
                    />
                </div>

                <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1 ml-1">Selecteaza Om</label>
                    <select
                        className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none"
                        value={personId} onChange={e => setPersonId(e.target.value)}
                    >
                        {!people.length && <option value="">Nicio persoana disponibila</option>}
                        {people.map(p => (
                            <option key={p.id} value={p.id}>{p.fullName} ({p.jobTitle || "n/a"})</option>
                        ))}
                    </select>
                </div>

                <div className="lg:col-span-3">
                    <input
                        className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
                        placeholder="Note/Instructiuni (optional)..."
                        value={notes} onChange={e => setNotes(e.target.value)}
                    />
                </div>

                <button
                    onClick={onAdd}
                    disabled={loading || !personId}
                    className="h-10 rounded-xl bg-teal-500 text-zinc-900 text-sm font-bold hover:bg-teal-400 transition-colors disabled:opacity-50"
                >
                    Adauga Alocare
                </button>
            </div>

            {/* Tabel Alocari */}
            <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                    <thead className="bg-white/5 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        <tr>
                            <th className="px-4 py-3">Persoana</th>
                            <th className="px-4 py-3">Rol</th>
                            <th className="px-4 py-3">Interval Planificat</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {items.map(x => (
                            <tr key={x.id} className="hover:bg-white/5">
                                <td className="px-4 py-3 text-zinc-100 font-medium">{x.personName}</td>
                                <td className="px-4 py-3"><span className="text-xs bg-zinc-800 px-2 py-1 rounded-md text-zinc-400">{x.roleName}</span></td>
                                <td className="px-4 py-3 text-zinc-400 text-xs">
                                    {new Date(x.plannedFrom).toLocaleDateString()} | {new Date(x.plannedFrom).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(x.plannedTo).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => onDelete(x.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                                        Sterge
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!items.length && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 italic">Nu exista alocari pentru acest ordin.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}