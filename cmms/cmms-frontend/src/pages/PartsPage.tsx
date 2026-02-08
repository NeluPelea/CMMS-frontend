// src/pages/PartsPage.tsx
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { createPart, getParts, type PartDto } from "../api";
import {
  Button,
  Card,
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

function StatusPill({ active }: { active: boolean }) {
  return (
    <Pill tone={active ? "emerald" : "zinc"}>{active ? "Active" : "Inactive"}</Pill>
  );
}

// ---------------- page ----------------

export default function PartsPage() {
  const [items, setItems] = useState<PartDto[]>([]);
  const [q, setQ] = useState("");
  const [ia, setIa] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // create form
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [uom, setUom] = useState("");

  const canCreate = useMemo(() => name.trim().length >= 2, [name]);

  const stats = useMemo(() => {
    const total = items.length;
    const inactive = items.filter((x) => x.isAct === false).length;
    return { total, inactive };
  }, [items]);

  async function load(nextQ?: string, nextIa?: boolean) {
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
      const created = await createPart({
        name: name.trim(),
        code: code.trim() ? code.trim() : null,
        uom: uom.trim() ? uom.trim() : null,
      });

      setName("");
      setCode("");
      setUom("");

      // keep behavior: prepend created row
      setItems((prev) => [created, ...prev]);
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
        left={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="w-full sm:w-80">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load(e.currentTarget.value);
                }}
                placeholder="Search name / code..."
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={ia}
                onChange={(e) => {
                  const v = e.target.checked;
                  setIa(v);
                  // optional: immediate refresh when toggled
                  load(undefined, v);
                }}
                className="h-4 w-4 rounded border-white/20 bg-white/10"
              />
              Include inactive
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

      <Card title="Creeaza Piesa">
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
            />
          </div>

          <div className="lg:col-span-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code (optional)"
            />
          </div>

          <div className="lg:col-span-3">
            <Input
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              placeholder="UoM (buc, m, kg...)"
            />
          </div>

          <div className="lg:col-span-12 flex justify-end">
            <Button onClick={onCreate} disabled={!canCreate} variant="primary">
              Create
            </Button>
          </div>

          <div className="lg:col-span-12 text-xs text-zinc-500">
            Tip: Code si UoM sunt optionale. Dupa creare, randul apare primul in lista (MVP).
          </div>
        </div>
      </Card>

      <div className="mt-6" />

      <TableShell minWidth={820}>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">Code</th>
              <th className="px-4 py-3 text-left font-semibold">UoM</th>
              <th className="px-4 py-3 text-right font-semibold">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {items.map((x) => (
              <tr key={x.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-zinc-100 font-medium">{x.name}</td>
                <td className="px-4 py-3 text-zinc-300">{x.code ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-300">{x.uom ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <StatusPill active={x.isAct !== false} />
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <EmptyRow colSpan={4} text="Nu exista piese." />
            ) : null}
          </tbody>
        </table>
      </TableShell>
    </AppShell>
  );
}


