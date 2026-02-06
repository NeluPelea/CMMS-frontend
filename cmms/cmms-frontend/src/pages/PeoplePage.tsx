// src/pages/PeoplePage.tsx
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import {
  activatePerson,
  createPerson,
  deactivatePerson,
  getPeoplePaged,
  type PersonDto,
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

function FieldLabel(props: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
      {props.children}
    </div>
  );
}

export default function PeoplePage() {
  const [items, setItems] = useState<PersonDto[]>([]);
  const [total, setTotal] = useState(0);
  const [take, setTake] = useState(50);
  const [skip, setSkip] = useState(0);

  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const canCreate = useMemo(() => fullName.trim().length >= 3, [fullName]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const page = await getPeoplePaged({
        take,
        skip,
        q: q.trim() || undefined,
        includeInactive,
      });
      setItems(Array.isArray(page.items) ? page.items : []);
      setTotal(page.total ?? 0);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [take, skip, includeInactive]);

  // debounce for search
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSkip(0);
      load();
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function onCreate() {
    if (!canCreate) return;
    setErr(null);
    try {
      await createPerson({
        fullName: fullName.trim(),
        jobTitle: jobTitle.trim() || null,
        specialization: specialization.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        isActive: true,
      });

      setFullName("");
      setJobTitle("");
      setSpecialization("");
      setPhone("");
      setEmail("");

      setSkip(0);
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onToggleActive(p: PersonDto) {
    setErr(null);
    try {
      if (p.isActive) await deactivatePerson(p.id);
      else await activatePerson(p.id);
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  const pageFrom = skip + 1;
  const pageTo = Math.min(skip + take, total);

  return (
    <AppShell title="People">
      <PageToolbar
        left={
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-200">People</div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {total ? `${pageFrom}-${pageTo} / ${total}` : "—"}
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <Button onClick={() => load()} disabled={loading} variant="ghost">
              Refresh
            </Button>
          </div>
        }
      />

      {err ? <ErrorBox message={err} /> : null}

      <Card title="Add person">
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <FieldLabel>Full name</FieldLabel>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ion Popescu"
            />
          </div>

          <div className="lg:col-span-3">
            <FieldLabel>Job title</FieldLabel>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Mecanic"
            />
          </div>

          <div className="lg:col-span-3">
            <FieldLabel>Specialization</FieldLabel>
            <Input
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="Mecanica"
            />
          </div>

          <div className="lg:col-span-2">
            <FieldLabel>Phone</FieldLabel>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07..."
            />
          </div>

          <div className="lg:col-span-4">
            <FieldLabel>Email</FieldLabel>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ion@firma.ro"
            />
          </div>

          <div className="lg:col-span-8 flex items-end justify-end">
            <Button onClick={onCreate} disabled={!canCreate} variant="primary">
              Create
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-6" />

      <Card title="People list">
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <FieldLabel>Search</FieldLabel>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search (name, title, specialization, phone)..."
            />
          </div>

          <div className="lg:col-span-3">
            <FieldLabel>Include inactive</FieldLabel>
            <Select
              value={includeInactive ? "1" : "0"}
              onChange={(e) => {
                setSkip(0);
                setIncludeInactive(e.target.value === "1");
              }}
            >
              <option value="0">No (active only)</option>
              <option value="1">Yes</option>
            </Select>
          </div>

          <div className="lg:col-span-2">
            <FieldLabel>Page size</FieldLabel>
            <Select
              value={String(take)}
              onChange={(e) => {
                setSkip(0);
                setTake(Number(e.target.value));
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </Select>
          </div>

          <div className="lg:col-span-2 flex items-end justify-end gap-2">
            <Button
              variant="ghost"
              disabled={skip <= 0 || loading}
              onClick={() => setSkip((s) => Math.max(0, s - take))}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              disabled={skip + take >= total || loading}
              onClick={() => setSkip((s) => s + take)}
            >
              Next
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <TableShell minWidth={860}>
            <table className="w-full border-collapse text-sm">
              <thead className="bg-white/5 text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Title</th>
                  <th className="px-3 py-2 text-left font-semibold">Spec</th>
                  <th className="px-3 py-2 text-left font-semibold">Phone</th>
                  <th className="px-3 py-2 text-left font-semibold">Email</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-zinc-400">
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading &&
                  items.map((p) => (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="px-3 py-2 text-zinc-100">
                        <div className="font-semibold">{p.fullName}</div>
                        <div className="text-xs text-zinc-500">{p.displayName}</div>
                      </td>
                      <td className="px-3 py-2 text-zinc-200">{p.jobTitle || "—"}</td>
                      <td className="px-3 py-2 text-zinc-200">{p.specialization || "—"}</td>
                      <td className="px-3 py-2 text-zinc-200">{p.phone || "—"}</td>
                      <td className="px-3 py-2 text-zinc-200">{p.email ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Pill tone={p.isActive ? "teal" : "zinc"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Pill>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => onToggleActive(p)}
                          className={cx(
                            "rounded-lg px-3 py-1.5 text-xs font-semibold ring-1",
                            "bg-white/10 text-zinc-200 ring-white/15 hover:bg-white/15"
                          )}
                        >
                          {p.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}

                {!loading && items.length === 0 ? (
                  <EmptyRow colSpan={7} text="No people." />
                ) : null}
              </tbody>
            </table>
          </TableShell>
        </div>
      </Card>
    </AppShell>
  );
}
