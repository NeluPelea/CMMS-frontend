// src/components/WoAssignmentsPanel.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    createWoAssignment,
    updateWoAssignment,
    deleteWoAssignment,
    getWoAssignments,
    getPeopleSimple,
    getRoles,
    type AssignmentDto,
    type PersonSimpleDto,
    type RoleDto,
} from "../api";

import { Button, ErrorBox, Input, Select } from "./ui";

// ---------------- Helpers ----------------

function toLocalInputValue(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
        d.getMinutes()
    )}`;
}

function localInputToIso(v: string): string | null {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isGuidLike(s: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((s ?? "").trim());
}

function roleSort(a: RoleDto, b: RoleDto) {
    const ao = a.sortOrder ?? 0;
    const bo = b.sortOrder ?? 0;
    if (ao !== bo) return ao - bo;
    return (a.name ?? "").localeCompare(b.name ?? "");
}

function safeErrorMessage(e: unknown, fallback: string) {
    if (e instanceof Error) return e.message || fallback;
    if (typeof e === "string") return e || fallback;
    return fallback;
}

// ---------------- Component ----------------

export default function WoAssignmentsPanel(props: { workOrderId: string }) {
    const workOrderId = props.workOrderId;

    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
    const [people, setPeople] = useState<PersonSimpleDto[]>([]);
    const [roles, setRoles] = useState<RoleDto[]>([]);

    // UI: add mode
    const [addOpen, setAddOpen] = useState(false);

    // add form
    const [q, setQ] = useState("");
    const [personId, setPersonId] = useState("");
    const [roleId, setRoleId] = useState("");
    const [plannedFrom, setPlannedFrom] = useState("");
    const [plannedTo, setPlannedTo] = useState("");
    const [notes, setNotes] = useState("");

    const resetAddForm = useCallback(() => {
        setQ("");
        setPersonId("");
        setRoleId("");
        setPlannedFrom("");
        setPlannedTo("");
        setNotes("");
    }, []);

    // Prevent state updates after unmount / rapid navigation
    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
        };
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setErr(null);

        try {
            const [a, p, r] = await Promise.all([
                getWoAssignments(workOrderId),
                getPeopleSimple({ take: 500, includeInactive: true }),
                getRoles({ take: 500, includeInactive: true }),
            ]);

            if (!aliveRef.current) return;

            setAssignments(Array.isArray(a) ? a : []);
            setPeople(Array.isArray(p) ? p : []);
            setRoles(
                (Array.isArray(r) ? r : [])
                    .filter((x) => x.isActive !== false)
                    .slice()
                    .sort(roleSort)
            );
        } catch (e: unknown) {
            if (!aliveRef.current) return;
            setErr(safeErrorMessage(e, "Eroare la incarcarea echipei"));
            setAssignments([]);
        } finally {
            if (!aliveRef.current) return;
            setLoading(false);
        }
    }, [workOrderId]);

    useEffect(() => {
        load();
    }, [load]);

    // prevent duplicates in ADD panel (one assignment per person)
    const assignedPersonIds = useMemo(() => {
        const s = new Set<string>();
        for (const a of assignments) s.add(a.personId);
        return s;
    }, [assignments]);

    const filteredPeopleForAdd = useMemo(() => {
        const term = q.trim().toLowerCase();
        const base = people.filter((p) => !assignedPersonIds.has(p.id));
        if (!term) return base.slice(0, 50);
        return base.filter((p) => (p.displayName || "").toLowerCase().includes(term)).slice(0, 50);
    }, [people, q, assignedPersonIds]);

    // Auto-select the first match when the search changes to give immediate feedback
    useEffect(() => {
        if (q.trim().length === 0) return;
        if (personId && filteredPeopleForAdd.some((p) => p.id === personId)) return; // already selected and valid
        if (filteredPeopleForAdd.length > 0) {
            setPersonId(filteredPeopleForAdd[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, filteredPeopleForAdd]);

    const canAdd = useMemo(() => {
        if (!personId || !roleId) return false;
        if (!isGuidLike(personId) || !isGuidLike(roleId)) return false;

        const fromIso = localInputToIso(plannedFrom);
        const toIso = localInputToIso(plannedTo);
        if (!fromIso || !toIso) return false;
        if (new Date(fromIso) >= new Date(toIso)) return false;

        return !actionLoading;
    }, [personId, roleId, plannedFrom, plannedTo, actionLoading]);

    const onAdd = useCallback(async () => {
        if (!canAdd) return;

        const fromIso = localInputToIso(plannedFrom);
        const toIso = localInputToIso(plannedTo);
        if (!fromIso || !toIso) return;

        setActionLoading(true);
        setErr(null);
        try {
            await createWoAssignment(workOrderId, {
                personId,
                roleId,
                plannedFrom: fromIso,
                plannedTo: toIso,
                notes: notes.trim() ? notes.trim() : undefined,
            });

            resetAddForm();
            setAddOpen(false);
            await load();
        } catch (e: unknown) {
            setErr(safeErrorMessage(e, "Eroare la adaugare alocare"));
        } finally {
            setActionLoading(false);
        }
    }, [canAdd, workOrderId, personId, roleId, plannedFrom, plannedTo, notes, load, resetAddForm]);

    const onDelete = useCallback(
        async (row: AssignmentDto) => {
            setActionLoading(true);
            setErr(null);
            try {
                await deleteWoAssignment(workOrderId, row.id);
                await load();
            } catch (e: unknown) {
                setErr(safeErrorMessage(e, "Eroare la stergere alocare"));
            } finally {
                setActionLoading(false);
            }
        },
        [workOrderId, load]
    );

    // Single helper that performs PUT update
    const updateRow = useCallback(
        async (row: AssignmentDto, patch: Partial<Pick<AssignmentDto, "personId" | "roleId" | "plannedFrom" | "plannedTo" | "notes">>) => {
            const nextPersonId = patch.personId ?? row.personId;
            const nextRoleId = patch.roleId ?? row.roleId;
            const nextFromIso = patch.plannedFrom ?? row.plannedFrom;
            const nextToIso = patch.plannedTo ?? row.plannedTo;
            const nextNotes = patch.notes ?? row.notes ?? undefined;

            if (!isGuidLike(nextPersonId) || !isGuidLike(nextRoleId)) return;
            if (!nextFromIso || !nextToIso) return;
            if (new Date(nextFromIso) >= new Date(nextToIso)) {
                setErr("Interval invalid: Data stop trebuie sa fie dupa data start.");
                return;
            }

            setActionLoading(true);
            setErr(null);
            try {
                await updateWoAssignment(workOrderId, row.id, {
                    personId: nextPersonId,
                    roleId: nextRoleId,
                    plannedFrom: nextFromIso,
                    plannedTo: nextToIso,
                    notes: typeof nextNotes === "string" && nextNotes.trim() ? nextNotes.trim() : undefined,
                });
                await load();
            } catch (e: unknown) {
                setErr(safeErrorMessage(e, "Eroare la modificare alocare"));
                await load();
            } finally {
                setActionLoading(false);
            }
        },
        [workOrderId, load]
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" disabled={loading || actionLoading} onClick={load}>
                    Actualizeaza
                </Button>
                <Button
                    variant="primary"
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => setAddOpen((v) => !v)}
                >
                    + Adauga Membru
                </Button>
            </div>

            {err ? <ErrorBox message={err} onClose={() => setErr(null)} /> : null}

            {addOpen ? (
                <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="grid gap-3 lg:grid-cols-12">
                        <div className="lg:col-span-4">
                            <Input label="Cauta angajat" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Scrie un nume..." />
                        </div>

                        <div className="lg:col-span-4">
                            <Select label="Angajat" value={personId} onChange={(e) => setPersonId(e.target.value)}>
                                <option value="">(Selecteaza)</option>
                                {filteredPeopleForAdd.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.displayName}
                                    </option>
                                ))}
                            </Select>
                            <div className="mt-1 text-xs text-zinc-500">
                                {filteredPeopleForAdd.length === 50 ? "Se afiseaza primele 50 rezultate" : null}
                            </div>
                        </div>

                        <div className="lg:col-span-4">
                            <Select label="Rol" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                                <option value="">(Selecteaza rol)</option>
                                {roles.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className="lg:col-span-3">
                            <Input type="datetime-local" label="Planificat de la" value={plannedFrom} onChange={(e) => setPlannedFrom(e.target.value)} />
                        </div>
                        <div className="lg:col-span-3">
                            <Input type="datetime-local" label="Planificat pana la" value={plannedTo} onChange={(e) => setPlannedTo(e.target.value)} />
                        </div>

                        <div className="lg:col-span-4">
                            <Input label="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>

                        <div className="lg:col-span-2 flex items-end gap-2">
                            <Button
                                variant="ghost"
                                disabled={actionLoading}
                                onClick={() => {
                                    resetAddForm();
                                    setAddOpen(false);
                                }}
                            >
                                Anuleaza
                            </Button>
                            <Button variant="primary" disabled={!canAdd} onClick={onAdd}>
                                Adauga
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

            {loading ? (
                <div className="text-sm text-zinc-400">Incarcare...</div>
            ) : assignments.length === 0 ? (
                <div className="text-sm text-zinc-500 italic py-8 text-center border border-dashed border-white/10 rounded-xl">
                    Nu exista membri in echipa. Adauga pe cineva folosind butonul "+ Adauga Membru".
                </div>
            ) : (
                <div className="space-y-2">
                    {assignments.map((a) => {
                        // key for resetting uncontrolled inputs after refresh
                        const fromKey = `${a.id}:${a.plannedFrom}`;
                        const toKey = `${a.id}:${a.plannedTo}`;
                        const notesKey = `${a.id}:${a.notes ?? ""}`;

                        return (
                            <div key={a.id} className="rounded-2xl border border-white/10 bg-zinc-950/30 p-3">
                                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-zinc-100">{a.personName}</div>
                                        <div className="text-xs text-zinc-500">
                                            {toLocalInputValue(a.plannedFrom)} → {toLocalInputValue(a.plannedTo)}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {/* Change person (edit echipa) */}
                                        <Select
                                            value={a.personId}
                                            onChange={(e) => updateRow(a, { personId: e.target.value })}
                                            disabled={actionLoading}
                                            className="min-w-[220px]"
                                        >
                                            {people.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.displayName}
                                                </option>
                                            ))}
                                        </Select>

                                        {/* Change role */}
                                        <Select
                                            value={a.roleId}
                                            onChange={(e) => updateRow(a, { roleId: e.target.value })}
                                            disabled={actionLoading}
                                            className="min-w-[220px]"
                                        >
                                            {roles.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name}
                                                </option>
                                            ))}
                                        </Select>

                                        {/* plannedFrom */}
                                        <Input
                                            key={fromKey}
                                            type="datetime-local"
                                            defaultValue={toLocalInputValue(a.plannedFrom)}
                                            disabled={actionLoading}
                                            className="w-[190px]"
                                            onBlur={(e) => {
                                                const fromIso = localInputToIso(e.currentTarget.value);
                                                if (fromIso) updateRow(a, { plannedFrom: fromIso });
                                            }}
                                        />

                                        {/* plannedTo */}
                                        <Input
                                            key={toKey}
                                            type="datetime-local"
                                            defaultValue={toLocalInputValue(a.plannedTo)}
                                            disabled={actionLoading}
                                            className="w-[190px]"
                                            onBlur={(e) => {
                                                const toIso = localInputToIso(e.currentTarget.value);
                                                if (toIso) updateRow(a, { plannedTo: toIso });
                                            }}
                                        />

                                        {/* Notes */}
                                        <Input
                                            key={notesKey}
                                            defaultValue={a.notes ?? ""}
                                            disabled={actionLoading}
                                            className="min-w-[220px]"
                                            placeholder="Note"
                                            onBlur={(e) => {
                                                const next = e.currentTarget.value;
                                                updateRow(a, { notes: next });
                                            }}
                                        />

                                        <Button variant="ghost" size="sm" disabled={actionLoading} onClick={() => onDelete(a)}>
                                            Sterge
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
