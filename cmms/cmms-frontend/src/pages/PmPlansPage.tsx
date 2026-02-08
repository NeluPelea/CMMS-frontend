// src/pages/PmPlansPage.tsx
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { getAssets, getLocs, type AssetDto, type LocDto } from "../api";
import {
  createPmPlan,
  generateDuePmPlans,
  getPmPlans,
  PmFrequency,
  type PmPlanDto,
} from "../api/pmPlans";
import { isoToLocalDisplay, localInputToIso } from "../domain/datetime";
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

function safeArray<T>(x: any): T[] {
  return Array.isArray(x) ? (x as T[]) : [];
}

function freqLabel(v: number) {
  switch (v) {
    case PmFrequency.Daily:
      return "Zilnic";
    case PmFrequency.Weekly:
      return "Saptamanal";
    case PmFrequency.Monthly:
      return "Lunar";
    default:
      return `Freq ${v}`;
  }
}

function FreqPill({ freq }: { freq: number }) {
  const tone =
    freq === PmFrequency.Daily
      ? "rose"
      : freq === PmFrequency.Weekly
        ? "amber"
        : "teal";
  return <Pill tone={tone as any}>{freqLabel(freq)}</Pill>;
}

function FieldLabel(props: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
      {props.children}
    </div>
  );
}

function DateTimeLocalInput(props: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type="datetime-local"
      value={props.value}
      onChange={props.onChange}
      className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-teal-400/40"
    />
  );
}

function TextArea(props: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={props.value}
      onChange={props.onChange}
      rows={props.rows ?? 4}
      placeholder={props.placeholder}
      className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-teal-400/40"
    />
  );
}

