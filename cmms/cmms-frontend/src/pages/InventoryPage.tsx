// src/pages/InventoryPage.tsx
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { adjustInventory, getInventory, type InventoryRowDto } from "../api";
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
} from "../components/ui";

// ---------------- helpers ----------------

function safeArray<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

// accepts "2,5" or "2.5"
function parseNumberLoose(input: string): number | null {
  const s = (input ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

// ---------------- page ----------------

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryRowDto[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // quick adjust
  const [selId, setSelId] = useState<string>("");
  const selected = useMemo(
    () => items.find((x) => x.id === selId) || null,
    [items, selId]
  );
  const [delta, setDelta] = useState<string>("");

  const stats = useMemo(() => {
    const totalRows = items.length;
    const totalQty = items.reduce((s, x) => s + (Number(x.qtyOnHand) || 0), 0);
    return { totalRows, totalQty };
  }, [items]);

  async function load(nextQ?: string) {
    const qq = (typeof nextQ === "string" ? nextQ : q).trim();
    setLoading(true);
    setErr(null);
    try {
      const data = await getInventory({ q: qq || undefined, take: 500 });
      const list = safeArray<InventoryRowDto>(data);
      setItems(list);

      // keep selection stable
      if (!selId && list.length) setSelId(list[0].id);
      if (selId && !list.some((x) => x.id === selId) && list.length) {
        setSelId(list[0].id);
      }
      if (list.length === 0) setSelId("");
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
      setSelId("");
    } finally {
      setLoading(false);
    }
  }

  async function onAdjust() {
    if (!selected) return;

    setErr(null);
    const n = parseNumberLoose(delta);

    if (n == null || n === 0) {
      setErr("Delta must be a non-zero number (ex: 1, -0.5, 2,5).");
      return;
    }

    try {
      await adjustInventory(selected.id, n);
      setDelta("");
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell title="Inventory">
      <PageToolbar
        left={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="w-full sm:w-80">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load(e.currentTarget.value);
                }}
                placeholder="Search part name / code..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="zinc">Rows: {stats.totalRows}</Pill>
              <Pill tone="teal">Total qty: {Math.round(stats.totalQty * 100) / 100}</Pill>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <Button onClick={() => load()} disabled={loading} variant="ghost">
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        }
      />

      {err ? <ErrorBox message={err} /> : null}

      <Card title="Adjust stock">
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Item
            </div>
            <Select value={selId} onChange={(e) => setSelId(e.target.value)}>
              <option value="" disabled>
                {items.length ? "Select inventory row..." : "No inventory rows"}
              </option>
              {items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.partName}
                  {x.partCode ? ` (${x.partCode})` : ""} | on hand: {x.qtyOnHand}
                </option>
              ))}
            </Select>
          </div>

          <div className="lg:col-span-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Delta
            </div>
            <Input
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="ex: 1, -0.5, 2,5"
            />
            <div className="mt-1 text-xs text-zinc-500">
              Positive adds stock, negative removes stock.
            </div>
          </div>

          <div className="lg:col-span-2 flex items-end">
            <Button
              onClick={onAdjust}
              disabled={!selected || loading}
              variant="primary"
            >
              Apply
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-6" />

      <TableShell minWidth={820}>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Part</th>
              <th className="px-4 py-3 text-left font-semibold">Code</th>
              <th className="px-4 py-3 text-left font-semibold">UoM</th>
              <th className="px-4 py-3 text-right font-semibold">On hand</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {items.map((x) => (
              <tr key={x.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-zinc-100 font-medium">
                  {x.partName}
                </td>
                <td className="px-4 py-3 text-zinc-300">{x.partCode ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-300">{x.uom ?? "—"}</td>
                <td className="px-4 py-3 text-right font-semibold text-zinc-100">
                  {x.qtyOnHand}
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <EmptyRow colSpan={4} text="No inventory rows." />
            ) : null}
          </tbody>
        </table>
      </TableShell>
    </AppShell>
  );
}


