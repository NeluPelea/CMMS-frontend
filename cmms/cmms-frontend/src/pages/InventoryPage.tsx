// src/pages/InventoryPage.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import AppShell from "../components/AppShell";
import { getInventory, type InventoryRowDto } from "../api";
import {
  Button,
  EmptyRow,
  ErrorBox,
  Input,
  PageToolbar,
  Pill,
  TableShell,
} from "../components/ui";

// ---------------- helpers ----------------

function safeArray<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

// ---------------- page ----------------

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryRowDto[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastReq = useRef(0);

  const stats = useMemo(() => {
    const totalRows = items.length;
    const totalQty = items.reduce((s, x) => s + (Number(x.qtyOnHand) || 0), 0);
    return { totalRows, totalQty };
  }, [items]);

  async function load(nextQ?: string) {
    const reqId = ++lastReq.current;
    const qq = (typeof nextQ === "string" ? nextQ : q).trim();
    setLoading(true);
    setErr(null);
    try {
      const data = await getInventory({ q: qq || undefined, take: 500 });
      if (reqId !== lastReq.current) return;

      const list = safeArray<InventoryRowDto>(data);
      setItems(list);
    } catch (e: any) {
      if (reqId !== lastReq.current) return;
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      if (reqId === lastReq.current) setLoading(false);
    }
  }

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      load();
    }, 400);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <AppShell title="Inventar">
      <PageToolbar
        left={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="w-full sm:w-80">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cauta nume piesa / cod..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="zinc">Randuri: {stats.totalRows}</Pill>
              <Pill tone="teal">Cantitate totala: {Math.round(stats.totalQty * 100) / 100}</Pill>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <Button onClick={() => load()} disabled={loading} variant="ghost">
              {loading ? "Incarcare..." : "Actualizeaza"}
            </Button>
          </div>
        }
      />

      {err ? <ErrorBox message={err} /> : null}

      {err ? <ErrorBox message={err} /> : null}

      <div className="mt-6" />

      <div className="mt-6" />

      <TableShell minWidth={820}>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-4 py-1.5 text-left font-semibold">Cod SKU</th>
              <th className="px-4 py-1.5 text-left font-semibold">Articol</th>
              <th className="px-4 py-1.5 text-right font-semibold">Cantitate</th>
              <th className="px-4 py-1.5 text-right font-semibold">Cant minima</th>
              <th className="px-4 py-1.5 text-left font-semibold">U.M.</th>
              <th className="px-4 py-1.5 text-right font-semibold">Pret / U.M</th>
              <th className="px-4 py-1.5 text-right font-semibold">Valoare (RON)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {items.map((x) => (
              <tr key={x.id} className="hover:bg-white/5 odd:bg-white/[0.02]">
                <td className="px-4 py-1.5 text-zinc-300">
                  {x.skuCode ?? "—"}
                </td>
                <td className="px-4 py-1.5 text-zinc-100 font-medium">
                  {x.partName}
                </td>
                <td className="px-4 py-1.5 text-right font-semibold text-zinc-100">
                  {x.qtyOnHand}
                </td>
                <td className="px-4 py-1.5 text-right text-zinc-300">
                  {x.minQty ? x.minQty : 0}
                </td>
                <td className="px-4 py-1.5 text-zinc-300">{x.uom ?? "—"}</td>
                <td className="px-4 py-1.5 text-right text-zinc-300">
                  {x.unitPriceRon != null ? x.unitPriceRon.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-1.5 text-right text-zinc-300 font-mono">
                  {x.valueRon != null ? x.valueRon.toFixed(2) : "—"}
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <EmptyRow colSpan={7} text="Nu exista randuri de inventar." />
            ) : null}

            {!loading && items.length > 0 && (
              <tr className="bg-white/5 font-semibold text-zinc-100">
                <td colSpan={6} className="px-4 py-2 text-right uppercase tracking-wider text-xs text-zinc-400">
                  Valoare Totala Inventar
                </td>
                <td className="px-4 py-2 text-right font-mono text-emerald-400">
                  {items.reduce((acc, curr) => acc + (curr.valueRon || 0), 0).toFixed(2)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableShell>
    </AppShell>
  );
}




