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
  getUnitWorkSchedule,
  updateUnitWorkSchedule,
  updateBlackout,
} from "../api/calendar";
import { hasPerm } from "../api";
import type { CalendarDayDto, UnitWorkSchedule } from "../api/calendar";

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
          { key: "unit-schedule", label: "Program de lucru Unitate" },
        ]}
        defaultValue="holidays"
        render={(activeKey) => (
          <div className="mt-4">
            {activeKey === "holidays" && <HolidaysPanel year={year} />}
            {activeKey === "blackouts" && <BlackoutsPanel year={year} />}
            {activeKey === "unit-schedule" && <UnitSchedulePanel />}
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
  const [includeDeleted, setIncludeDeleted] = useState(false);

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
      const data = await listHolidays(year, includeDeleted);
      setItems(data);
    } catch (err) {
      setError(getErrMessage(err) || "Eroare la incarcarea sarbatorilor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [year, includeDeleted]);

  async function handleAdd() {
    if (!date) return;
    try {
      setSubmitting(true);
      await addHoliday({ date, name });
      setDate("");
      setName("");
      await load();
    } catch (err) {
      setError(getErrMessage(err) || "Eroare la adaugarea sarbatorii.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(d: string) {
    if (!confirm("Sunteti sigur?")) return;
    try {
      setSubmitting(true);
      const simpleDate = d.split("T")[0];
      await deleteHoliday(simpleDate);
      await load();
    } catch (err) {
      setError(getErrMessage(err) || "Eroare la stergerea sarbatorii.");
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
      setError(getErrMessage(err) || "Eroare la actualizarea sarbatorii.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRestore(d: string) {
    try {
      setSubmitting(true);
      const simpleDate = d.split("T")[0];
      // Backend: POSTing to an existing but inactive record re-activates it.
      // Or we could have a specific restore endpoint, but the current POST logic supports it.
      const it = items.find(x => x.date.startsWith(simpleDate));
      await addHoliday({ date: simpleDate, name: it?.name });
      await load();
    } catch (err) {
      setError(getErrMessage(err) || "Eroare la restaurarea sarbatorii.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex-1 w-full max-w-2xl flex flex-col gap-4 md:flex-row md:items-end">
          {hasPerm("CALENDAR_UPDATE") && (
            <div className="w-full md:w-48">
              <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
          {hasPerm("CALENDAR_UPDATE") && (
            <div className="flex-1">
              <Input
                label="Nume Sarbatoare"
                placeholder="Ex: Paste, Craciun..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          {hasPerm("CALENDAR_UPDATE") && (
            <Button variant="primary" onClick={handleAdd} disabled={!date || submitting}>
              Adauga
            </Button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-zinc-700 bg-zinc-800 text-teal-500"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
          />
          Arata sterse
        </label>
      </div>

      {loading ? (
        <div className="py-8 text-center text-zinc-500">Incarcare...</div>
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
                <th className="px-4 py-3 text-right">Actiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((it) => {
                const simpleDate = it.date.split("T")[0];
                const isEditing = editingOriginal === simpleDate;
                const isDeleted = !it.isAct;

                return (
                  <tr key={it.date} className={`hover:bg-white/5 transition-opacity ${isDeleted ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-3 font-mono text-zinc-200">
                      <div className="flex items-center gap-2">
                        {simpleDate}
                        {isDeleted && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">Sters</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      ) : (
                        <span className={isDeleted ? 'line-through' : ''}>{it.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <Button variant="ghost" onClick={cancelEdit} disabled={submitting}>Renunta</Button>
                            <Button variant="primary" onClick={() => handleUpdate(simpleDate)} disabled={submitting}>Salveaza</Button>
                          </>
                        ) : isDeleted ? (
                          hasPerm("CALENDAR_UPDATE") && <Button variant="ghost" className="text-teal-400" onClick={() => handleRestore(it.date)} disabled={submitting}>Restaureaza</Button>
                        ) : (
                          hasPerm("CALENDAR_UPDATE") && (
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
                          )
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
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // Form
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Edit state
  const [editingOriginal, setEditingOriginal] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await listBlackouts(year, includeDeleted);
      setItems(data);
    } catch (err) {
      setError(getErrMessage(err) || "Eroare la incarcarea zilelor inchise.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [year, includeDeleted]);

  async function handleAdd() {
    if (!date) return;
    try {
      setSubmitting(true);
      await addBlackout({ date, name });
      setDate("");
      setName("");
      await load();
    } catch (err) {
      setError(getErrMessage(err) || "Eroare la adaugarea zilei inchise.");
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
      setError(getErrMessage(err) || "Eroare la stergerea zilei inchise.");
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
      await updateBlackout(originalIso, { date: originalIso, name: editName });
      cancelEdit();
      await load();
    } catch (err) {
      setError(getErrMessage(err) || "Eroare la actualizarea zilei inchise.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRestore(d: string) {
    try {
      setSubmitting(true);
      const simpleDate = d.split("T")[0];
      const it = items.find(x => x.date.startsWith(simpleDate));
      await addBlackout({ date: simpleDate, name: it?.name });
      await load();
    } catch (err) {
      setError(getErrMessage(err) || "Eroare la restaurarea zilei inchise.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex-1 w-full max-w-2xl flex flex-col gap-4 md:flex-row md:items-end">
          {hasPerm("CALENDAR_UPDATE") && (
            <div className="w-full md:w-48">
              <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
          {hasPerm("CALENDAR_UPDATE") && (
            <div className="flex-1">
              <Input
                label="Motiv / Nume"
                placeholder="Ex: Inventar, Revizie Generala..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          {hasPerm("CALENDAR_UPDATE") && (
            <Button variant="primary" onClick={handleAdd} disabled={!date || submitting}>
              Adauga
            </Button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-zinc-700 bg-zinc-800 text-teal-500"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
          />
          Arata sterse
        </label>
      </div>

      {loading ? (
        <div className="py-8 text-center text-zinc-500">Incarcare...</div>
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
                <th className="px-4 py-3 text-right">Actiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((it) => {
                const simpleDate = it.date.split("T")[0];
                const isEditing = editingOriginal === simpleDate;
                const isDeleted = !it.isAct;

                return (
                  <tr key={it.date} className={`hover:bg-white/5 transition-opacity ${isDeleted ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-3 font-mono text-zinc-200">
                      <div className="flex items-center gap-2">
                        {simpleDate}
                        {isDeleted && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">Sters</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      ) : (
                        <span className={isDeleted ? 'line-through' : ''}>{it.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <Button variant="ghost" onClick={cancelEdit} disabled={submitting}>Renunta</Button>
                            <Button variant="primary" onClick={() => handleUpdate(simpleDate)} disabled={submitting}>Salveaza</Button>
                          </>
                        ) : isDeleted ? (
                          hasPerm("CALENDAR_UPDATE") && <Button variant="ghost" className="text-teal-400" onClick={() => handleRestore(it.date)} disabled={submitting}>Restaureaza</Button>
                        ) : (
                          hasPerm("CALENDAR_UPDATE") && (
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
                          )
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

function UnitSchedulePanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [schedule, setSchedule] = useState<UnitWorkSchedule | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [monFriStart, setMonFriStart] = useState("08:00");
  const [monFriEnd, setMonFriEnd] = useState("17:00");
  const [satOpen, setSatOpen] = useState(false);
  const [satStart, setSatStart] = useState("08:00");
  const [satEnd, setSatEnd] = useState("12:00");
  const [sunOpen, setSunOpen] = useState(false);
  const [sunStart, setSunStart] = useState("08:00");
  const [sunEnd, setSunEnd] = useState("12:00");

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await getUnitWorkSchedule();
      setSchedule(data);
      // Initialize form
      setMonFriStart(data.monFriStart.substring(0, 5));
      setMonFriEnd(data.monFriEnd.substring(0, 5));

      if (data.satStart && data.satEnd) {
        setSatOpen(true);
        setSatStart(data.satStart.substring(0, 5));
        setSatEnd(data.satEnd.substring(0, 5));
      } else {
        setSatOpen(false);
      }

      if (data.sunStart && data.sunEnd) {
        setSunOpen(true);
        setSunStart(data.sunStart.substring(0, 5));
        setSunEnd(data.sunEnd.substring(0, 5));
      } else {
        setSunOpen(false);
      }
    } catch (err) {
      setError(getErrMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    // Basic validation
    if (monFriEnd <= monFriStart) {
      setError("Luni-Vineri: Ora pana la trebuie sa fie dupa ora de la.");
      return;
    }
    if (satOpen && satEnd <= satStart) {
      setError("Sambata: Ora pana la trebuie sa fie dupa ora de la.");
      return;
    }
    if (sunOpen && sunEnd <= sunStart) {
      setError("Duminica: Ora pana la trebuie sa fie dupa ora de la.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await updateUnitWorkSchedule({
        monFriStart: monFriStart + ":00",
        monFriEnd: monFriEnd + ":00",
        satStart: satOpen ? satStart + ":00" : null,
        satEnd: satOpen ? satEnd + ":00" : null,
        sunStart: sunOpen ? sunStart + ":00" : null,
        sunEnd: sunOpen ? sunEnd + ":00" : null,
      });
      setEditMode(false);
      await load();
    } catch (err) {
      setError(getErrMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="py-8 text-center text-zinc-500">Incarcare...</div>;

  return (
    <Card title="Program de lucru Unitate de productie">
      {error && <ErrorBox message={error} onClose={() => setError(null)} />}

      <div className="space-y-8 max-w-2xl">
        {/* Luni-Vineri */}
        <section className="flex flex-col gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-zinc-100 font-semibold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
              Luni – Vineri
            </h3>
            {!editMode && <span className="text-xs font-medium px-2 py-1 rounded bg-teal-400/10 text-teal-400 border border-teal-400/20">Deschis</span>}
          </div>

          {editMode ? (
            <div className="flex flex-wrap items-center gap-4">
              <Input label="De la" type="time" value={monFriStart} onChange={e => setMonFriStart(e.target.value)} />
              <Input label="Pana la" type="time" value={monFriEnd} onChange={e => setMonFriEnd(e.target.value)} />
            </div>
          ) : (
            <div className="text-zinc-400 text-sm">
              Interval: <span className="text-zinc-200 font-mono text-lg ml-2">{monFriStart} – {monFriEnd}</span>
            </div>
          )}
        </section>

        {/* Sambata */}
        <section className="flex flex-col gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-zinc-100 font-semibold flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${satOpen ? 'bg-amber-400' : 'bg-zinc-600'}`}></span>
              Sambata
            </h3>
            {!editMode && (
              <span className={`text-xs font-medium px-2 py-1 rounded border ${satOpen ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                {satOpen ? "Deschis" : "Inchis"}
              </span>
            )}
            {editMode && (
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input type="checkbox" className="rounded border-zinc-700 bg-zinc-800 text-teal-500" checked={satOpen} onChange={e => setSatOpen(e.target.checked)} />
                Deschis Sambata
              </label>
            )}
          </div>

          {editMode ? (
            <div className={`flex flex-wrap items-center gap-4 transition-opacity ${satOpen ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <Input label="De la" type="time" value={satStart} onChange={e => setSatStart(e.target.value)} disabled={!satOpen} />
              <Input label="Pana la" type="time" value={satEnd} onChange={e => setSatEnd(e.target.value)} disabled={!satOpen} />
            </div>
          ) : (
            satOpen ? (
              <div className="text-zinc-400 text-sm">
                Interval: <span className="text-zinc-200 font-mono text-lg ml-2">{satStart} – {satEnd}</span>
              </div>
            ) : (
              <div className="text-zinc-500 text-sm italic">Unitatea este inchisa sambata.</div>
            )
          )}
        </section>

        {/* Duminica */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-zinc-100 font-semibold flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${sunOpen ? 'bg-amber-400' : 'bg-zinc-600'}`}></span>
              Duminica
            </h3>
            {!editMode && (
              <span className={`text-xs font-medium px-2 py-1 rounded border ${sunOpen ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                {sunOpen ? "Deschis" : "Inchis"}
              </span>
            )}
            {editMode && (
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input type="checkbox" className="rounded border-zinc-700 bg-zinc-800 text-teal-500" checked={sunOpen} onChange={e => setSunOpen(e.target.checked)} />
                Deschis Duminica
              </label>
            )}
          </div>

          {editMode ? (
            <div className={`flex flex-wrap items-center gap-4 transition-opacity ${sunOpen ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
              <Input label="De la" type="time" value={sunStart} onChange={e => setSunStart(e.target.value)} disabled={!sunOpen} />
              <Input label="Pana la" type="time" value={sunEnd} onChange={e => setSunEnd(e.target.value)} disabled={!sunOpen} />
            </div>
          ) : (
            sunOpen ? (
              <div className="text-zinc-400 text-sm">
                Interval: <span className="text-zinc-200 font-mono text-lg ml-2">{sunStart} – {sunEnd}</span>
              </div>
            ) : (
              <div className="text-zinc-500 text-sm italic">Unitatea este inchisa duminica.</div>
            )
          )}
        </section>

        <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
          {editMode ? (
            <>
              <Button onClick={() => { setEditMode(false); load(); }} disabled={submitting}>Anuleaza</Button>
              <Button variant="primary" onClick={handleSave} disabled={submitting}>
                {submitting ? "Se salveaza..." : "Salveaza"}
              </Button>
            </>
          ) : (
            hasPerm("CALENDAR_UPDATE") && <Button variant="primary" onClick={() => setEditMode(true)}>Modifica Program Lucru</Button>
          )}
        </div>
      </div>

      {schedule?.updatedAtUtc && (
        <div className="mt-8 text-[10px] text-zinc-500 uppercase tracking-widest text-right">
          Ultima actualizare: {new Date(schedule.updatedAtUtc).toLocaleString()}
        </div>
      )}
    </Card>
  );
}

