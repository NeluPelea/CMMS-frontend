// src/pages/WorkOrdersPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    cancelWorkOrder,
    createWorkOrder,
    getAssets,
    getLocs,
    getPeople,
    getRoles,
    getWorkOrders,
    getWorkOrderCounts,
    reopenWorkOrder,
    startWorkOrder,
    stopWorkOrder,
    updateWorkOrder,

    // parts
    getWorkOrderParts,
    addWorkOrderPart,
    deleteWorkOrderPart,
    setWorkOrderPartQty,
    getParts,

    // assignments
    getWoAssignments,
    createWoAssignment,
    deleteWoAssignment,

    // labor
    getWorkOrderLaborLogs,
    addLaborLog,
    deleteLaborLog,

    type AssetDto,
    type LocDto,
    type PersonDto,
    type WorkOrderDto,
    type WorkOrderPartDto,
    type PartDto,
    type RoleDto,
    type AssignmentDto,
    type CreateAssignmentReq,
    type LaborLogDto,
    getTeams,
    type TeamDto,
    hasPerm,
} from "../api";

import { getWorkOrderDecoration, getResponsibleDisplayName } from "../domain/workOrderDecorations";
import { isoToLocalDisplay, isoToLocalInputValue, localInputToIso } from "../domain/datetime";
import { WorkOrderClassification, WorkOrderStatus, WorkOrderType, woStatusLabel } from "../domain/enums";
import AppShell from "../components/AppShell";
import { Button, Drawer, ErrorBox, Input, PageToolbar, Pill, PillButton, Select, Tabs, cx } from "../components/ui";

function safeArray<T>(x: unknown): T[] {
    return Array.isArray(x) ? (x as T[]) : [];
}

function StatusPill({ status }: { status: WorkOrderStatus }) {
    const label = woStatusLabel(status);
    let tone: "emerald" | "teal" | "rose" | "zinc" | "amber" = "zinc";
    if (status === WorkOrderStatus.Done) tone = "emerald";
    else if (status === WorkOrderStatus.InProgress) tone = "teal";
    else if (status === WorkOrderStatus.Cancelled) tone = "rose";
    else if (status === WorkOrderStatus.Open) tone = "amber";
    return <Pill tone={tone}>{label}</Pill>;
}

type TabKey = "details" | "activity" | "parts";
type SortKey = "newest" | "oldest";

// compat: unele DTO-uri au locId vs locationId
type AssetWithCompatLoc = AssetDto & { locId?: string; locationId?: string | null };
function assetLocationId(a: AssetDto): string {
    const x = a as AssetWithCompatLoc;
    return (x.locId ?? x.locationId ?? "") || "";
}

function toQtyString(n: number): string {
    return Number.isFinite(n) ? String(n) : "0";
}

