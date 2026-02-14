import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { StockAdjustmentTile } from "../components/StockAdjustmentTile";
import { createPart, getParts, setPartStatus, updatePart, type PartDto, hasPerm } from "../api";
import {
  Button,
  Card,
  EmptyRow,
  ErrorBox,
  Input,
  PageToolbar,
  Pill,
  TableShell,
  Select,
} from "../components/ui";

// ---------------- helpers ----------------

function safeArray<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <Pill tone={active ? "emerald" : "zinc"}>{active ? "Active" : "Inactive"}</Pill>
  );
}

// ---------------- page ----------------

export default function PartsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PartDto[]>([]);
  // ... (existing search state)
  const [q, setQ] = useState("");
  const [ia, setIa] = useState(false);

  // ... (existing ui state)
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // create form
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [uom, setUom] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("RON"); // NEW State
  const [minQty, setMinQty] = useState("");

  const canCreate = useMemo(() => name.trim().length >= 2, [name]);

  const stats = useMemo(() => {
    // ... existing stats logic
    const total = items.length;
    const inactive = items.filter((x) => x.isAct === false).length;
    return { total, inactive };
  }, [items]);

  async function load(nextQ?: string, nextIa?: boolean) {
    // ... existing load function
    const qq = (typeof nextQ === "string" ? nextQ : q).trim();
    const includeInactive = typeof nextIa === "boolean" ? nextIa : ia;

    setLoading(true);
    setErr(null);
    try {
      const data = await getParts({
        q: qq || undefined,
        ia: includeInactive,
        take: 500,
      });
      setItems(safeArray<PartDto>(data));
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function onCreate() {
    if (!canCreate) return;
    setErr(null);
    try {
      const p = parseFloat(price);
      const mq = parseFloat(minQty);

      const created = await createPart({
        name: name.trim(),
        code: code.trim() ? code.trim() : null,
        uom: uom.trim() ? uom.trim() : null,
        purchasePrice: !isNaN(p) ? p : null,
        purchaseCurrency: currency, // USE State
        minQty: !isNaN(mq) ? mq : 0,
      });

      setName("");
      setCode("");
      setUom("");
      setPrice("");
      setMinQty("");
      setCurrency("RON"); // Reset

      // keep behavior: prepend created row
      setItems((prev) => [created, ...prev]);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  // ... (existing onUpdateMinQty and onToggle)
  async function onUpdateMinQty(id: string, newVal: string) {
    const v = parseFloat(newVal);
    if (isNaN(v) || v < 0) return; // ignore invalid

    try {
      await updatePart(id, { minQty: v });
      // update local state
      setItems(prev => prev.map(x => x.id === id ? { ...x, minQty: v } : x));
    } catch (e: any) {
      setErr("Failed to update min qty: " + e.message);
    }
  }

  async function onToggle(p: PartDto) {
    if (loading) return;

    // Client-side validation for quick feedback
    if (p.isAct) {
      if (p.hasStock) {
        alert("Nu se poate inactiva: piesa are stoc.");
        return;
      }
      if (p.hasConsumption) {
        alert("Nu se poate inactiva: piesa are istoric de consum.");
        return;
      }
    }

    try {
      await setPartStatus(p.id, !p.isAct);
      // Refresh to reflect changes
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
    <AppShell title="Piese de schimb">
      <PageToolbar
        // ... (existing toolbar)
        left={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Button variant="ghost" onClick={() => navigate("/procurement")} className="px-2">
              <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Button>
            <div className="w-full sm:w-80">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load(e.currentTarget.value);
                }}
                placeholder="Cautare dupa Articol / SKU"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={ia}
                onChange={(e) => {
                  const v = e.target.checked;
                  setIa(v);
                  load(undefined, v);
                }}
                className="h-4 w-4 rounded border-white/20 bg-white/10"
              />
              Include articole inactive
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="zinc">Rows: {stats.total}</Pill>
              {stats.inactive > 0 ? (
                <Pill tone="amber">Inactive: {stats.inactive}</Pill>
              ) : (
                <Pill tone="emerald">All active</Pill>
              )}
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <Button onClick={() => load()} disabled={loading} variant="ghost">
              {loading ? "Loading..." : "Refresh"}
            </Button>
            <Button onClick={() => load()} disabled={loading} variant="primary">
              Apply
            </Button>
          </div>
        }
      />

      {err ? <ErrorBox message={err} /> : null}

      {hasPerm("PARTS_CREATE") && (
        <Card title="Creeaza Piesa">
          <div className="grid gap-3 lg:grid-cols-12 items-end">
            <div className="lg:col-span-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Nume Piesa
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
              />
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Cod SKU
              </div>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Cod SKU"
              />
            </div>

            <div className="lg:col-span-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                U.M.
              </div>
              <Input
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                placeholder="U.M"
              />
            </div>

            <div className="lg:col-span-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Min Qty
              </div>
              <Input
                type="number"
                min="0"
                value={minQty}
                onChange={e => setMinQty(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Pret Intrare
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="lg:col-span-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Moneda
              </div>
              <Select value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </Select>
            </div>

            <div className="lg:col-span-1 flex justify-end">
              <Button onClick={onCreate} disabled={!canCreate} variant="primary">
                +
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-6" />

      <StockAdjustmentTile />

      <div className="mt-6" />

      <TableShell minWidth={900}>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-4 py-1 text-left font-semibold">Articol</th>
              <th className="px-4 py-1 text-left font-semibold">Cod SKU</th>
              <th className="px-4 py-1 text-left font-semibold">Cant minima</th>
              <th className="px-4 py-1 text-left font-semibold">U.M.</th>
              <th className="px-4 py-1 text-right font-semibold">Pret / U.M</th>
              <th className="px-4 py-1 text-left font-semibold w-20">Moneda</th>
              <th className="px-4 py-1 text-right font-semibold">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {items.map((x) => (
              <tr key={x.id} className="hover:bg-white/5 odd:bg-white/[0.02]">
                <td className="px-4 py-1 text-zinc-100 font-medium">{x.name}</td>
                <td className="px-4 py-1 text-zinc-300">{x.code ?? "—"}</td>
                <td className="px-4 py-1 text-zinc-300">
                  {hasPerm("PARTS_UPDATE") ? (
                    <input
                      type="number"
                      defaultValue={x.minQty}
                      className="w-20 bg-transparent border border-white/10 rounded px-2 py-0.5 text-zinc-300 focus:border-indigo-500 outline-none h-7 text-sm"
                      onBlur={(e) => {
                        if (parseFloat(e.target.value) !== x.minQty) {
                          onUpdateMinQty(x.id, e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  ) : (
                    x.minQty ?? 0
                  )}
                </td>
                <td className="px-4 py-1 text-zinc-300">{x.uom ?? "—"}</td>
                <td className="px-4 py-1 text-right text-zinc-300">
                  {x.purchasePrice != null ? x.purchasePrice.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-1 text-zinc-400 text-xs uppercase">
                  {x.purchaseCurrency || "RON"}
                </td>
                <td className="px-4 py-1 text-right">
                  {hasPerm("PARTS_UPDATE") ? (
                    <button
                      onClick={() => onToggle(x)}
                      disabled={x.isAct && (!!x.hasStock || !!x.hasConsumption)}
                      title={
                        x.isAct && (!!x.hasStock || !!x.hasConsumption)
                          ? "Nu se poate inactiva: exista stoc/consum."
                          : "Click pentru a schimba statusul"
                      }
                      className="disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
                    >
                      <StatusPill active={x.isAct !== false} />
                    </button>
                  ) : (
                    <StatusPill active={x.isAct !== false} />
                  )}
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <EmptyRow colSpan={7} text="Nu exista piese." />
            ) : null}
          </tbody>
        </table>
      </TableShell>
    </AppShell>
  );
}


