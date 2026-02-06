// src/pages/WorkOrderDetailsPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import WoAssignmentsPanel from "../components/WoAssignmentsPanel";

import {
  cancelWorkOrder,
  getAssets,
  getPeopleSimple,
  getWorkOrderById,
  reopenWorkOrder,
  startWorkOrder,
  stopWorkOrder,
  updateWorkOrder,
  type AssetDto,
  type PersonDto,
  type WorkOrderDetailsDto,
  // Parts / WO Parts
  getParts,
  addWorkOrderPart,
  getWorkOrderParts,
  deleteWorkOrderPart,
  setWorkOrderPartQty,
  type PartDto,
  type WorkOrderPartDto,
} from "../api";

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
  cx,
} from "../components/ui";

// ---------------- helpers ----------------

function fmt(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function toLocalInputValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// accepts "2,5" or "2.5"
function parseQtyLoose(input: string): number | null {
  const s = (input ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

type DraftRow = {
  partId: string;
  partName: string;
  partCode?: string | null;
  uom?: string | null;
  qty: number;
};

function FieldLabel(props: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
      {props.children}
    </div>
  );
}

function DateTimeLocal(props: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type="datetime-local"
      value={props.value}
      onChange={props.onChange}
      className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
    />
  );
}

function TextArea(props: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={props.value}
      onChange={props.onChange}
      rows={props.rows ?? 4}
      placeholder={props.placeholder}
      className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-teal-400/40"
    />
  );
}

// ---------------- page ----------------

