import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";

import {
  getKpis,
  getAssetsInMaintenance,
  getPersonActivity,
  type AssetInMaintDto,
  type KpisDto,
  type PersonActivityDto,
} from "../api/dashboard";

import { getPeople, type PersonDto } from "../api/people";

/* ================= helpers ================= */

// className helper
function cx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

// safe date formatting
function fmtDate(x: string | null) {
  if (!x) return "";
  try {
    return new Date(x).toLocaleString();
  } catch {
    return x;
  }
}

/* ================= count-up hook ================= */

// Smooth count-up animation (slower, enterprise feel)
function useCountUp(value: number | null | undefined, durationMs = 1200) {
  const target = typeof value === "number" ? value : null;
  const [display, setDisplay] = useState<number>(target ?? 0);

  useEffect(() => {
    if (target == null) {
      setDisplay(0);
      return;
    }

    const start = performance.now();
    const from = display;
    const to = target;
    const diff = to - from;

    if (diff === 0) return;

    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + diff * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}

/* ================= KPI Card ================= */

function KpiCard(props: {
  label: string;
  value: number | null | undefined;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const { label, value, hint, tone = "neutral" } = props;

  const animated = useCountUp(value, 1200);
  const shown =
    typeof value === "number"
      ? Math.round(animated).toLocaleString("ro-RO")
      : "—";

  const barColor =
    tone === "good"
      ? "bg-emerald-400"
      : tone === "warn"
        ? "bg-amber-400"
        : tone === "bad"
          ? "bg-rose-400"
          : "bg-teal-400";

  const valueColor =
    tone === "good"
      ? "text-emerald-200"
      : tone === "warn"
        ? "text-amber-200"
        : tone === "bad"
          ? "text-rose-200"
          : "text-teal-200";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
      {/* accent bar */}
      <div className={cx("absolute left-0 top-0 h-full w-1", barColor)} />

      <div className="pl-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {label}
        </div>

        <div
          className={cx(
            "mt-1 text-3xl font-semibold tracking-tight",
            valueColor
          )}
        >
          {shown}
        </div>

        {hint && (
          <div className="mt-1 text-xs text-zinc-400">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= Page ================= */

export default function DashboardPage() {
  const [err, setErr] = useState<string | null>(null);

  const [period, setPeriod] =
    useState<"week" | "month" | "quarter">("week");

  const [people, setPeople] = useState<PersonDto[]>([]);
  const [personId, setPersonId] = useState<string>("");

  const [kpis, setKpis] = useState<KpisDto | null>(null);
  const [assetsMaint, setAssetsMaint] =
    useState<AssetInMaintDto[]>([]);
  const [activity, setActivity] =
    useState<PersonActivityDto | null>(null);

  const selectedPerson = useMemo(
    () => people.find(p => p.id === personId) ?? null,
    [people, personId]
  );

  async function loadAll() {
    setErr(null);
    try {
      const [k, am] = await Promise.all([
        getKpis(),
        getAssetsInMaintenance(),
      ]);
      setKpis(k);
      setAssetsMaint(am);
    } catch (e) {
      if (e && typeof e === "object") {
        const r = e as Record<string, unknown>;
        if (typeof r.message === "string") setErr(r.message);
        else setErr(String(e));
      } else {
        setErr(String(e));
      }
    }
  }

  async function loadPeople() {
    try {
      const ps = await getPeople();
      // getPeople returns PersonSimpleDto[] which matches PersonDto shape used here
      setPeople(ps as unknown as PersonDto[]);
      if (!personId && ps.length > 0) {
        setPersonId(ps[0].id);
      }
    } catch (err) {
      console.error("Failed to load people", err);
    }
  }

  async function loadActivity(pid: string, p: typeof period) {
    try {
      const a = await getPersonActivity(pid, p);
      setActivity(a);
    } catch (err) {
      console.error("Failed to load person activity", err);
    }
  }

  useEffect(() => {
    loadAll();
    loadPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (personId) loadActivity(personId, period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, period]);

  return (
    <AppShell title="Dashboard">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-zinc-400">
          Operational overview (live data)
        </div>

        <button
          onClick={loadAll}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-white/10 px-4 text-sm font-semibold text-zinc-200 ring-1 ring-white/15 hover:bg-white/15"
        >
          Refresh
        </button>
      </div>

      {err && (
        <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
          {err}
        </div>
      )}

      {/* KPI grid */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="WO Total" value={kpis?.woTotal} hint="All statuses" />
        <KpiCard label="WO Done" value={kpis?.woClosed} hint="Closed" tone="good" />
        <KpiCard label="WO In progress" value={kpis?.woInProgress} hint="Active now" tone="warn" />
        <KpiCard label="PM On time" value={kpis?.pmOnTime} hint="Executed as planned" tone="good" />
        <KpiCard label="PM Late" value={kpis?.pmLate} hint="Overdue" tone="bad" />
        <KpiCard
          label="Assets in maintenance"
          value={kpis?.assetsInMaintenance}
          hint="WO InProgress"
        />
      </div>

      {/* Employee activity */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-200">
              Activitate angajat
            </div>
            <div className="text-xs text-zinc-400">
              Perioada selectata
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-zinc-900/60 px-3 text-sm text-zinc-100"
            >
              {people.map(p => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>

            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "week" | "month" | "quarter")}
              className="h-10 rounded-xl border border-white/10 bg-zinc-900/60 px-3 text-sm text-zinc-100"
            >
              <option value="week">Saptamana</option>
              <option value="month">Luna</option>
              <option value="quarter">Trimestru</option>
            </select>
          </div>
        </div>

        <div className="mt-3 text-sm text-zinc-300">
          {selectedPerson ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Total WO: <b>{activity?.woTotal ?? "—"}</b></span>
              <span>Done: <b>{activity?.woClosed ?? "—"}</b></span>
              <span>InProgress: <b>{activity?.woInProgress ?? "—"}</b></span>
              <span>Total min: <b>{activity?.totalDurationMinutes ?? "—"}</b></span>
            </div>
          ) : (
            <div>Nu exista angajati.</div>
          )}
        </div>
      </div>

      {/* Assets in maintenance */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 text-sm font-semibold text-zinc-200">
          Utilaje in mentenanta
        </div>
        <div className="mb-3 text-xs text-zinc-400">
          Utilaje cu Work Order InProgress
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-white/5 text-zinc-300">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Utilaj</th>
                <th className="px-3 py-2 text-left font-semibold">Locatie</th>
                <th className="px-3 py-2 text-left font-semibold">Work Order</th>
                <th className="px-3 py-2 text-left font-semibold">Asignat</th>
                <th className="px-3 py-2 text-left font-semibold">Start</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {assetsMaint.map((x) => (
                <tr key={x.assetId} className="hover:bg-white/5">
                  <td className="px-3 py-2 text-zinc-100">
                    {x.assetName}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">
                    {x.locationName ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">
                    {x.workOrderTitle}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">
                    {x.assignedToName ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">
                    {fmtDate(x.startAt)}
                  </td>
                </tr>
              ))}

              {assetsMaint.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-zinc-400"
                  >
                    Nu exista utilaje cu WO InProgress.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </AppShell>
  );
}