export default function WorkOrdersPage() {
    // ---------------- Core list state ----------------
    const [items, setItems] = useState<WorkOrderDto[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // ---------------- Filters (server) ----------------
    const [q, setQ] = useState("");
    const [status, setStatus] = useState<WorkOrderStatus | "">("");
    const [type, setType] = useState<WorkOrderType | "">("");
    const [locId, setLocId] = useState<string>("");
    const [assetId, setAssetId] = useState<string>("");
    const take = 50;
    const [skip, setSkip] = useState(0);

    // ---------------- Left list (client UX) ----------------
    const [sort, setSort] = useState<SortKey>("newest");

    // ---------------- Aux lists ----------------
    const [locs, setLocs] = useState<LocDto[]>([]);
    const [assets, setAssets] = useState<AssetDto[]>([]);
    const [people, setPeople] = useState<PersonDto[]>([]);
    const [roles, setRoles] = useState<RoleDto[]>([]);
    const [partsCatalog, setPartsCatalog] = useState<PartDto[]>([]);
    const [teams, setTeams] = useState<TeamDto[]>([]);

    // ---------------- Counts ----------------
    const [counts, setCounts] = useState({
        all: 0,
        open: 0,
        inProgress: 0,
        done: 0,
        cancelled: 0,
    });

    // ---------------- UI state ----------------
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
    const [activeTab, setActiveTab] = useState<TabKey>("details");

    // ---------------- Selection & detail draft ----------------
    const [selId, setSelId] = useState<string>("");
    const selected = useMemo(() => items.find((x) => x.id === selId) || null, [items, selId]);

    const [dTitle, setDTitle] = useState("");
    const [dDesc, setDDesc] = useState("");
    const [dStatus, setDStatus] = useState<WorkOrderStatus>(WorkOrderStatus.Open);
    const [dClassification, setDClassification] = useState<WorkOrderClassification>(WorkOrderClassification.Reactive);
    const [dAssetId, setDAssetId] = useState<string>("");
    const [dAssignedId, setDAssignedId] = useState<string>("");
    const [dStartAt, setDStartAt] = useState<string>("");
    const [dStopAt, setDStopAt] = useState<string>("");

    // ---------------- Create form ----------------
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newType, setNewType] = useState<WorkOrderType>(WorkOrderType.Corrective);
    const [newClassification, setNewClassification] = useState<WorkOrderClassification>(WorkOrderClassification.Reactive);
    const [newAssetId, setNewAssetId] = useState<string>("");
    const [newTeamId, setNewTeamId] = useState("");
    const [newCoordId, setNewCoordId] = useState("");

    const canCreate = useMemo(() => {
        if (newTitle.trim().length < 2) return false;
        if (actionLoading) return false;
        if (newTeamId && !newCoordId) return false;
        return true;
    }, [newTitle, actionLoading, newTeamId, newCoordId]);

    const isDirty = useMemo(() => {
        if (!selected) return false;
        if (dTitle.trim() !== (selected.title || "")) return true;
        if (dDesc.trim() !== (selected.description || "")) return true;
        if (dStatus !== selected.status) return true;
        if (dClassification !== (selected.classification || WorkOrderClassification.Reactive)) return true;
        if (dAssetId !== (selected.assetId || "")) return true;
        if (dAssignedId !== (selected.assignedToPersonId || "")) return true;
        if (isoToLocalInputValue(selected.startAt) !== dStartAt) return true;
        if (isoToLocalInputValue(selected.stopAt) !== dStopAt) return true;
        return false;
    }, [selected, dTitle, dDesc, dStatus, dClassification, dAssetId, dAssignedId, dStartAt, dStopAt]);

    const canSave = useMemo(() => dTitle.trim().length >= 2 && !!selected && !actionLoading && isDirty, [dTitle, selected, actionLoading, isDirty]);

    // ---------------- Parts (WO Parts) ----------------
    const [woParts, setWoParts] = useState<WorkOrderPartDto[]>([]);
    const [woPartsLoading, setWoPartsLoading] = useState(false);
    const [woPartsErr, setWoPartsErr] = useState<string | null>(null);
    const [partIdInput, setPartIdInput] = useState("");
    const [qtyInput, setQtyInput] = useState("1");

    const clearWoPartsUi = useCallback(() => {
        setWoParts([]);
        setWoPartsErr(null);
        setWoPartsLoading(false);
        setPartIdInput("");
        setQtyInput("1");
    }, []);

    const loadWoParts = useCallback(async (workOrderId: string) => {
        setWoPartsLoading(true);
        setWoPartsErr(null);
        try {
            const data = await getWorkOrderParts(workOrderId);
            setWoParts(safeArray<WorkOrderPartDto>(data));
        } catch (e) {
            const error = e as Error;
            setWoPartsErr(error.message || "Eroare la incarcarea pieselor");
            setWoParts([]);
        } finally {
            setWoPartsLoading(false);
        }
    }, []);

    // ---------------- Assignments (WO Team + Roles) ----------------
    const [assignments, setAssignments] = useState<AssignmentDto[]>([]);
    const [asgLoading, setAsgLoading] = useState(false);
    const [asgErr, setAsgErr] = useState<string | null>(null);

    const [asgPersonId, setAsgPersonId] = useState("");
    const [asgRoleId, setAsgRoleId] = useState("");
    const [asgFrom, setAsgFrom] = useState(""); // datetime-local
    const [asgTo, setAsgTo] = useState("");     // datetime-local
    const [asgNotes, setAsgNotes] = useState("");

    const clearAssignmentsUi = useCallback(() => {
        setAssignments([]);
        setAsgErr(null);
        setAsgLoading(false);
        setAsgPersonId("");
        setAsgRoleId("");
        setAsgFrom("");
        setAsgTo("");
        setAsgNotes("");
    }, []);

    const loadAssignments = useCallback(async (workOrderId: string) => {
        setAsgLoading(true);
        setAsgErr(null);
        try {
            const data = await getWoAssignments(workOrderId);
            setAssignments(safeArray<AssignmentDto>(data));
        } catch (e) {
            const error = e as Error;
            setAsgErr(error.message || "Eroare la incarcarea asignarilor");
            setAssignments([]);
        } finally {
            setAsgLoading(false);
        }
    }, []);

    const onCreateAssignment = useCallback(async () => {
        if (!selected) return;

        const personId = asgPersonId.trim();
        const roleId = asgRoleId.trim();
        const plannedFromIso = localInputToIso(asgFrom);
        const plannedToIso = localInputToIso(asgTo);

        if (!personId) return setAsgErr("Selecteaza o persoana.");
        if (!roleId) return setAsgErr("Selecteaza un rol.");
        if (!plannedFromIso || !plannedToIso) return setAsgErr("Completeaza plannedFrom si plannedTo.");
        if (plannedToIso < plannedFromIso) return setAsgErr("plannedTo trebuie sa fie dupa plannedFrom.");

        setActionLoading(true);
        setAsgErr(null);
        try {
            const req: CreateAssignmentReq = {
                personId,
                roleId,
                plannedFrom: plannedFromIso,
                plannedTo: plannedToIso,
                notes: asgNotes.trim() ? asgNotes.trim() : undefined,
            };
            await createWoAssignment(selected.id, req);
            setAsgPersonId("");
            setAsgRoleId("");
            setAsgFrom("");
            setAsgTo("");
            setAsgNotes("");
            await loadAssignments(selected.id);
        } catch (e) {
            const error = e as Error;
            setAsgErr(error.message || "Eroare la creare asignare");
        } finally {
            setActionLoading(false);
        }
    }, [selected, asgPersonId, asgRoleId, asgFrom, asgTo, asgNotes, loadAssignments]);

    const onDeleteAssignment = useCallback(async (row: AssignmentDto) => {
        if (!selected) return;
        setActionLoading(true);
        setAsgErr(null);
        try {
            await deleteWoAssignment(selected.id, row.id);
            await loadAssignments(selected.id);
        } catch (e) {
            const error = e as Error;
            setAsgErr(error.message || "Eroare la stergere asignare");
        } finally {
            setActionLoading(false);
        }
    }, [selected, loadAssignments]);

    // ---------------- Labor Logs ----------------
    const [labor, setLabor] = useState<LaborLogDto[]>([]);
    const [laborLoading, setLaborLoading] = useState(false);
    const [laborErr, setLaborErr] = useState<string | null>(null);

    const [laborPersonId, setLaborPersonId] = useState("");
    const [laborMinutes, setLaborMinutes] = useState("60");
    const [laborDesc, setLaborDesc] = useState("");

    const clearLaborUi = useCallback(() => {
        setLabor([]);
        setLaborErr(null);
        setLaborLoading(false);
        setLaborPersonId("");
        setLaborMinutes("60");
        setLaborDesc("");
    }, []);

    const loadLabor = useCallback(async (workOrderId: string) => {
        setLaborLoading(true);
        setLaborErr(null);
        try {
            const data = await getWorkOrderLaborLogs(workOrderId);
            setLabor(safeArray<LaborLogDto>(data));
        } catch (e) {
            const error = e as Error;
            setLaborErr(error.message || "Eroare la incarcarea pontajelor");
            setLabor([]);
        } finally {
            setLaborLoading(false);
        }
    }, []);

    const onAddLabor = useCallback(async () => {
        if (!selected) return;
        const personId = laborPersonId.trim();
        const minutes = Number(laborMinutes);

        if (!personId) return setLaborErr("Selecteaza o persoana.");
        if (!Number.isFinite(minutes) || minutes <= 0) return setLaborErr("Minutes trebuie sa fie > 0.");

        setActionLoading(true);
        setLaborErr(null);
        try {
            await addLaborLog(selected.id, {
                personId,
                minutes,
                description: laborDesc.trim() ? laborDesc.trim() : undefined,
            });
            setLaborPersonId("");
            setLaborMinutes("60");
            setLaborDesc("");
            await loadLabor(selected.id);
        } catch (e) {
            const error = e as Error;
            setLaborErr(error.message || "Eroare la adaugare pontaj");
        } finally {
            setActionLoading(false);
        }
    }, [selected, laborPersonId, laborMinutes, laborDesc, loadLabor]);

    const onDeleteLabor = useCallback(async (row: LaborLogDto) => {
        if (!selected) return;
        setActionLoading(true);
        setLaborErr(null);
        try {
            await deleteLaborLog(selected.id, row.id);
            await loadLabor(selected.id);
        } catch (e) {
            const error = e as Error;
            setLaborErr(error.message || "Eroare la stergere pontaj");
        } finally {
            setActionLoading(false);
        }
    }, [selected, loadLabor]);

    // ---------------- Aux + list loading ----------------
    const loadAux = useCallback(async () => {
        try {
            const [locData, assetData, peopleData, roleData, partsData, teamsData] = await Promise.all([
                getLocs({ take: 1000, ia: true }),
                getAssets({ take: 1000, ia: true }),
                getPeople(),
                getRoles(),
                getParts({ take: 1000, ia: true }),
                getTeams(),
            ]);
            setLocs(safeArray<LocDto>(locData));
            setAssets(safeArray<AssetDto>(assetData));
            setPeople(safeArray<PersonDto>(peopleData));
            setRoles(safeArray<RoleDto>(roleData).filter((r) => r.isActive).sort((a, b) => a.sortOrder - b.sortOrder));
            setPartsCatalog(safeArray<PartDto>(partsData));
            setTeams(safeArray<TeamDto>(teamsData));
        } catch (e) {
            // aux failure should not block page
            console.error("Aux data failed", e);
        }
    }, []);

    const loadList = useCallback(async (nextSkip?: number) => {
        const realSkip = typeof nextSkip === "number" ? nextSkip : skip;

        setLoading(true);
        setErr(null);
        try {
            const resp = await getWorkOrders({
                q: q.trim() || undefined,
                status: status === "" ? undefined : status,
                type: type === "" ? undefined : type,
                locId: locId || undefined,
                assetId: assetId || undefined,
                take,
                skip: realSkip,
            });

            const list = safeArray<WorkOrderDto>(resp?.items);
            setItems(list);
            setTotal(resp?.total ?? list.length);

            if (list.length > 0) {
                if (!selId) setSelId(list[0].id);
                else if (!list.some((x) => x.id === selId)) setSelId(list[0].id);
            } else {
                setSelId("");
            }
        } catch (e) {
            const error = e as Error;
            setErr(error.message || "Eroare la incarcarea listei");
        } finally {
            setLoading(false);
        }
    }, [q, status, type, locId, assetId, take, skip]);

    const loadCounts = useCallback(async () => {
        try {
            const c = await getWorkOrderCounts({
                q: q.trim() || undefined,
                type: type === "" ? undefined : type,
                locId: locId || undefined,
                assetId: assetId || undefined,
            });
            setCounts({
                all: c["All"] || 0,
                open: c["Open"] || 0,
                inProgress: c["InProgress"] || 0,
                done: c["Done"] || 0,
                cancelled: c["Cancelled"] || 0,
            });
        } catch (e) {
            console.error("Counts failed", e);
        }
    }, [q, type, locId, assetId]);

    // initial load
    useEffect(() => {
        loadAux();
        loadList(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // server filters (non-q)
    useEffect(() => {
        setSkip(0);
        loadList(0);
    }, [status, type, locId, assetId, loadList]);

    // Independent effect for counts on filter change
    useEffect(() => {
        loadCounts();
        // eslint-disable-next-line
    }, [type, locId, assetId]);

    // debounce q
    useEffect(() => {
        const t = window.setTimeout(() => {
            setSkip(0);
            loadList(0);
            loadCounts();
        }, 300);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    // sync draft when selection changes + clear tab data
    useEffect(() => {
        if (!selected) {
            setDTitle("");
            setDDesc("");
            setDStatus(WorkOrderStatus.Open);
            setDClassification(WorkOrderClassification.Reactive);
            setDAssetId("");
            setDAssignedId("");
            setDStartAt("");
            setDStopAt("");

            clearWoPartsUi();
            clearAssignmentsUi();
            clearLaborUi();
            return;
        }

        setDTitle(selected.title || "");
        setDDesc(selected.description || "");
        setDStatus(selected.status);
        setDClassification(selected.classification || WorkOrderClassification.Reactive);
        setDAssetId(selected.assetId ?? "");
        setDAssignedId(selected.assignedToPersonId ?? "");
        setDStartAt(isoToLocalInputValue(selected.startAt));
        setDStopAt(isoToLocalInputValue(selected.stopAt));

        clearWoPartsUi();
        clearAssignmentsUi();
        clearLaborUi();
    }, [selected, clearWoPartsUi, clearAssignmentsUi, clearLaborUi]);

    // lazy-load per tab
    useEffect(() => {
        if (!selected) return;
        if (activeTab === "parts") loadWoParts(selected.id);
        if (activeTab === "activity") {
            loadAssignments(selected.id);
            loadLabor(selected.id);
        }
    }, [activeTab, selected, loadWoParts, loadAssignments, loadLabor]);

    // ---------------- Actions: create/save/state machine ----------------
    const onCreate = useCallback(async () => {
        if (!canCreate) return;

        setActionLoading(true);
        setErr(null);
        try {
            const wo = await createWorkOrder({
                title: newTitle.trim(),
                description: newDesc.trim() ? newDesc.trim() : null,
                type: newType,
                classification: newClassification,
                assetId: newAssetId || null,
                assignedToPersonId: null,
                startAt: null,
                stopAt: null,
                teamId: newTeamId || null,
                coordinatorPersonId: newCoordId || null,
            });

            setNewTitle("");
            setNewDesc("");
            setNewAssetId("");
            setNewTeamId("");
            setNewCoordId("");

            await loadList(0);
            loadCounts();
            if (wo?.id) {
                setSelId(wo.id);
                setDrawerMode("edit");
            } else {
                setDrawerOpen(false);
            }
        } catch (e) {
            const error = e as Error;
            setErr(error.message || "Eroare la creare");
        } finally {
            setActionLoading(false);
        }
    }, [canCreate, newTitle, newDesc, newType, newAssetId, newClassification, newTeamId, newCoordId, loadList, loadCounts]);

    const onSave = useCallback(async () => {
        if (!selected || !canSave) return;

        setActionLoading(true);
        setErr(null);
        try {
            const updated = await updateWorkOrder(selected.id, {
                title: dTitle.trim(),
                description: dDesc.trim() ? dDesc.trim() : null,
                status: dStatus,
                classification: dClassification,
                assetId: dAssetId || null,
                assignedToPersonId: dAssignedId || null,
                startAt: localInputToIso(dStartAt) || null,
                stopAt: localInputToIso(dStopAt) || null,
            });

            setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            setDrawerOpen(false);
        } catch (e) {
            const error = e as Error;
            setErr(error.message || "Eroare la salvare");
        } finally {
            setActionLoading(false);
        }
    }, [selected, canSave, dTitle, dDesc, dStatus, dClassification, dAssetId, dAssignedId, dStartAt, dStopAt]);

    const handleCloseDrawer = useCallback(() => {
        if (drawerMode === "edit" && isDirty) {
            if (!window.confirm("Ai modificari nesalvate. Sigur inchizi?")) return;
        }
        setDrawerOpen(false);
    }, [drawerMode, isDirty]);

    const applyAction = useCallback(async (action: "start" | "stop" | "cancel" | "reopen") => {
        if (!selected || actionLoading) return;

        setActionLoading(true);
        setErr(null);

        try {
            let updated: WorkOrderDto;
            switch (action) {
                case "start":
                    updated = await startWorkOrder(selected.id);
                    break;
                case "stop":
                    updated = await stopWorkOrder(selected.id);
                    break;
                case "cancel":
                    updated = await cancelWorkOrder(selected.id);
                    break;
                case "reopen":
                    updated = await reopenWorkOrder(selected.id);
                    break;
                default:
                    return;
            }

            setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));

            if (activeTab === "parts") await loadWoParts(updated.id);
            if (activeTab === "activity") {
                await loadAssignments(updated.id);
                await loadLabor(updated.id);
            }
            loadCounts();
        } catch (e) {
            const error = e as Error;
            setErr(error.message || "Eroare la schimbarea starii");
        } finally {
            setActionLoading(false);
        }
    }, [selected, actionLoading, activeTab, loadWoParts, loadAssignments, loadLabor]);

    // ---------------- Parts actions ----------------
    const onAddPart = useCallback(async () => {
        if (!selected) return;

        const pid = partIdInput.trim();
        const qty = Number(qtyInput);

        if (!pid) return setWoPartsErr("Selecteaza o piesa.");
        if (!Number.isFinite(qty) || qty <= 0) return setWoPartsErr("Qty trebuie sa fie > 0.");

        setActionLoading(true);
        setWoPartsErr(null);
        try {
            await addWorkOrderPart(selected.id, pid, qty);
            setPartIdInput("");
            setQtyInput("1");
            await loadWoParts(selected.id);
        } catch (e) {
            const error = e as Error;
            setWoPartsErr(error.message || "Eroare la adaugare piesa");
        } finally {
            setActionLoading(false);
        }
    }, [selected, partIdInput, qtyInput, loadWoParts]);

    const onDeletePart = useCallback(async (row: WorkOrderPartDto) => {
        if (!selected) return;

        setActionLoading(true);
        setWoPartsErr(null);
        try {
            await deleteWorkOrderPart(selected.id, row.id);
            await loadWoParts(selected.id);
        } catch (e) {
            const error = e as Error;
            setWoPartsErr(error.message || "Eroare la stergere piesa");
        } finally {
            setActionLoading(false);
        }
    }, [selected, loadWoParts]);

    const onSetPartQty = useCallback(async (row: WorkOrderPartDto, nextQty: number) => {
        if (!selected) return;
        if (!Number.isFinite(nextQty) || nextQty <= 0) return;

        setActionLoading(true);
        setWoPartsErr(null);
        try {
            await setWorkOrderPartQty(selected.id, row.id, nextQty);
            await loadWoParts(selected.id);
        } catch (e) {
            const error = e as Error;
            setWoPartsErr(error.message || "Eroare la modificare cantitate");
        } finally {
            setActionLoading(false);
        }
    }, [selected, loadWoParts]);

    // ---------------- Derived data ----------------
    const filteredAssets = useMemo(() => {
        if (!locId) return assets;
        return assets.filter((a) => assetLocationId(a) === locId);
    }, [assets, locId]);

    const viewItems = useMemo(() => {
        const arr = [...items];
        const key = (w: WorkOrderDto) => w.startAt ?? "";
        arr.sort((a, b) => {
            const cmp = key(a).localeCompare(key(b));
            if (cmp !== 0) return sort === "newest" ? -cmp : cmp;
            return sort === "newest" ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
        });
        return arr;


    }, [items, sort]);

    // Counts removed from here, now in state

    const pageInfo = `${total === 0 ? 0 : skip + 1}-${Math.min(skip + take, total)} of ${total}`;

    // ---------- Activity helpers ----------
    const peopleForAssignment = people; // poti filtra isActive daca ai campul
    const rolesForAssignment = roles;

    // ---------------- Render ----------------
    return (
        <AppShell title="Ordine de Lucru">
            <PageToolbar
                left={
                    <div className="flex items-center gap-2">
                        {hasPerm("WO_CREATE") && (
                            <Button
                                variant="primary"
                                onClick={() => {
                                    setDrawerMode("create");
                                    setDrawerOpen(true);
                                }}
                            >
                                + Nou
                            </Button>
                        )}
                        <Button onClick={() => loadList(0)} variant="ghost" disabled={loading}>
                            Actualizeaza
                        </Button>
                    </div>
                }
                right={
                    <div className="flex items-center gap-2">
                        <div className="text-sm text-zinc-400">{pageInfo.replace("of", "din")}</div>
                        <Button
                            onClick={() => {
                                const next = Math.max(0, skip - take);
                                setSkip(next);
                                loadList(next);
                            }}
                            disabled={skip === 0 || loading}
                            variant="ghost"
                        >
                            Prev
                        </Button>
                        <Button
                            onClick={() => {
                                const next = skip + take;
                                setSkip(next);
                                loadList(next);
                            }}
                            disabled={skip + take >= total || loading}
                            variant="ghost"
                        >
                            Next
                        </Button>
                    </div>
                }
            />

            {err ? <ErrorBox message={err} onClose={() => setErr(null)} /> : null}

            <Drawer
                open={drawerOpen}
                title={drawerMode === "create" ? "Ordin de Lucru Nou" : "Detalii Ordin de Lucru"}
                onClose={handleCloseDrawer}
                footer={
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" onClick={handleCloseDrawer} disabled={actionLoading}>
                            Anuleaza
                        </Button>
                        {drawerMode === "create" ? (
                            <Button variant="primary" disabled={!canCreate} onClick={onCreate}>
                                Creeaza Ordin
                            </Button>
                        ) : (
                            hasPerm("WO_UPDATE") && (
                                <Button onClick={onSave} disabled={!canSave} variant="primary">
                                    Salveaza Modificarile
                                </Button>
                            )
                        )}
                    </div>
                }
            >
                {drawerMode === "create" ? (
                    <div className="grid gap-4">
                        <Input label="Titlu" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ce trebuie facut?" />

                        <Select label="Tip" value={newType} onChange={(e) => setNewType(Number(e.target.value) as WorkOrderType)}>
                            <option value={WorkOrderType.Corrective}>Corectiv</option>
                            <option value={WorkOrderType.Preventive}>Preventiv</option>
                        </Select>

                        <Select label="Clasificare" value={newClassification} onChange={(e) => setNewClassification(Number(e.target.value) as WorkOrderClassification)}>
                            <option value={WorkOrderClassification.Proactive}>Proactiv</option>
                            <option value={WorkOrderClassification.Reactive}>Reactiv</option>
                        </Select>

                        <Select label="Utilaj (optional)" value={newAssetId} onChange={(e) => setNewAssetId(e.target.value)}>
                            <option value="">(Niciunul)</option>
                            {assets.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                </option>
                            ))}
                        </Select>

                        <Select label="Echipa (Explodeaza WO)" value={newTeamId} onChange={(e) => {
                            setNewTeamId(e.target.value);
                            setNewCoordId("");
                        }}>
                            <option value="">(Individual / Fara Echipa)</option>
                            {teams.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </Select>

                        {newTeamId && (
                            <Select label="Coordonator (Obligatoriu)" value={newCoordId} onChange={(e) => setNewCoordId(e.target.value)}>
                                <option value="">(Selecteaza Coordonator)</option>
                                {teams.find(t => t.id === newTeamId)?.members.map((m) => (
                                    <option key={m.personId} value={m.personId}>
                                        {m.displayName}
                                    </option>
                                ))}
                            </Select>
                        )}

                        <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-400">Descriere (optional)</label>
                            <textarea
                                className="min-h-[120px] w-full rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
                                value={newDesc}
                                onChange={(e) => setNewDesc(e.target.value)}
                            />
                        </div>
                    </div>
                ) : selected ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3">
                            <div className="flex flex-wrap gap-2">
                                {hasPerm("WO_EXECUTE") && (
                                    <>
                                        <Button size="sm" onClick={() => applyAction("start")} disabled={selected.status !== WorkOrderStatus.Open || actionLoading} variant="ghost">
                                            Start
                                        </Button>
                                        <Button size="sm" onClick={() => applyAction("stop")} disabled={selected.status !== WorkOrderStatus.InProgress || actionLoading} variant="ghost">
                                            Stop
                                        </Button>
                                    </>
                                )}
                                {hasPerm("WO_UPDATE") && (
                                    <>
                                        <Button size="sm" onClick={() => applyAction("cancel")} disabled={selected.status === WorkOrderStatus.Done || actionLoading} variant="ghost">
                                            Cancel
                                        </Button>
                                        <Button size="sm" onClick={() => applyAction("reopen")} disabled={selected.status !== WorkOrderStatus.Cancelled || actionLoading} variant="ghost">
                                            Reopen
                                        </Button>
                                    </>
                                )}
                            </div>

                            <Link to={`/work-orders/${selected.id}`} className="text-sm text-teal-400 hover:underline">
                                Detalii Complete →
                            </Link>
                        </div>

                        <Tabs
                            items={[
                                { key: "details", label: "Detalii" },
                                { key: "activity", label: "Activitate" },
                                { key: "parts", label: "Piese de schimb" },
                            ]}
                            value={activeTab}
                            onChange={(k) => setActiveTab(k as TabKey)}
                            render={(k) => {
                                if (k === "details") {
                                    return (
                                        <>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <Input label="Title" value={dTitle} onChange={(e) => setDTitle(e.target.value)} />

                                                <Select label="Status" value={dStatus} onChange={(e) => setDStatus(Number(e.target.value) as WorkOrderStatus)}>
                                                    <option value={WorkOrderStatus.Open}>Deschis</option>
                                                    <option value={WorkOrderStatus.InProgress}>În Lucru</option>
                                                    <option value={WorkOrderStatus.Done}>Finalizat</option>
                                                    <option value={WorkOrderStatus.Cancelled}>Anulat</option>
                                                </Select>

                                                <Select label="Utilaj" value={dAssetId} onChange={(e) => setDAssetId(e.target.value)}>
                                                    <option value="">(Niciunul)</option>
                                                    {assets.map((a) => (
                                                        <option key={a.id} value={a.id}>
                                                            {a.name}
                                                        </option>
                                                    ))}
                                                </Select>

                                                <Select label="Clasificare" value={dClassification} onChange={(e) => setDClassification(Number(e.target.value) as WorkOrderClassification)}>
                                                    <option value={WorkOrderClassification.Proactive}>Proactiv</option>
                                                    <option value={WorkOrderClassification.Reactive}>Reactiv</option>
                                                </Select>

                                                <Select label="Alocat angajat" value={dAssignedId} onChange={(e) => setDAssignedId(e.target.value)}>
                                                    <option value="">(Nealocat)</option>
                                                    {people.map((p) => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.displayName}
                                                        </option>
                                                    ))}
                                                </Select>

                                                <Input type="datetime-local" label="Data Start" value={dStartAt} onChange={(e) => setDStartAt(e.target.value)} />
                                                <Input type="datetime-local" label="Data Stop" value={dStopAt} onChange={(e) => setDStopAt(e.target.value)} />
                                            </div>

                                            <div className="mt-4">
                                                <label className="mb-1 block text-xs font-medium text-zinc-400">Descriere</label>
                                                <textarea
                                                    className="min-h-[110px] w-full rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
                                                    value={dDesc}
                                                    onChange={(e) => setDDesc(e.target.value)}
                                                />
                                            </div>

                                            <div className="mt-6 text-xs text-zinc-500">
                                                {selected.durationMinutes ? `Durata Finala: ${selected.durationMinutes} min` : "In lucru..."}
                                            </div>
                                        </>
                                    );
                                }

                                if (k === "activity") {
                                    return (
                                        <div className="space-y-4">
                                            {/* Assignments */}
                                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                <div className="mb-3 flex items-center justify-between">
                                                    <div className="text-sm font-semibold text-zinc-200">Alocari echipa</div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={asgLoading || actionLoading}
                                                        onClick={() => selected && loadAssignments(selected.id)}
                                                    >
                                                        Actualizeaza
                                                    </Button>
                                                </div>

                                                {asgErr ? <ErrorBox message={asgErr} onClose={() => setAsgErr(null)} /> : null}

                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <Select label="Angajat" value={asgPersonId} onChange={(e) => setAsgPersonId(e.target.value)}>
                                                        <option value="">(Selecteaza angajat)</option>
                                                        {peopleForAssignment.map((p) => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.displayName}
                                                            </option>
                                                        ))}
                                                    </Select>

                                                    <Select label="Rol" value={asgRoleId} onChange={(e) => setAsgRoleId(e.target.value)}>
                                                        <option value="">(Selecteaza rol)</option>
                                                        {rolesForAssignment.map((r) => (
                                                            <option key={r.id} value={r.id}>
                                                                {r.name}
                                                            </option>
                                                        ))}
                                                    </Select>

                                                    <Input type="datetime-local" label="Planificat din" value={asgFrom} onChange={(e) => setAsgFrom(e.target.value)} />
                                                    <Input type="datetime-local" label="Planificat pana la" value={asgTo} onChange={(e) => setAsgTo(e.target.value)} />

                                                    <div className="sm:col-span-2">
                                                        <label className="mb-1 block text-xs font-medium text-zinc-400">Note (optional)</label>
                                                        <textarea
                                                            className="min-h-[80px] w-full rounded-xl border border-white/10 bg-white/5 p-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
                                                            value={asgNotes}
                                                            onChange={(e) => setAsgNotes(e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="sm:col-span-2 flex justify-end">
                                                        <Button variant="primary" disabled={actionLoading} onClick={onCreateAssignment}>
                                                            Adauga alocare
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="mt-4">
                                                    {asgLoading ? (
                                                        <div className="text-sm text-zinc-400">Se incarca...</div>
                                                    ) : assignments.length === 0 ? (
                                                        <div className="text-sm text-zinc-400">Nu exista alocari.</div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {assignments.map((a) => (
                                                                <div key={a.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-zinc-950/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                                    <div className="min-w-0">
                                                                        <div className="truncate text-sm font-medium text-zinc-100">
                                                                            {a.personName} <span className="text-zinc-400">— {a.roleName}</span>
                                                                        </div>
                                                                        <div className="text-xs text-zinc-400">
                                                                            {isoToLocalDisplay(a.plannedFrom)} → {isoToLocalDisplay(a.plannedTo)}
                                                                            {a.notes ? <span className="text-zinc-500"> · {a.notes}</span> : null}
                                                                        </div>
                                                                    </div>
                                                                    <Button variant="ghost" size="sm" disabled={actionLoading} onClick={() => onDeleteAssignment(a)}>
                                                                        Sterge
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Labor logs */}
                                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                <div className="mb-3 flex items-center justify-between">
                                                    <div className="text-sm font-semibold text-zinc-200">Pontaj (Labor logs)</div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={laborLoading || actionLoading}
                                                        onClick={() => selected && loadLabor(selected.id)}
                                                    >
                                                        Actualizeaza
                                                    </Button>
                                                </div>

                                                {laborErr ? <ErrorBox message={laborErr} onClose={() => setLaborErr(null)} /> : null}

                                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_120px_1fr_100px]">
                                                    <Select label="Angajat" value={laborPersonId} onChange={(e) => setLaborPersonId(e.target.value)}>
                                                        <option value="">(Selecteaza angajat)</option>
                                                        {people.map((p) => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.displayName}
                                                            </option>
                                                        ))}
                                                    </Select>

                                                    <Input
                                                        label="Minute"
                                                        type="number"
                                                        min={1}
                                                        step="1"
                                                        value={laborMinutes}
                                                        onChange={(e) => setLaborMinutes(e.target.value)}
                                                    />

                                                    <Input
                                                        label="Descriere (optional)"
                                                        value={laborDesc}
                                                        onChange={(e) => setLaborDesc(e.target.value)}
                                                        placeholder="ex: inlocuit curea, reglaj..."
                                                    />

                                                    <div className="flex items-end">
                                                        <Button variant="primary" disabled={actionLoading} onClick={onAddLabor}>
                                                            Adauga
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="mt-4">
                                                    {laborLoading ? (
                                                        <div className="text-sm text-zinc-400">Se incarca...</div>
                                                    ) : labor.length === 0 ? (
                                                        <div className="text-sm text-zinc-400">Nu exista pontaje.</div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {labor.map((l) => (
                                                                <div key={l.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-zinc-950/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                                    <div className="min-w-0">
                                                                        <div className="truncate text-sm font-medium text-zinc-100">
                                                                            {l.personName ?? l.personId} <span className="text-zinc-400">— {l.minutes} min</span>
                                                                        </div>
                                                                        <div className="text-xs text-zinc-400">
                                                                            {isoToLocalDisplay(l.createdAt)}
                                                                            {l.description ? <span className="text-zinc-500"> · {l.description}</span> : null}
                                                                        </div>
                                                                    </div>
                                                                    <Button variant="ghost" size="sm" disabled={actionLoading} onClick={() => onDeleteLabor(l)}>
                                                                        Sterge
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                // PARTS
                                return (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <div className="text-sm font-semibold text-zinc-200">Piese utilizate</div>
                                            <Button variant="ghost" size="sm" disabled={woPartsLoading || actionLoading} onClick={() => selected && loadWoParts(selected.id)}>
                                                Actualizeaza
                                            </Button>
                                        </div>

                                        {woPartsErr ? <ErrorBox message={woPartsErr} onClose={() => setWoPartsErr(null)} /> : null}

                                        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_120px_100px]">
                                            <Select label="Piesa" value={partIdInput} onChange={(e) => setPartIdInput(e.target.value)}>
                                                <option value="">(Selecteaza piesa)</option>
                                                {partsCatalog.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name}{p.code ? ` (${p.code})` : ""}
                                                    </option>
                                                ))}
                                            </Select>

                                            <Input label="Cantitate" type="number" min={0.0001} step="0.01" value={qtyInput} onChange={(e) => setQtyInput(e.target.value)} />

                                            <div className="flex items-end">
                                                <Button variant="primary" disabled={actionLoading} onClick={onAddPart}>
                                                    Adauga
                                                </Button>
                                            </div>
                                        </div>

                                        {woPartsLoading ? (
                                            <div className="text-sm text-zinc-400">Se incarca...</div>
                                        ) : woParts.length === 0 ? (
                                            <div className="text-sm text-zinc-400">Nu exista piese.</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {woParts.map((row) => (
                                                    <div key={row.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-zinc-950/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-medium text-zinc-100">
                                                                {row.partName} {row.partCode ? <span className="text-zinc-400">({row.partCode})</span> : null}
                                                            </div>
                                                            <div className="text-xs text-zinc-400">{row.uom ?? ""}</div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                type="number"
                                                                min={0.0001}
                                                                step="0.01"
                                                                value={toQtyString(row.qtyUsed)}
                                                                onChange={(e) => {
                                                                    const v = Number(e.target.value);
                                                                    if (!Number.isFinite(v)) return;
                                                                    setWoParts((prev) => prev.map((x) => (x.id === row.id ? { ...x, qtyUsed: v } : x)));
                                                                }}
                                                                onBlur={(e) => {
                                                                    const v = Number(e.target.value);
                                                                    if (Number.isFinite(v) && v > 0) onSetPartQty(row, v);
                                                                    else if (selected) loadWoParts(selected.id);
                                                                }}
                                                                className="w-[100px]"
                                                            />

                                                            <Button variant="ghost" size="sm" disabled={actionLoading} onClick={() => onDeletePart(row)}>
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            }}
                        />
                    </div>
                ) : null}
            </Drawer>

            <div className="grid gap-6">
                {/* LIST */}
                <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
                    <div className="border-b border-white/10 bg-zinc-950/30 p-3">
                        <div className="grid gap-3">
                            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cauta ordine de lucru..." />

                            <div className="flex flex-wrap gap-2">
                                <PillButton active={status === ""} onClick={() => setStatus("")}>
                                    Toate <span className="text-zinc-400">({counts.all})</span>
                                </PillButton>
                                <PillButton tone="amber" active={status === WorkOrderStatus.Open} onClick={() => setStatus(WorkOrderStatus.Open)}>
                                    Deschise <span className="text-zinc-400">({counts.open})</span>
                                </PillButton>
                                <PillButton tone="teal" active={status === WorkOrderStatus.InProgress} onClick={() => setStatus(WorkOrderStatus.InProgress)}>
                                    În Lucru <span className="text-zinc-400">({counts.inProgress})</span>
                                </PillButton>
                                <PillButton tone="emerald" active={status === WorkOrderStatus.Done} onClick={() => setStatus(WorkOrderStatus.Done)}>
                                    Încheiate <span className="text-zinc-400">({counts.done})</span>
                                </PillButton>
                                <PillButton tone="rose" active={status === WorkOrderStatus.Cancelled} onClick={() => setStatus(WorkOrderStatus.Cancelled)}>
                                    Anulate <span className="text-zinc-400">({counts.cancelled})</span>
                                </PillButton>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-2">
                                <Select value={type} onChange={(e) => setType(e.target.value === "" ? "" : (Number(e.target.value) as WorkOrderType))}>
                                    <option value="">Toate Tipurile</option>
                                    <option value={WorkOrderType.Corrective}>Corectiv</option>
                                    <option value={WorkOrderType.Preventive}>Preventiv</option>
                                </Select>

                                <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                                    <option value="newest">Cele mai noi</option>
                                    <option value="oldest">Cele mai vechi</option>
                                </Select>

                                <Select
                                    value={locId}
                                    onChange={(e) => {
                                        setLocId(e.target.value);
                                        setAssetId("");
                                    }}
                                >
                                    <option value="">Toate Locatiile</option>
                                    {locs.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.name}
                                        </option>
                                    ))}
                                </Select>

                                <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                                    <option value="">Toate Utilajele</option>
                                    {filteredAssets.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="max-h-[40vh] lg:max-h-[70vh] overflow-y-auto">
                        {viewItems.map((w) => {
                            const style = getWorkOrderDecoration(w);
                            return (
                                <button
                                    key={w.id}
                                    onClick={() => {
                                        setSelId(w.id);
                                        setDrawerMode("edit");
                                        setDrawerOpen(true);
                                    }}
                                    className={cx(
                                        "w-full border-b border-white/5 p-4 text-left transition hover:bg-white/5",
                                        style.borderClass,
                                        selId === w.id && "bg-teal-500/10 border-l-2 border-l-teal-500"
                                    )}
                                >
                                    <div className="mb-1 flex items-start justify-between">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className="truncate pr-2 font-medium text-zinc-100">{w.title}</span>
                                            {style.showReactiveBadge && (
                                                <span className="shrink-0 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                                    Reactiv
                                                </span>
                                            )}
                                        </div>
                                        <StatusPill status={w.status} />
                                    </div>
                                    <div className="flex justify-between text-xs text-zinc-400">
                                        <span>{w.asset?.name ?? "Fara Utilaj"}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center gap-1 text-zinc-500">
                                                <span className="i-lucide-user text-[10px]">👤</span>
                                                <span className="truncate max-w-[80px]">
                                                    {getResponsibleDisplayName(w)}
                                                </span>
                                            </span>
                                            <span>{isoToLocalDisplay(w.startAt)}</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}

                        {viewItems.length === 0 ? (
                            <div className="p-6 text-center text-sm text-zinc-400">{loading ? "Se incarca..." : "Nu exista ordine de lucru."}</div>
                        ) : null}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
