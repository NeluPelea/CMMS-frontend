// src/pages/LocationsPage.tsx
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { createLoc, deleteLoc, getLocs, type LocDto } from "../api";
import {
  Button,
  Card,
  EmptyRow,
  ErrorBox,
  Input,
  PageToolbar,
  Pill,
  TableShell,
  cx,
} from "../components/ui";

function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <Pill tone={isActive ? "emerald" : "zinc"}>
      {isActive ? "Active" : "Deleted"}
    </Pill>
  );
}

export default function LocationsPage() {
  const [items, setItems] = useState<LocDto[]>([]);
  const [q, setQ] = useState("");
  const [showDel, setShowDel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");

  const canCreate = useMemo(() => newName.trim().length >= 2, [newName]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await getLocs({
        q: q.trim() || undefined,
        take: 500,
        ia: showDel,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDel]);

  async function onCreate() {
    if (!canCreate) return;
    setErr(null);
    try {
      await createLoc({
        name: newName.trim(),
        code: newCode.trim() ? newCode.trim() : null,
      });
      setNewName("");
      setNewCode("");
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onDelete(id: string, isActive: boolean) {
    if (!isActive) return;
    if (!confirm("Delete location?")) return;

    setErr(null);
    try {
      await deleteLoc(id);
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <AppShell title="Locations">
      <PageToolbar
        left={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:max-w-md">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
                placeholder="Search locations..."
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={showDel}
                onChange={(e) => setShowDel(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/10"
              />
              Show deleted
            </label>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <Button onClick={load} disabled={loading} variant="ghost">
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        }
      />

      {err ? <ErrorBox message={err} /> : null}

      <Card title="New Location">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
          />

          <Input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Code (optional)"
          />

          <Button
            onClick={onCreate}
            disabled={!canCreate}
            variant="primary"
            className="w-full lg:w-auto"
          >
            Create
          </Button>
        </div>

        <div className="mt-2 text-xs text-zinc-500">
          If "Show deleted" does not change results, backend may not support ia
          filter yet.
        </div>
      </Card>

      <div className="mt-6" />

      <TableShell minWidth={720}>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">Code</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {items.map((x) => {
              const isActive = x.isAct !== false;
              return (
                <tr key={x.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-zinc-100">{x.name}</td>
                  <td className="px-4 py-3 text-zinc-300">{x.code ?? "-"}</td>
                  <td className="px-4 py-3">
                    <StatusPill isActive={isActive} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      onClick={() => onDelete(x.id, isActive)}
                      disabled={!isActive}
                      variant="ghost"
                      className={cx(
                        "h-8 px-3 text-xs",
                        isActive
                          ? "text-zinc-200"
                          : "text-zinc-500 opacity-70"
                      )}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              );
            })}

            {!loading && items.length === 0 ? (
              <EmptyRow colSpan={4} text="No locations." />
            ) : null}
          </tbody>
        </table>
      </TableShell>
    </AppShell>
  );
}
