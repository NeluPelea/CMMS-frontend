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


function toIsoUtc(dateLocal: string, timeLocal: string) {
  const d = new Date(`${dateLocal}T${timeLocal}:00`);
  return d.toISOString();
}

export default function WoAssignmentsPanel(props: { workOrderId: string }) {
  const { workOrderId } = props;

  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [items, setItems] = useState<AssignmentDto[]>([]);
  const [people, setPeople] = useState<PersonLiteDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form
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

      if (!roleId) setRoleId(activeRoles[0]?.id ?? "");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshPeople() {
    setErr(null);
    try {
      const list = await getAvailablePeople({ fromUtc, toUtc, q: q.trim() || undefined });
      const arr = Array.isArray(list) ? list : [];
      setPeople(arr);

      if (arr.length && !arr.some(p => p.id === personId)) setPersonId(arr[0].id);
      if (!arr.length) setPersonId("");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load available people.");
      setPeople([]);
      setPersonId("");
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  useEffect(() => {
    refreshPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUtc, toUtc]);

  async function onAdd() {
    setErr(null);

    if (!roleId) return setErr("Select a role.");
    if (!personId) return setErr("Select a person.");
    if (new Date(toUtc).getTime() <= new Date(fromUtc).getTime()) return setErr("Invalid time window.");

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
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create assignment.");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete assignment?")) return;

    setErr(null);
    setLoading(true);
    try {
      await deleteWoAssignment(workOrderId, id);
      await refreshAll();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete assignment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-zinc-100">Assignments</div>
          <div className="text-sm text-zinc-500">
            Assign people + roles to this work order
          </div>
        </div>

        <button
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50"
          onClick={refreshAll}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {err ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Role</div>
          <select
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            <option value="">Select role...</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Date</div>
          <input
            type="date"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">From</div>
          <input
            type="time"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
            value={fromTime}
            onChange={(e) => setFromTime(e.target.value)}
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">To</div>
          <input
            type="time"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
            value={toTime}
            onChange={(e) => setToTime(e.target.value)}
          />
        </div>

        <div className="lg:col-span-6 grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Search person</div>
            <input
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-teal-400/40"
              placeholder="name / job title"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={refreshPeople}
              onKeyDown={(e) => {
                if (e.key === "Enter") refreshPeople();
              }}
            />
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Available people</div>
            <select
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              {!people.length ? <option value="">No available people</option> : null}
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} — {p.jobTitle || "n/a"} {p.specialization ? `(${p.specialization})` : ""}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-zinc-500">Loaded: {people.length}</div>
          </div>

          <div className="lg:col-span-1">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Notes</div>
            <input
              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-teal-400/40"
              placeholder="optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="lg:col-span-6 flex justify-end">
          <button
            className="rounded-xl bg-teal-500/20 px-4 py-2 text-sm font-semibold text-teal-200 ring-1 ring-teal-400/30 hover:bg-teal-500/25 disabled:opacity-50"
            onClick={onAdd}
            disabled={loading || !roleId || !personId}
          >
            Add assignment
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-sm font-semibold text-zinc-200">Current assignments</div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs text-zinc-300">
              <tr>
                <th className="px-3 py-2">Person</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Planned</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {!items.length ? (
                <tr>
                  <td className="px-3 py-3 text-zinc-400" colSpan={5}>
                    No assignments yet.
                  </td>
                </tr>
              ) : null}

              {items.map((x) => (
                <tr key={x.id} className="hover:bg-white/5">
                  <td className="px-3 py-2 text-zinc-100">{x.personName}</td>
                  <td className="px-3 py-2 text-zinc-200">{x.roleName}</td>
                  <td className="px-3 py-2 text-zinc-300">
                    {new Date(x.plannedFrom).toLocaleString()} → {new Date(x.plannedTo).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">{new Date(x.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="rounded-lg bg-white/5 px-2 py-1 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50"
                      onClick={() => onDelete(x.id)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