export default function WorkOrderDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const [wo, setWo] = useState<WorkOrderDetailsDto | null>(null);
  const [assets, setAssets] = useState<AssetDto[]>([]);
  const [people, setPeople] = useState<PersonDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // edit form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<number>(1);
  const [assetId, setAssetId] = useState<string>("");
  const [assignedToPersonId, setAssignedToPersonId] = useState<string>("");
  const [startAt, setStartAt] = useState<string>("");
  const [stopAt, setStopAt] = useState<string>("");

  const canSave = useMemo(() => title.trim().length >= 2, [title]);

  // ---- Parts catalog + search ----
  const [partsBase, setPartsBase] = useState<PartDto[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const debounceTimer = useRef<number | null>(null);

  // ---- WO Parts (DB) ----
  const [woParts, setWoParts] = useState<WorkOrderPartDto[]>([]);
  const [woPartsLoading, setWoPartsLoading] = useState(false);

  // ---- Draft ----
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [partIdToAdd, setPartIdToAdd] = useState<string>("");
  const [qtyToAdd, setQtyToAdd] = useState<string>("1");
  const [commitLoading, setCommitLoading] = useState(false);

  const currentAssetIdForCatalog = useMemo(() => {
    return (wo?.assetId || assetId || "").trim() || undefined;
  }, [wo?.assetId, assetId]);

  const partsFiltered = useMemo(() => {
    const q = partSearch.trim().toLowerCase();
    if (!q) return partsBase;
    return partsBase.filter((p) => {
      const n = (p.name ?? "").toLowerCase();
      const c = (p.code ?? "").toLowerCase();
      return n.includes(q) || c.includes(q);
    });
  }, [partsBase, partSearch]);

  async function loadWo() {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await getWorkOrderById(id);
      setWo(data);

      setTitle(data.title || "");
      setDescription(data.description || "");
      setStatus(data.status);
      setAssetId(data.assetId || "");
      setAssignedToPersonId(data.assignedToPersonId || "");
      setStartAt(toLocalInputValue(data.startAt));
      setStopAt(toLocalInputValue(data.stopAt));
    } catch (e: any) {
      setErr(e?.message || String(e));
      setWo(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadRefs() {
    try {
      const a = await getAssets({ take: 500, ia: true });
      setAssets(Array.isArray(a) ? a : []);
    } catch {
      setAssets([]);
    }

    try {
      const p = await getPeopleSimple();
      setPeople(Array.isArray(p) ? p : []);
    } catch {
      setPeople([]);
    }
  }

  async function loadWoParts() {
    if (!id) return;
    setWoPartsLoading(true);
    try {
      const rows = await getWorkOrderParts(id);
      setWoParts(Array.isArray(rows) ? rows : []);
    } catch {
      setWoParts([]);
    } finally {
      setWoPartsLoading(false);
    }
  }

  async function loadPartsCatalog(serverSearch?: string) {
    setPartsLoading(true);
    try {
      // if backend does not support assetId/onlyCompatible, remove those fields
      const data = await getParts({
        take: 500,
        q: (serverSearch ?? "").trim() || undefined,
        assetId: currentAssetIdForCatalog,
        onlyCompatible: !!currentAssetIdForCatalog,
      });

      setPartsBase(Array.isArray(data) ? data : []);
    } catch {
      setPartsBase([]);
    } finally {
      setPartsLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    (async () => {
      await loadRefs();
      await loadWo();
      await loadWoParts();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // reload catalog when asset changes
  useEffect(() => {
    setDraft([]);
    setPartIdToAdd("");
    loadPartsCatalog("").catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wo?.assetId, assetId]);

  // debounce server-search
  useEffect(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);

    debounceTimer.current = window.setTimeout(() => {
      loadPartsCatalog(partSearch).catch(() => {});
    }, 300);

    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partSearch, wo?.assetId, assetId]);

  async function onSave() {
    if (!id) return;
    setErr(null);
    try {
      const startIso = startAt ? new Date(startAt).toISOString() : null;
      const stopIso = stopAt ? new Date(stopAt).toISOString() : null;

      await updateWorkOrder(id, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        status,
        assetId: assetId ? assetId : null,
        assignedToPersonId: assignedToPersonId ? assignedToPersonId : null,
        startAt: startIso,
        stopAt: stopIso,
      });

      await loadWo();
      await loadWoParts();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function action(fn: (id: string) => Promise<any>) {
    if (!id) return;
    setErr(null);
    try {
      await fn(id);
      await loadWo();
      await loadWoParts();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  function onAddToDraft() {
    setErr(null);

    if (!partIdToAdd) {
      setErr("Select a part.");
      return;
    }

    const qty = parseQtyLoose(qtyToAdd);
    if (qty == null || qty <= 0) {
      setErr("Qty must be > 0 (ex: 2,5 or 2.5).");
      return;
    }

    const p =
      partsFiltered.find((x) => x.id === partIdToAdd) ||
      partsBase.find((x) => x.id === partIdToAdd);

    if (!p) {
      setErr("Selected part is not in the current list.");
      return;
    }

    setDraft((prev) => {
      const idx = prev.findIndex((r) => r.partId === p.id);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty };
        return copy;
      }
      return prev.concat({
        partId: p.id,
        partName: p.name,
        partCode: p.code ?? null,
        uom: p.uom ?? null,
        qty,
      });
    });

    setPartIdToAdd("");
    setQtyToAdd("1");
  }

  function removeDraftRow(partId: string) {
    setDraft((prev) => prev.filter((x) => x.partId !== partId));
  }

  async function commitDraftToDb() {
    if (!id) return;
    setErr(null);

    if (draft.length === 0) {
      setErr("Draft is empty. Add parts, then press OK.");
      return;
    }

    setCommitLoading(true);
    try {
      // serial to avoid inventory concurrency issues
      for (const r of draft) {
        await addWorkOrderPart(id, r.partId, r.qty);
      }
      setDraft([]);
      await loadWoParts();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setCommitLoading(false);
    }
  }

  async function onRemoveWoPart(rowId: string) {
    if (!id) return;
    if (!confirm("Remove this part from work order?")) return;

    setErr(null);
    try {
      await deleteWorkOrderPart(id, rowId);
      await loadWoParts();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onSetQty(rowId: string, input: string) {
    if (!id) return;
    const n = parseQtyLoose(input);
    if (n == null || n < 0) {
      setErr("Invalid qty. Accepts 2,5 or 2.5 (>= 0).");
      return;
    }

    try {
      await setWorkOrderPartQty(id, rowId, n);
      await loadWoParts();
    } catch (e: any) {
      setErr(e?.message || String(e));
      await loadWoParts();
    }
  }

  const headerRight = (
    <div className="flex items-center gap-2">
      <Button onClick={() => loadWo()} disabled={loading} variant="ghost">
        Refresh
      </Button>
    </div>
  );

  return (
    <AppShell title="Work Order Details">
      <PageToolbar
        left={
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-200">
              Work Order Details
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              ID: {id ?? "—"}
            </div>
          </div>
        }
        right={headerRight}
      />

      {loading ? (
        <div className="mt-4 text-sm text-zinc-400">Loading...</div>
      ) : null}

      {err ? <ErrorBox message={err} /> : null}

      {!loading && !wo ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
          Work order not found (or no access).
        </div>
      ) : null}

      {wo ? (
        <>
          {/* Edit */}
          <Card title="Edit work order">
          <div className="mt-6" />
            {id ? <WoAssignmentsPanel workOrderId={id} /> : null}
            <div className="mt-6" />

            <div className="grid gap-3 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <FieldLabel>Title</FieldLabel>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                />
              </div>

              <div className="lg:col-span-3">
                <FieldLabel>Status</FieldLabel>
                <Select
                  value={status}
                  onChange={(e) => setStatus(Number(e.target.value))}
                >
                  <option value={1}>Open</option>
                  <option value={2}>In Progress</option>
                  <option value={3}>Closed</option>
                  <option value={4}>Canceled</option>
                </Select>
              </div>

              <div className="lg:col-span-3">
                <FieldLabel>Assigned</FieldLabel>
                <Select
                  value={assignedToPersonId}
                  onChange={(e) => setAssignedToPersonId(e.target.value)}
                >
                  <option value="">(Unassigned)</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="lg:col-span-6">
                <FieldLabel>Asset</FieldLabel>
                <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                  <option value="">(No asset)</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.code ? ` (${a.code})` : ""}
                      {a.locName ? ` - ${a.locName}` : ""}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="lg:col-span-3">
                <FieldLabel>Start (local)</FieldLabel>
                <DateTimeLocal value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </div>

              <div className="lg:col-span-3">
                <FieldLabel>Stop (local)</FieldLabel>
                <DateTimeLocal value={stopAt} onChange={(e) => setStopAt(e.target.value)} />
              </div>

              <div className="lg:col-span-12">
                <FieldLabel>Description</FieldLabel>
                <TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Description (optional)"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-zinc-500">
                Backend: Start={fmt(wo.startAt)} • Stop={fmt(wo.stopAt)} • Duration=
                {wo.durationMinutes ?? "—"} min
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={onSave}
                  disabled={!canSave}
                  variant="primary"
                >
                  Save
                </Button>

                <div className="hidden sm:block h-6 w-px bg-white/10" />

                <Button onClick={() => action(startWorkOrder)} variant="ghost">
                  Start
                </Button>
                <Button onClick={() => action(stopWorkOrder)} variant="ghost">
                  Stop
                </Button>
                <Button onClick={() => action(cancelWorkOrder)} variant="ghost">
                  Cancel
                </Button>
                <Button onClick={() => action(reopenWorkOrder)} variant="ghost">
                  Reopen
                </Button>
              </div>
            </div>
          </Card>

          <div className="mt-6" />

          {/* Parts used */}
          <Card title="Parts used">
            <div className="grid gap-3 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <FieldLabel>Search</FieldLabel>
                <Input
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                  placeholder="Search parts (name/code)..."
                />
              </div>

              <div className="lg:col-span-5">
                <FieldLabel>Part</FieldLabel>
                <Select
                  value={partIdToAdd}
                  onChange={(e) => setPartIdToAdd(e.target.value)}
                  disabled={partsLoading}
                >
                  <option value="">
                    {partsLoading ? "(Loading...)" : `(Select part) (${partsFiltered.length})`}
                  </option>
                  {partsFiltered.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.code ? `(${p.code})` : ""} {p.uom ? `- ${p.uom}` : ""}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="lg:col-span-2">
                <FieldLabel>Qty</FieldLabel>
                <Input
                  value={qtyToAdd}
                  onChange={(e) => setQtyToAdd(e.target.value)}
                  placeholder="ex 2,5"
                />
              </div>

              <div className="lg:col-span-1 flex items-end">
                <Button onClick={onAddToDraft} disabled={!id || partsLoading} variant="ghost">
                  Add
                </Button>
              </div>

              <div className="lg:col-span-12 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-zinc-500">
                  {currentAssetIdForCatalog
                    ? "Catalog filtered by selected asset (if backend supports it)."
                    : "Catalog is global (no asset selected)."}
                  {partsLoading ? " • Loading parts..." : ""}
                </div>

                <Button
                  onClick={commitDraftToDb}
                  disabled={!id || commitLoading || draft.length === 0}
                  variant="primary"
                >
                  {commitLoading ? "Saving..." : "OK (save draft)"}
                </Button>
              </div>
            </div>

            {/* Draft */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-200">
                  Draft
                </div>
                <Pill tone={draft.length ? "amber" : "zinc"}>
                  {draft.length} item(s)
                </Pill>
              </div>

              {draft.length === 0 ? (
                <div className="text-sm text-zinc-400">
                  No draft parts. Add parts then press OK.
                </div>
              ) : (
                <TableShell minWidth={720}>
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-white/5 text-zinc-300">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Part</th>
                        <th className="px-3 py-2 text-left font-semibold">Code</th>
                        <th className="px-3 py-2 text-left font-semibold">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {draft.map((r) => (
                        <tr key={r.partId} className="hover:bg-white/5">
                          <td className="px-3 py-2 text-zinc-100">
                            {r.partName} {r.uom ? <span className="text-zinc-400">({r.uom})</span> : null}
                          </td>
                          <td className="px-3 py-2 text-zinc-300">{r.partCode ?? "—"}</td>
                          <td className="px-3 py-2 text-zinc-100">
                            {String(r.qty).replace(".", ",")}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => removeDraftRow(r.partId)}
                              className={cx(
                                "rounded-lg px-3 py-1.5 text-xs font-semibold ring-1",
                                "bg-white/10 text-zinc-200 ring-white/15 hover:bg-white/15"
                              )}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              )}
            </div>

            {/* DB rows */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-200">
                  Saved parts
                </div>
                <Pill tone={woParts.length ? "teal" : "zinc"}>
                  {woParts.length} row(s)
                </Pill>
              </div>

              <TableShell minWidth={760}>
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-white/5 text-zinc-300">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Part</th>
                      <th className="px-3 py-2 text-left font-semibold">Code</th>
                      <th className="px-3 py-2 text-left font-semibold">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/10">
                    {woPartsLoading ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-zinc-400">
                          Loading...
                        </td>
                      </tr>
                    ) : null}

                    {!woPartsLoading &&
                      woParts.map((r) => (
                        <tr key={r.id} className="hover:bg-white/5">
                          <td className="px-3 py-2 text-zinc-100">
                            {r.partName} {r.uom ? <span className="text-zinc-400">({r.uom})</span> : null}
                          </td>
                          <td className="px-3 py-2 text-zinc-300">{r.partCode ?? "—"}</td>

                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                defaultValue={String(r.qtyUsed).replace(".", ",")}
                                onBlur={(e) => onSetQty(r.id, e.target.value)}
                                className="h-9 w-36 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
                              />
                              <span className="text-xs text-zinc-500">
                                edit + blur
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => onRemoveWoPart(r.id)}
                              className={cx(
                                "rounded-lg px-3 py-1.5 text-xs font-semibold ring-1",
                                "bg-white/10 text-zinc-200 ring-white/15 hover:bg-white/15"
                              )}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}

                    {!woPartsLoading && woParts.length === 0 ? (
                      <EmptyRow colSpan={4} text="No parts used." />
                    ) : null}
                  </tbody>
                </table>
              </TableShell>
            </div>
          </Card>
        </>
      ) : null}
    </AppShell>
  );
}