function checklistPreview(items: Array<{ text: string }> | null | undefined) {
  if (!items || items.length === 0) return "—";
  const texts = items
    .slice()
    .sort((a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((x) => x.text);

  const head = texts.slice(0, 3);
  const rest = texts.length - head.length;
  return rest > 0 ? `${head.join(", ")} (+${rest})` : head.join(", ");
}

export default function PmPlansPage() {
  const [items, setItems] = useState<PmPlanDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [locs, setLocs] = useState<LocDto[]>([]);
  const [assets, setAssets] = useState<AssetDto[]>([]);

  // filters
  const [locId, setLocId] = useState("");
  const [assetId, setAssetId] = useState("");

  // create
  const [cAssetId, setCAssetId] = useState("");
  const [cName, setCName] = useState("");
  const [cFreq, setCFreq] = useState<number>(PmFrequency.Weekly);
  const [cNextDueLocal, setCNextDueLocal] = useState<string>("");
  const [cChecklist, setCChecklist] = useState<string>("");

  const filteredAssets = useMemo(() => {
    if (!locId) return assets;
    return assets.filter((a) => (a.locId || "") === locId);
  }, [assets, locId]);

  const assetNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) map.set(a.id, a.name);
    return map;
  }, [assets]);

  async function loadAux() {
    const [l, a] = await Promise.all([
      getLocs({ take: 500, ia: true }),
      getAssets({ take: 500, ia: true }),
    ]);
    setLocs(safeArray(l));
    setAssets(safeArray(a));
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await getPmPlans({
        assetId: assetId || undefined,
        take: 500,
      });
      setItems(safeArray(data));
    } catch (e: any) {
      setErr(e?.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAux().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  async function onCreate() {
    setErr(null);
    try {
      if (!cAssetId) return setErr("Selecteaza utilaj");
      if (cName.trim().length < 2) return setErr("Nume prea scurt");

      const nextIso = cNextDueLocal ? localInputToIso(cNextDueLocal) : null;
      if (cNextDueLocal && !nextIso) return setErr("Scadenta invalida");

      const lines = cChecklist
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      await createPmPlan({
        assetId: cAssetId,
        name: cName.trim(),
        frequency: cFreq,
        nextDueAt: nextIso,
        items: lines.length ? lines : null,
      });

      setCAssetId("");
      setCName("");
      setCFreq(PmFrequency.Weekly);
      setCNextDueLocal("");
      setCChecklist("");
      await load();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onGenerateDue() {
    if (!confirm("Generati ordinele de lucru scadente acum?")) return;

    setErr(null);
    try {
      const res = await generateDuePmPlans(200);
      await load();
      alert(`Ordine de lucru generate: ${res.created}\nPlanuri actualizate: ${res.updatedPlans}`);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <AppShell title="Planuri Mentenanta">
      <PageToolbar
        left={
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <FieldLabel>Locatie</FieldLabel>
              <Select
                value={locId}
                onChange={(e) => {
                  setLocId(e.target.value);
                  setAssetId("");
                }}
              >
                <option value="">Toate locatiile</option>
                {locs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.code ? `(${l.code})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <FieldLabel>Utilaj</FieldLabel>
              <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                <option value="">Toate utilajele</option>
                {filteredAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.code ? `(${a.code})` : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <Button onClick={load} disabled={loading} variant="ghost">
              Actualizeaza
            </Button>
            <Button onClick={onGenerateDue} disabled={loading} variant="ghost">
              Genereaza scadente
            </Button>
          </div>
        }
      />

      {err ? <ErrorBox message={err} /> : null}

      <Card title="Creeaza Plan Mentenanta">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <FieldLabel>Utilaj</FieldLabel>
            <Select value={cAssetId} onChange={(e) => setCAssetId(e.target.value)}>
              <option value="">Selecteaza utilaj...</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.code ? `(${a.code})` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <FieldLabel>Frecventa</FieldLabel>
            <Select value={cFreq} onChange={(e) => setCFreq(Number(e.target.value))}>
              <option value={PmFrequency.Daily}>Zilnic</option>
              <option value={PmFrequency.Weekly}>Saptamanal</option>
              <option value={PmFrequency.Monthly}>Lunar</option>
            </Select>
          </div>

          <div>
            <FieldLabel>Urmatoarea scadenta</FieldLabel>
            <DateTimeLocalInput
              value={cNextDueLocal}
              onChange={(e) => setCNextDueLocal(e.target.value)}
            />
          </div>

          <div className="lg:col-span-4">
            <FieldLabel>Nume</FieldLabel>
            <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Nume plan" />
          </div>
        </div>

        <div className="mt-3">
          <FieldLabel>Lista sarcini</FieldLabel>
          <TextArea
            value={cChecklist}
            onChange={(e) => setCChecklist(e.target.value)}
            rows={4}
            placeholder={"Un item pe linie\nExemplu:\n- Verificare nivel ulei\n- Inspectie curele\n- Curatare filtre"}
          />
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            onClick={onCreate}
            disabled={loading || cName.trim().length < 2 || !cAssetId}
            variant="primary"
          >
            Creeaza
          </Button>
        </div>

        <div className="mt-2 text-xs text-zinc-500">
          Sfat: Lista de sarcini este salvata ca elemente individuale; ordinea este pastrata prin sortare.
        </div>
      </Card>

      <div className="mt-6" />

      <TableShell minWidth={900}>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Nume</th>
              <th className="px-4 py-3 text-left font-semibold">Utilaj</th>
              <th className="px-4 py-3 text-left font-semibold">Frecventa</th>
              <th className="px-4 py-3 text-left font-semibold">Urmatoarea scadenta</th>
              <th className="px-4 py-3 text-left font-semibold">Lista sarcini</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-zinc-100 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-zinc-300">
                  {assetNameById.get(p.assetId) ?? p.assetId}
                </td>
                <td className="px-4 py-3">
                  <FreqPill freq={p.frequency} />
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  {isoToLocalDisplay(p.nextDueAt)}
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  <span className={cx("block max-w-[520px] truncate")} title={checklistPreview(p.items as any)}>
                    {checklistPreview(p.items as any)}
                  </span>
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <EmptyRow colSpan={5} text="Nu exista planuri de mentenanta." />
            ) : null}
          </tbody>
        </table>
      </TableShell>
    </AppShell>
  );
}


