import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import {
  Button,
  Card,
  ErrorBox,
  IconButton,
  Input,
  PageToolbar,
  TableShell,
  Tabs,
} from "../components/ui";
import {
  addBlackout,
  addHoliday,
  deleteBlackout,
  deleteHoliday,
  updateHoliday,
  listBlackouts,
  listHolidays,
} from "../api";
import type { CalendarDayDto } from "../api";

function getErrMessage(err: unknown) {
  if (err && typeof err === "object") {
    const r = err as Record<string, unknown>;
    if (typeof r.message === "string") return r.message;
  }
  return String(err ?? "");
}

export default function CalendarPage() {
  const [year, setYear] = useState(new Date().getFullYear());

  return (
    <AppShell title="Calendar (Zile Libere)">
      <PageToolbar
        left={<div className="text-xl font-bold text-zinc-100">Calendar & Zile Libere</div>}
        right={
          <div className="flex items-center gap-2">
            <Button onClick={() => setYear(year - 1)}>{"<"}</Button>
            <span className="text-zinc-200 font-mono text-lg">{year}</span>
            <Button onClick={() => setYear(year + 1)}>{">"}</Button>
          </div>
        }
      />

      <Tabs
        items={[
          { key: "holidays", label: "Sarbatori Nationale" },
          { key: "blackouts", label: "Zile Inchise (Companie)" },
        ]}
        defaultValue="holidays"
        render={(activeKey) => (
          <div className="mt-4">
            {activeKey === "holidays" && <HolidaysPanel year={year} />}
            {activeKey === "blackouts" && <BlackoutsPanel year={year} />}
          </div>
        )}
      />
    </AppShell>
  );
}

function HolidaysPanel({ year }: { year: number }) {
  const [items, setItems] = useState<CalendarDayDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Edit state (per-row)
  const [editingOriginal, setEditingOriginal] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function getErrMessage(err: unknown) {
    if (err && typeof err === "object") {
      const r = err as Record<string, unknown>;
      if (typeof r.message === "string") return r.message;
    }
    return String(err ?? "");
  }

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await listHolidays(year);
      setItems(data);
    } catch (err) {
      setError(getErrMessage(err) || "Failed to load holidays.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [year]);

  async function handleAdd() {
    if (!date) return;
    try {
      setSubmitting(true);
      await addHoliday({ date, name });
      setDate("");
      setName("");
      await load();
    } catch (err) {
      setError(getErrMessage(err) || "Failed to add holiday.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(d: string) {
    if (!confirm("Are you sure?")) return;
    try {
      setSubmitting(true);
      // d might be full ISO string, we need yyyy-MM-dd
      const simpleDate = d.split("T")[0];
      await deleteHoliday(simpleDate);
      await load();
    } catch (err) {
      setError(getErrMessage(err) || "Failed to delete holiday.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(it: CalendarDayDto) {
    const simpleDate = it.date.split("T")[0];
    setEditingOriginal(simpleDate);
    setEditName(it.name ?? "");
  }

  function cancelEdit() {
    setEditingOriginal(null);
    setEditName("");
  }

  async function handleUpdate(originalIso: string) {
    try {
      setSubmitting(true);
      // only update the name, keep date identifier the same
      await updateHoliday(originalIso, { date: originalIso, name: editName });
      cancelEdit();
      await load();
    } catch (err) {
      setError(getErrMessage(err) || "Failed to update holiday.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      {/* Add Form */}
      <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div className="w-full md:w-48">
          <Input
            label="Data"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Input
            label="Nume Sarbatoare"
            placeholder="Ex: Paste, Craciun..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button variant="primary" onClick={handleAdd} disabled={!date || submitting}>
          Adauga
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-8 text-center text-zinc-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-zinc-500">
          Nu exista sarbatori definite pentru {year}.
        </div>
      ) : (
        <TableShell>
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-white/5 text-zinc-400">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Nume</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((it) => {
                const simpleDate = it.date.split("T")[0];
                const isEditing = editingOriginal === simpleDate;
                return (
                  <tr key={it.date} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-mono text-zinc-200">{simpleDate}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      ) : (
                        it.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <Button variant="ghost" onClick={cancelEdit} disabled={submitting}>Cancel</Button>
                            <Button variant="primary" onClick={() => handleUpdate(simpleDate)} disabled={submitting}>Save</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" onClick={() => startEdit(it)} disabled={submitting}>Modifica</Button>
                            <IconButton
                              aria-label="Sterge"
                              variant="danger"
                              onClick={() => handleDelete(it.date)}
                              disabled={submitting}
                            >
                              🗑️
                            </IconButton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}
    </Card>
  );
}

function BlackoutsPanel({ year }: { year: number }) {
  const [items, setItems] = useState<CalendarDayDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await listBlackouts(year);
      setItems(data);
    } catch (err) {
      setError(getErrMessage(err) || "Failed to load blackouts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [year]);

  async function handleAdd() {
    if (!date) return;
    try {
      setSubmitting(true);
      await addBlackout({ date, name });
      setDate("");
      setName("");
      await load();
    } catch (err) {
      setError(getErrMessage(err) || "Failed to add blackout.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(d: string) {
    if (!confirm("Are you sure?")) return;
    try {
      setSubmitting(true);
      const simpleDate = d.split("T")[0];
      await deleteBlackout(simpleDate);
      await load();
    } catch (err) {
      setError(getErrMessage(err) || "Failed to delete blackout.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      {/* Add Form */}
      <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div className="w-full md:w-48">
          <Input
            label="Data"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Input
            label="Motiv / Nume"
            placeholder="Ex: Inventar, Revizie Generala..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button variant="primary" onClick={handleAdd} disabled={!date || submitting}>
          Adauga
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-8 text-center text-zinc-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-zinc-500">
          Nu exista zile inchise pentru {year}.
        </div>
      ) : (
        <TableShell>
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-white/5 text-zinc-400">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Motiv</th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((it) => (
                <tr key={it.date} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-zinc-200">
                    {it.date.split("T")[0]}
                  </td>
                  <td className="px-4 py-3">{it.name}</td>
                  <td className="px-4 py-3 text-right">
                    <IconButton
                      aria-label="Delete"
                      variant="danger"
                      onClick={() => handleDelete(it.date)}
                      disabled={submitting}
                    >
                      🗑️
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </Card>
  );
}
