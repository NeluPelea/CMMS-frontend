// src/pages/PeoplePage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import {
    activatePerson,
    createPerson,
    deactivatePerson,
    getPeoplePaged,
    getPersonDetails,
    updatePerson,
    updatePersonSchedule,
    type PersonDto,
} from "../api";
import { Button, Card, EmptyRow, ErrorBox, Input, PageToolbar, Pill, Select, TableShell, IconButton } from "../components/ui";

// ---------------- Utils ----------------

function FieldLabel(props: { children: React.ReactNode }) {
    return <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{props.children}</div>;
}

function normStr(x: string): string {
    return (x ?? "").trim();
}

function errMsg(e: unknown, fallback: string): string {
    if (typeof e === "object" && e !== null) {
        const r = e as Record<string, unknown>;
        const m = r["message"];
        if (typeof m === "string" && m.trim()) return m;
    }
    return fallback;
}

// ---- Schedule helpers (minute <-> "HH:mm") ----
function pad2(n: number) {
    return String(n).padStart(2, "0");
}
function minutesToTime(mins: number) {
    const safe = Number.isFinite(mins) ? mins : 0;
    const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(safe)));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${pad2(h)}:${pad2(m)}`;
}
function timeToMinutes(v: string): number | null {
    const s = (v || "").trim();
    if (!s) return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
}

type SchedulePerson = { id: string; name: string };

type ScheduleForm = {
    mfStart: string;
    mfEnd: string;
    satStart: string;
    satEnd: string;
    sunStart: string;
    sunEnd: string;
    tz: string;
};

const DEFAULT_TZ = "Europe/Bucharest";

function makeDefaultScheduleForm(): ScheduleForm {
    return {
        mfStart: "08:00",
        mfEnd: "16:30",
        satStart: "",
        satEnd: "",
        sunStart: "",
        sunEnd: "",
        tz: DEFAULT_TZ,
    };
}

// ---------------- Component ----------------

export default function PeoplePage() {
    // List state
    const [items, setItems] = useState<PersonDto[]>([]);
    const [total, setTotal] = useState(0);
    const [take, setTake] = useState(50);
    const [skip, setSkip] = useState(0);

    const [q, setQ] = useState("");
    const [includeInactive, setIncludeInactive] = useState(false);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Create/Edit form state
    const [fullName, setFullName] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [specialization, setSpecialization] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    const canCreate = useMemo(() => normStr(fullName).length >= 3, [fullName]);

    // Prevent stale updates when multiple loads overlap
    const loadSeq = useRef(0);

    const load = useCallback(async () => {
        const seq = ++loadSeq.current;

        setLoading(true);
        setErr(null);
        try {
            const page = await getPeoplePaged({
                take,
                skip,
                q: normStr(q) || undefined,
                includeInactive,
            });

            if (seq !== loadSeq.current) return;

            setItems(Array.isArray(page?.items) ? page.items : []);
            setTotal(page?.total ?? 0);
        } catch (e: unknown) {
            if (seq !== loadSeq.current) return;
            console.error("Load people error:", e);
            setErr("Nu s-a putut incarca lista de persoane. Verificati conexiunea cu API-ul.");
            setItems([]);
            setTotal(0);
        } finally {
            if (seq === loadSeq.current) setLoading(false);
        }
    }, [take, skip, q, includeInactive]);

    useEffect(() => {
        load();
    }, [load]);

    // Debounced search
    useEffect(() => {
        const t = window.setTimeout(() => {
            setSkip(0);
            load();
        }, 300);
        return () => window.clearTimeout(t);
    }, [q, load]);

    const resetForm = useCallback(() => {
        setFullName("");
        setJobTitle("");
        setSpecialization("");
        setPhone("");
        setEmail("");
        setEditingId(null);
    }, []);

    const startEdit = useCallback((p: PersonDto) => {
        setEditingId(p.id);
        setFullName(p.fullName || "");
        setJobTitle(p.jobTitle || "");
        setSpecialization(p.specialization || "");
        setPhone(p.phone || "");
        setEmail(p.email || "");
    }, []);

    const cancelEdit = useCallback(() => {
        resetForm();
    }, [resetForm]);

    const handleSave = useCallback(
        async (id: string) => {
            setErr(null);
            try {
                const fn = normStr(fullName);
                await updatePerson(id, {
                    fullName: fn,
                    displayName: fn,
                    jobTitle: normStr(jobTitle),
                    specialization: normStr(specialization),
                    phone: normStr(phone),
                    email: normStr(email) || null,
                    isActive: true,
                });

                resetForm();
                await load();
            } catch (e: unknown) {
                setErr(errMsg(e, "Eroare la salvarea persoanei."));
            }
        },
        [email, fullName, jobTitle, load, phone, resetForm, specialization]
    );

    const onSubmit = useCallback(async () => {
        if (!canCreate) return;
        setErr(null);

        try {
            if (editingId) {
                await handleSave(editingId);
                return;
            }

            await createPerson({
                fullName: normStr(fullName),
                jobTitle: normStr(jobTitle),
                specialization: normStr(specialization),
                phone: normStr(phone),
                email: normStr(email) || null,
                isActive: true,
            });

            resetForm();
            setSkip(0);
            await load();
        } catch (e: unknown) {
            setErr(errMsg(e, "Eroare la salvarea datelor."));
        }
    }, [canCreate, editingId, email, fullName, handleSave, jobTitle, load, phone, resetForm, specialization]);

    const handleDeactivate = useCallback(
        async (id: string) => {
            if (!confirm("Sigur dezactivezi (soft) persoana?")) return;
            setErr(null);

            try {
                await deactivatePerson(id);
                if (editingId === id) resetForm();
                await load();
            } catch (e: unknown) {
                setErr(errMsg(e, "Eroare la dezactivarea persoanei."));
            }
        },
        [editingId, load, resetForm]
    );

    const handleActivate = useCallback(
        async (id: string) => {
            if (!confirm("Sigur reactivezi persoana?")) return;
            setErr(null);

            try {
                await activatePerson(id);
                await load();
            } catch (e: unknown) {
                setErr(errMsg(e, "Eroare la reactivarea persoanei."));
            }
        },
        [load]
    );

    // ---------------- Schedule modal state ----------------

    const [schedOpen, setSchedOpen] = useState(false);
    const [schedLoading, setSchedLoading] = useState(false);
    const [schedErr, setSchedErr] = useState<string | null>(null);
    const [schedPerson, setSchedPerson] = useState<SchedulePerson | null>(null);
    const [schedForm, setSchedForm] = useState<ScheduleForm>(makeDefaultScheduleForm);

    const openSchedule = useCallback(async (p: PersonDto) => {
        setSchedOpen(true);
        setSchedLoading(true);
        setSchedErr(null);

        const name = normStr(p.fullName) || normStr(p.displayName) || "Persoana";
        setSchedPerson({ id: p.id, name });

        try {
            const d = await getPersonDetails(p.id);
            const s = d.schedule;

            setSchedForm({
                mfStart: minutesToTime(s?.monFriStartMinutes ?? 8 * 60),
                mfEnd: minutesToTime(s?.monFriEndMinutes ?? (16 * 60 + 30)),
                satStart: s?.satStartMinutes == null ? "" : minutesToTime(s.satStartMinutes),
                satEnd: s?.satEndMinutes == null ? "" : minutesToTime(s.satEndMinutes),
                sunStart: s?.sunStartMinutes == null ? "" : minutesToTime(s.sunStartMinutes),
                sunEnd: s?.sunEndMinutes == null ? "" : minutesToTime(s.sunEndMinutes),
                tz: normStr(s?.timezone || "") || DEFAULT_TZ,
            });
        } catch (e: unknown) {
            setSchedErr(errMsg(e, "Nu s-a putut incarca programul."));
        } finally {
            setSchedLoading(false);
        }
    }, []);

    const closeSchedule = useCallback(() => {
        setSchedOpen(false);
        setSchedLoading(false);
        setSchedErr(null);
        setSchedPerson(null);
        setSchedForm(makeDefaultScheduleForm());
    }, []);

    const setSched = useCallback(<K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) => {
        setSchedForm((prev) => ({ ...prev, [key]: value }));
    }, []);

    const validateSchedule = useCallback(
        (
            f: ScheduleForm
        ):
            | { ok: true; payload: Parameters<typeof updatePersonSchedule>[1] }
            | { ok: false; msg: string } => {
            const mfS = timeToMinutes(f.mfStart);
            const mfE = timeToMinutes(f.mfEnd);
            if (mfS == null || mfE == null) return { ok: false, msg: "Mon-Fri: ora invalida." };
            if (mfE <= mfS) return { ok: false, msg: "Mon-Fri: ora de stop trebuie sa fie dupa ora de start." };

            const satS = timeToMinutes(f.satStart);
            const satE = timeToMinutes(f.satEnd);
            if ((satS == null) !== (satE == null)) return { ok: false, msg: "Sambata: completeaza ambele ore sau lasa ambele goale." };
            if (satS != null && satE != null && satE <= satS) return { ok: false, msg: "Sambata: ora de stop trebuie sa fie dupa ora de start." };

            const sunS = timeToMinutes(f.sunStart);
            const sunE = timeToMinutes(f.sunEnd);
            if ((sunS == null) !== (sunE == null)) return { ok: false, msg: "Duminica: completeaza ambele ore sau lasa ambele goale." };
            if (sunS != null && sunE != null && sunE <= sunS) return { ok: false, msg: "Duminica: ora de stop trebuie sa fie dupa ora de start." };

            return {
                ok: true,
                payload: {
                    monFriStartMinutes: mfS,
                    monFriEndMinutes: mfE,
                    satStartMinutes: satS,
                    satEndMinutes: satE,
                    sunStartMinutes: sunS,
                    sunEndMinutes: sunE,
                    timezone: normStr(f.tz) || DEFAULT_TZ,
                },
            };
        },
        []
    );

    const saveSchedule = useCallback(async () => {
        if (!schedPerson) return;

        setSchedErr(null);

        const v = validateSchedule(schedForm);
        if (!v.ok) {
            setSchedErr(v.msg);
            return;
        }

        setSchedLoading(true);
        try {
            await updatePersonSchedule(schedPerson.id, v.payload);
            await load(); // refresh lista -> vezi imediat summary/badge
            closeSchedule();
        } catch (e: unknown) {
            setSchedErr(errMsg(e, "Eroare la salvarea programului."));
        } finally {
            setSchedLoading(false);
        }
    }, [closeSchedule, load, schedForm, schedPerson, validateSchedule]);

    // ---------------- UI ----------------

    const pageFrom = total === 0 ? 0 : skip + 1;
    const pageTo = Math.min(skip + take, total);

    return (
        <AppShell title="Angajati">
            <PageToolbar
                left={
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-200">Echipa / Angajati</div>
                        <div className="mt-0.5 text-xs text-zinc-500">{total ? `${pageFrom}-${pageTo} din ${total}` : "—"}</div>
                    </div>
                }
                right={
                    <div className="flex items-center gap-2">
                        <Button onClick={load} disabled={loading} variant="ghost">
                            Refresh
                        </Button>
                    </div>
                }
            />

            {err ? <ErrorBox message={err} /> : null}

            <Card title={editingId ? "Editare persoana" : "Adauga persoana noua"}>
                <div className="grid gap-3 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                        <FieldLabel>Nume complet</FieldLabel>
                        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex: Popescu Ion" />
                    </div>

                    <div className="lg:col-span-3">
                        <FieldLabel>Functie</FieldLabel>
                        <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Ex: Electrician" />
                    </div>

                    <div className="lg:col-span-3">
                        <FieldLabel>Specializare</FieldLabel>
                        <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Ex: Mentenanta" />
                    </div>

                    <div className="lg:col-span-2">
                        <FieldLabel>Telefon</FieldLabel>
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx..." />
                    </div>

                    <div className="lg:col-span-4">
                        <FieldLabel>Email</FieldLabel>
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
                    </div>

                    <div className="lg:col-span-8 flex items-end justify-end gap-2">
                        {editingId ? (
                            <>
                                <Button variant="ghost" onClick={cancelEdit}>
                                    Cancel
                                </Button>
                                <Button variant="primary" onClick={onSubmit} disabled={loading}>
                                    Save
                                </Button>
                            </>
                        ) : (
                            <Button variant="primary" onClick={onSubmit} disabled={!canCreate || loading}>
                                Adauga
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            <Card className="mt-4" title="Lista angajati">
                <div className="grid gap-3 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cauta..." />
                    </div>

                    <div className="lg:col-span-3">
                        <Select value={includeInactive ? "1" : "0"} onChange={(e) => setIncludeInactive(e.target.value === "1")}>
                            <option value="0">Doar activi</option>
                            <option value="1">Include inactivi</option>
                        </Select>
                    </div>

                    <div className="lg:col-span-3">
                        <Select value={String(take)} onChange={(e) => setTake(Number(e.target.value))}>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </Select>
                    </div>

                    <div className="lg:col-span-2 flex items-end justify-end gap-2">
                        <Button variant="ghost" disabled={skip <= 0 || loading} onClick={() => setSkip((s) => Math.max(0, s - take))}>
                            Prev
                        </Button>
                        <Button variant="ghost" disabled={skip + take >= total || loading} onClick={() => setSkip((s) => s + take)}>
                            Next
                        </Button>
                    </div>
                </div>

                <div className="mt-4">
                    <TableShell minWidth={980}>
                        <table className="w-full border-collapse text-sm">
                            <thead className="bg-white/5 text-zinc-300">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold">Nume / ID</th>
                                    <th className="px-3 py-2 text-left font-semibold">Functie</th>
                                    <th className="px-3 py-2 text-left font-semibold">Spec.</th>
                                    <th className="px-3 py-2 text-left font-semibold">Contact</th>
                                    <th className="px-3 py-2 text-left font-semibold">Program</th>
                                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                                    <th className="px-3 py-2 text-right font-semibold">Actiuni</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-white/10">
                                {loading && items.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-8 text-center text-zinc-400">
                                            Se incarca datele...
                                        </td>
                                    </tr>
                                ) : null}

                                {items.map((p) => {
                                    const isEditing = editingId === p.id;

                                    return (
                                        <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-3 py-2 text-zinc-100">
                                                <div className="font-semibold">
                                                    {isEditing ? <Input value={fullName} onChange={(e) => setFullName(e.target.value)} /> : p.fullName}
                                                </div>
                                                <div className="text-[10px] uppercase tracking-tighter text-zinc-500 font-mono">ID: {p.id.substring(0, 8)}...</div>
                                            </td>

                                            <td className="px-3 py-2 text-zinc-200">
                                                {isEditing ? <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /> : p.jobTitle || "—"}
                                            </td>

                                            <td className="px-3 py-2 text-zinc-200">
                                                {isEditing ? (
                                                    <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
                                                ) : (
                                                    p.specialization || "—"
                                                )}
                                            </td>

                                            <td className="px-3 py-2 text-zinc-200">
                                                {isEditing ? (
                                                    <div>
                                                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                                                        <div className="mt-1">
                                                            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="text-xs">{p.phone || "—"}</div>
                                                        <div className="text-[11px] text-zinc-500">{p.email || ""}</div>
                                                    </>
                                                )}
                                            </td>

                                            <td className="px-3 py-2 text-zinc-200">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-xs leading-5">{p.scheduleSummary || "—"}</div>
                                                    <div>
                                                        <Pill tone={p.hasCustomSchedule ? "teal" : "zinc"}>{p.hasCustomSchedule ? "Setat" : "Default"}</Pill>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-3 py-2">
                                                <Pill tone={p.isActive ? "teal" : "zinc"}>{p.isActive ? "Activ" : "Inactiv"}</Pill>
                                            </td>

                                            <td className="px-3 py-2 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isEditing ? (
                                                        <>
                                                            <Button variant="ghost" onClick={cancelEdit}>
                                                                Cancel
                                                            </Button>
                                                            <Button variant="primary" onClick={() => handleSave(p.id)}>
                                                                Save
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button variant="ghost" onClick={() => openSchedule(p)}>
                                                                Program
                                                            </Button>
                                                            <Button variant="ghost" onClick={() => startEdit(p)}>
                                                                Modifica
                                                            </Button>

                                                            {p.isActive ? (
                                                                <IconButton aria-label="Deactivate" variant="danger" onClick={() => handleDeactivate(p.id)}>
                                                                    🗑️
                                                                </IconButton>
                                                            ) : (
                                                                <Button variant="ghost" onClick={() => handleActivate(p.id)}>
                                                                    Activeaza
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {!loading && items.length === 0 ? <EmptyRow colSpan={7} text="Nu a fost gasit niciun angajat." /> : null}
                            </tbody>
                        </table>
                    </TableShell>
                </div>
            </Card>

            {/* ---- Schedule Modal ---- */}
            {schedOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-zinc-100">Program: {schedPerson?.name}</div>
                                <div className="text-xs text-zinc-500">Se salveaza prin /api/people/{`{id}`}/schedule</div>
                            </div>
                            <Button variant="ghost" onClick={closeSchedule} disabled={schedLoading}>
                                Inchide
                            </Button>
                        </div>

                        {schedErr ? <ErrorBox message={schedErr} /> : null}

                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <FieldLabel>Luni-Vineri Start</FieldLabel>
                                <Input type="time" value={schedForm.mfStart} onChange={(e) => setSched("mfStart", e.target.value)} />
                            </div>
                            <div>
                                <FieldLabel>Luni-Vineri Stop</FieldLabel>
                                <Input type="time" value={schedForm.mfEnd} onChange={(e) => setSched("mfEnd", e.target.value)} />
                            </div>

                            <div>
                                <FieldLabel>Sambata Start (gol = liber)</FieldLabel>
                                <Input type="time" value={schedForm.satStart} onChange={(e) => setSched("satStart", e.target.value)} />
                            </div>
                            <div>
                                <FieldLabel>Sambata Stop</FieldLabel>
                                <Input type="time" value={schedForm.satEnd} onChange={(e) => setSched("satEnd", e.target.value)} />
                            </div>

                            <div>
                                <FieldLabel>Duminica Start (gol = liber)</FieldLabel>
                                <Input type="time" value={schedForm.sunStart} onChange={(e) => setSched("sunStart", e.target.value)} />
                            </div>
                            <div>
                                <FieldLabel>Duminica Stop</FieldLabel>
                                <Input type="time" value={schedForm.sunEnd} onChange={(e) => setSched("sunEnd", e.target.value)} />
                            </div>

                            <div className="md:col-span-2">
                                <FieldLabel>Timezone</FieldLabel>
                                <Input value={schedForm.tz} onChange={(e) => setSched("tz", e.target.value)} placeholder={DEFAULT_TZ} />
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-2">
                            <Button variant="ghost" onClick={closeSchedule} disabled={schedLoading}>
                                Cancel
                            </Button>
                            <Button variant="primary" onClick={saveSchedule} disabled={schedLoading || !schedPerson}>
                                {schedLoading ? "Salvare..." : "Salveaza"}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </AppShell>
    );
}
