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

      <ReceiveStockModal
        items={items}
        onConfirm={async (id, qty) => {
          try {
            await adjustInventory(id, qty);
            await load();
          } catch (e: any) {
            alert(e.message || String(e));
          }
        }}
      />

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

function ReceiveStockModal(props: {
  items: InventoryRowDto[];
  onConfirm: (id: string, qty: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);

  // reset when opening
  useEffect(() => {
    if (open) {
      setItemId("");
      setQty("");
      setBusy(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseNumberLoose(qty);
    if (!itemId || !q || q <= 0) return;

    setBusy(true);
    await props.onConfirm(itemId, q);
    setBusy(false);
    setOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-500 text-teal-950 shadow-lg ring-1 ring-teal-400 hover:bg-teal-400 hover:scale-105 transition"
          title="Receive Stock"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">Receive Stock</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
                  Part
                </label>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  value={itemId}
                  onChange={e => setItemId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">-- Select Part --</option>
                  {props.items.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.partName} ({i.qtyOnHand})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
                  Quantity to Add
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder="e.g. 10"
                  disabled={busy}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-200"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !itemId || !qty}
                  className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-teal-400 disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Receive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


