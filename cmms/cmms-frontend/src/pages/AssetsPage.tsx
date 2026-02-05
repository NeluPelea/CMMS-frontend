// src/pages/AssetsPage.tsx
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import {
  createAsset,
  deleteAsset,
  getAssets,
  getLocs,
  type AssetDto,
  type LocDto,
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

function StatusPill({ isActive }: { isActive: boolean }) {
  return <Pill tone={isActive ? "emerald" : "zinc"}>{isActive ? "Active" : "Deleted"}</Pill>;
}

export default function AssetsPage() {
  const [items, setItems] = useState<AssetDto[]>([]);
  const [locs, setLocs] = useState<LocDto[]>([]);

  const [q, setQ] = useState("");
  const [showDel, setShowDel] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [locId, setLocId] = useState("");

  const canCreate = useMemo(() => newName.trim().length >= 2, [newName]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await getAssets({
        q: q.trim() || undefined,
        take: 200,
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

  async function loadLocs() {
    try {
      const data = await getLocs({ take: 500 });
      setLocs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setLocs([]);
    }
  }

  useEffect(() => {
    (async () => {
      await loadLocs();
      await load();
    })();
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
      await createAsset({
        name: newName.trim(),
        code: newCode.trim() ? newCode.trim() : null,
        locId: locId ? locId : null,
      });
      setNewName("");
      setNewCode("");
      setLocId("");
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onDelete(id: string, isActive: boolean) {
    if (!isActive) return;
    if (!confirm("Soft delete asset?")) return;
    setErr(null);
    try {
      await deleteAsset(id);
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <AppShell title="Assets">
      <PageToolbar
        left={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
                placeholder="Search assets..."
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

      <Card title="New Asset">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

          <Select value={locId} onChange={(e) => setLocId(e.target.value)}>
            <option value="">(No location)</option>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>

          <Button onClick={onCreate} disabled={!canCreate} variant="primary">
            Create
          </Button>
        </div>
      </Card>

      <div className="mt-6" />

      <TableShell minWidth={900}>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">Code</th>
              <th className="px-4 py-3 text-left font-semibold">Location</th>
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
                  <td className="px-4 py-3 text-zinc-300">{x.locName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <StatusPill isActive={isActive} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onDelete(x.id, isActive)}
                      disabled={!isActive}
                      className={cx(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold ring-1",
                        isActive
                          ? "bg-white/10 text-zinc-200 ring-white/15 hover:bg-white/15"
                          : "bg-white/5 text-zinc-500 ring-white/10"
                      )}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}

            {!loading && items.length === 0 ? (
              <EmptyRow colSpan={5} text="No assets." />
            ) : null}
          </tbody>
        </table>
      </TableShell>
    </AppShell>
  );
}
