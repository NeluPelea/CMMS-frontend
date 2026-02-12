import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import {
    ncApi,
    type NcOrderSummaryDto,
    type SupplierDto
} from "../api";
import { NcOrderStatus, ncStatusLabel } from "../domain/enums";
import {
    Button,
    ErrorBox,
    Input,
    PageToolbar,
    Pill,
    Select,
    TableShell,
    EmptyRow
} from "../components/ui";
import { isoToLocalDisplay } from "../domain/datetime";

export default function NcListPage() {
    const navigate = useNavigate();
    const [list, setList] = useState<NcOrderSummaryDto[]>([]);
    const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Filters
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<NcOrderStatus | "">("");
    const [supplierId, setSupplierId] = useState("");

    useEffect(() => {
        loadSuppliers();
        loadData();
    }, []);

    async function loadSuppliers() {
        try {
            const data = await ncApi.listSuppliers();
            setSuppliers(data);
        } catch (ex: any) { console.error(ex); }
    }

    async function loadData() {
        setLoading(true);
        setErr(null);
        try {
            const data = await ncApi.list({
                query: query || undefined,
                status: status !== "" ? status : undefined,
                supplierId: supplierId || undefined
            });
            setList(data);
        } catch (ex: any) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    function getStatusTone(s: NcOrderStatus) {
        switch (s) {
            case NcOrderStatus.Draft: return "zinc";
            case NcOrderStatus.Sent: return "amber";
            case NcOrderStatus.Confirmed: return "teal";
            case NcOrderStatus.Received: return "emerald";
            case NcOrderStatus.Cancelled: return "rose";
            default: return "zinc";
        }
    }

    async function handleCreate() {
        if (suppliers.length === 0) {
            alert("Nu exista furnizori definiti.");
            return;
        }
        setLoading(true);
        try {
            const { id } = await ncApi.create({
                supplierId: suppliers[0].id,
                currency: "RON",
                orderDate: new Date().toISOString(),
                priority: 1
            });
            navigate(`/nc/${id}`);
        } catch (ex: any) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <AppShell title="Note de Comandă (NC)">
            <PageToolbar
                left={
                    <div className="flex gap-2 items-center">
                        <Input
                            placeholder="Cauta NC..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && loadData()}
                        />
                        <Select
                            value={status}
                            onChange={(e) => setStatus(e.target.value ? Number(e.target.value) as any : "")}
                        >
                            <option value="">Toate statusurile</option>
                            <option value={NcOrderStatus.Draft}>Draft</option>
                            <option value={NcOrderStatus.Sent}>Trimis</option>
                            <option value={NcOrderStatus.Confirmed}>Confirmat</option>
                            <option value={NcOrderStatus.PartiallyReceived}>Receptionat Partial</option>
                            <option value={NcOrderStatus.Received}>Receptionat Total</option>
                            <option value={NcOrderStatus.Cancelled}>Anulat</option>
                        </Select>
                        <Select
                            value={supplierId}
                            onChange={(e) => setSupplierId(e.target.value)}
                        >
                            <option value="">Toți furnizorii</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </Select>
                        <Button onClick={loadData} variant="ghost">Filtrează</Button>
                    </div>
                }
                right={
                    <Button variant="primary" onClick={handleCreate}>Adaugă NC</Button>
                }
            />

            {err && <ErrorBox message={err} onClose={() => setErr(null)} />}

            <TableShell minWidth={1000}>
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-white/5 text-zinc-300">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Număr NC</th>
                            <th className="px-4 py-3 text-left font-semibold">Data</th>
                            <th className="px-4 py-3 text-left font-semibold">Furnizor</th>
                            <th className="px-4 py-3 text-left font-semibold">Status</th>
                            <th className="px-4 py-3 text-left font-semibold">Prioritate</th>
                            <th className="px-4 py-3 text-right font-semibold">Total</th>
                            <th className="px-4 py-3 text-right font-semibold">Acțiuni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {list.length === 0 && !loading && <EmptyRow colSpan={7} text="Nu s-au găsit note de comandă." />}
                        {list.map(item => (
                            <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-4 py-3 font-medium text-teal-400">
                                    <Link to={`/nc/${item.id}`}>{item.ncNumber}</Link>
                                </td>
                                <td className="px-4 py-3 text-zinc-400">
                                    {isoToLocalDisplay(item.orderDate)}
                                </td>
                                <td className="px-4 py-3 text-zinc-200">
                                    {item.supplierName}
                                </td>
                                <td className="px-4 py-3">
                                    <Pill tone={getStatusTone(item.status) as any}>
                                        {ncStatusLabel(item.status)}
                                    </Pill>
                                </td>
                                <td className="px-4 py-3">
                                    {item.priority === 3 ? <Pill tone="rose">Urgent</Pill> :
                                        item.priority === 2 ? <Pill tone="amber">Inalta</Pill> :
                                            <span className="text-zinc-500">Normal</span>}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-zinc-100">
                                    {item.total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} {item.currency}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Link to={`/nc/${item.id}`}>
                                        <Button size="sm" variant="ghost">Detalii</Button>
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableShell>
        </AppShell>
    );
}
