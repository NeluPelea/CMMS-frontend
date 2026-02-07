// src/pages/PeoplePage.tsx
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { createPerson, getPeoplePaged, updatePerson, type PersonDto } from "../api";
import {
    Button,
    Card,
    EmptyRow,
    ErrorBox,
    Input,
    PageToolbar,
    Pill,
    Select,
    TableShell,
    IconButton,
} from "../components/ui";

function FieldLabel(props: { children: React.ReactNode }) {
    return (
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {props.children}
        </div>
    );
}

export default function PeoplePage() {
    const [items, setItems] = useState<PersonDto[]>([]);
    const [total, setTotal] = useState(0);
    const [take, setTake] = useState(50);
    const [skip, setSkip] = useState(0);

    const [q, setQ] = useState("");
    const [includeInactive, setIncludeInactive] = useState(false);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // create form state
    const [fullName, setFullName] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [specialization, setSpecialization] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    // edit state
    const [editingId, setEditingId] = useState<string | null>(null);

    const canCreate = useMemo(() => fullName.trim().length >= 3, [fullName]);

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const page = await getPeoplePaged({
                take,
                skip,
                q: q.trim() || undefined,
                includeInactive,
            });
            // Siguranță: ne asigurăm că items este mereu un array
            setItems(page && Array.isArray(page.items) ? page.items : []);
            setTotal(page?.total ?? 0);
        } catch (e: any) {
            console.error("Load people error:", e);
            setErr("Nu s-a putut încărca lista de persoane. Verificați conexiunea cu API-ul.");
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [take, skip, includeInactive]);

    // Debounce pentru căutare (previne apelurile prea dese la API)
    useEffect(() => {
        const t = window.setTimeout(() => {
            setSkip(0);
            load();
        }, 300);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    async function onSubmit() {
        if (!canCreate) return;
        setErr(null);
        try {
            if (editingId) {
                await handleSave(editingId);
                return;
            }

            await createPerson({
                fullName: fullName.trim(),
                jobTitle: jobTitle.trim() || "",
                specialization: specialization.trim() || "",
                phone: phone.trim() || "",
                email: email.trim() || null,
                isActive: true,
            });

            // Resetare formular
            setFullName("");
            setJobTitle("");
            setSpecialization("");
            setPhone("");
            setEmail("");

            setSkip(0);
            await load();
        } catch (e: any) {
            setErr(e?.message || "Eroare la salvarea datelor.");
        }
    }

    function startEdit(p: PersonDto) {
        setEditingId(p.id);
        setFullName(p.fullName || "");
        setJobTitle(p.jobTitle || "");
        setSpecialization(p.specialization || "");
        setPhone(p.phone || "");
        setEmail(p.email || "");
    }

    function cancelEdit() {
        setEditingId(null);
        setFullName("");
        setJobTitle("");
        setSpecialization("");
        setPhone("");
        setEmail("");
    }

    async function handleSave(id: string) {
        setErr(null);
        try {
            await updatePerson(id, {
                fullName: fullName.trim(),
                displayName: fullName.trim(),
                jobTitle: jobTitle.trim(),
                specialization: specialization.trim(),
                phone: phone.trim(),
                email: email.trim() || null,
                isActive: true,
            });

            cancelEdit();
            await load();
        } catch (e: any) {
            setErr(e?.message || "Eroare la salvarea persoanei.");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Sigur ștergi (soft) persoana?")) return;
        setErr(null);
        try {
            await updatePerson(id, {
                fullName: fullName.trim() || "",
                displayName: fullName.trim() || "",
                jobTitle: jobTitle.trim() || "",
                specialization: specialization.trim() || "",
                phone: phone.trim() || "",
                email: email.trim() || null,
                isActive: false,
            });
            // If deleting the currently edited person, cancel edit
            if (editingId === id) cancelEdit();
            await load();
        } catch (e: any) {
            setErr(e?.message || "Eroare la ștergerea persoanei.");
        }
    }

    // status toggle handled via Delete (soft-delete) button

    const pageFrom = skip + 1;
    const pageTo = Math.min(skip + take, total);

    return (
        <AppShell title="Personal">
            <PageToolbar
                left={
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-200">Echipă / Personal</div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                            {total ? `${pageFrom}-${pageTo} din ${total}` : "—"}
                        </div>
                    </div>
                }
                right={
                    <div className="flex items-center gap-2">
                        <Button onClick={() => load()} disabled={loading} variant="ghost">
                            Refresh
                        </Button>
                    </div>
                }
            />

            {err ? <ErrorBox message={err} /> : null}

            <Card title="Adaugă persoană nouă">
                <div className="grid gap-3 lg:grid-cols-12">
                    <div className="lg:col-span-4">
                        <FieldLabel>Nume Complet</FieldLabel>
                        <Input
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Ex: Ion Popescu"
                        />
                    </div>

                    <div className="lg:col-span-3">
                        <FieldLabel>Funcție / Job</FieldLabel>
                        <Input
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            placeholder="Ex: Mecanic"
                        />
                    </div>

                    <div className="lg:col-span-3">
                        <FieldLabel>Specializare</FieldLabel>
                        <Input
                            value={specialization}
                            onChange={(e) => setSpecialization(e.target.value)}
                            placeholder="Ex: Hidraulică"
                        />
                    </div>

                    <div className="lg:col-span-2">
                        <FieldLabel>Telefon</FieldLabel>
                        <Input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="07xx..."
                        />
                    </div>

                    <div className="lg:col-span-4">
                        <FieldLabel>Email</FieldLabel>
                        <Input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ion@companie.ro"
                        />
                    </div>

                    <div className="lg:col-span-8 flex items-end justify-end gap-2">
                        {editingId ? (
                            <>
                                <Button variant="ghost" onClick={cancelEdit} disabled={loading}>Cancel</Button>
                                <Button onClick={onSubmit} disabled={!canCreate || loading} variant="primary">
                                    {loading ? "Se salvează..." : "Salvează"}
                                </Button>
                            </>
                        ) : (
                            <Button onClick={onSubmit} disabled={!canCreate || loading} variant="primary">
                                {loading ? "Se creează..." : "Adaugă Persoană"}
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            <div className="mt-6" />

            <Card title="Lista Personal">
                <div className="grid gap-3 lg:grid-cols-12">
                    <div className="lg:col-span-5">
                        <FieldLabel>Căutare rapidă</FieldLabel>
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Caută după nume, funcție, telefon..."
                        />
                    </div>

                    <div className="lg:col-span-3">
                        <FieldLabel>Stare Angajați</FieldLabel>
                        <Select
                            value={includeInactive ? "1" : "0"}
                            onChange={(e) => {
                                setSkip(0);
                                setIncludeInactive(e.target.value === "1");
                            }}
                        >
                            <option value="0">Doar Activi</option>
                            <option value="1">Toți (Inclusiv Inactivi)</option>
                        </Select>
                    </div>

                    <div className="lg:col-span-2">
                        <FieldLabel>Rânduri pe pagină</FieldLabel>
                        <Select
                            value={String(take)}
                            onChange={(e) => {
                                setSkip(0);
                                setTake(Number(e.target.value));
                            }}
                        >
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </Select>
                    </div>

                    <div className="lg:col-span-2 flex items-end justify-end gap-2">
                        <Button
                            variant="ghost"
                            disabled={skip <= 0 || loading}
                            onClick={() => setSkip((s) => Math.max(0, s - take))}
                        >
                            Prev
                        </Button>
                        <Button
                            variant="ghost"
                            disabled={skip + take >= total || loading}
                            onClick={() => setSkip((s) => s + take)}
                        >
                            Next
                        </Button>
                    </div>
                </div>

                <div className="mt-4">
                    <TableShell minWidth={860}>
                        <table className="w-full border-collapse text-sm">
                            <thead className="bg-white/5 text-zinc-300">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold">Nume / ID</th>
                                    <th className="px-3 py-2 text-left font-semibold">Funcție</th>
                                    <th className="px-3 py-2 text-left font-semibold">Spec.</th>
                                    <th className="px-3 py-2 text-left font-semibold">Contact</th>
                                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                                    <th className="px-3 py-2 text-right font-semibold">Acțiuni</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-white/10">
                                {loading && items.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-8 text-center text-zinc-400">
                                            Se încarcă datele...
                                        </td>
                                    </tr>
                                ) : null}

                                {items.map((p) => {
                                    const isEditing = editingId === p.id;
                                    return (
                                        <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-3 py-2 text-zinc-100">
                                                <div className="font-semibold">
                                                    {isEditing ? (
                                                        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                                                    ) : (
                                                        p.fullName
                                                    )}
                                                </div>
                                                <div className="text-[10px] uppercase tracking-tighter text-zinc-500 font-mono">
                                                    ID: {p.id.substring(0, 8)}...
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-zinc-200">
                                                {isEditing ? (
                                                    <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                                                ) : (
                                                    p.jobTitle || "—"
                                                )}
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
                                            <td className="px-3 py-2">
                                                <Pill tone={p.isActive ? "teal" : "zinc"}>{p.isActive ? "Activ" : "Inactiv"}</Pill>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isEditing ? (
                                                        <>
                                                            <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                                                            <Button variant="primary" onClick={() => handleSave(p.id)}>Save</Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button variant="ghost" onClick={() => startEdit(p)}>Modifica</Button>
                                                            <IconButton aria-label="Delete" variant="danger" onClick={() => handleDelete(p.id)}>🗑️</IconButton>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {!loading && items.length === 0 ? (
                                    <EmptyRow colSpan={6} text="Nu a fost găsită nicio persoană." />
                                ) : null}
                            </tbody>
                        </table>
                    </TableShell>
                </div>
            </Card>
        </AppShell>
    );
}