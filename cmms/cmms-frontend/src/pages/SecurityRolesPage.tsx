import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import {
    Input,
    Button,
    Pill,
    ErrorBox,
    PageToolbar,
    Drawer,
    TableShell,

} from "../components/ui/ui";
import {
    securityRolesApi,
    securityPermissionsApi,
    type RoleSecurityDto,
    type PermissionGroupDto
} from "../api";

function FieldLabel(props: { children: React.ReactNode }) {
    return (
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {props.children}
        </div>
    );
}

export default function SecurityRolesPage() {
    const [roles, setRoles] = useState<RoleSecurityDto[]>([]);
    const [permissions, setPermissions] = useState<PermissionGroupDto[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [rank, setRank] = useState(1);
    const [description, setDescription] = useState("");
    const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        setLoading(true); setErr(null);
        try {
            const [r, p] = await Promise.all([securityRolesApi.list(), securityPermissionsApi.list()]);
            setRoles(r); setPermissions(p);
        } catch (ex: any) { setErr(ex.message); } finally { setLoading(false); }
    }

    function handleEditRole(role: RoleSecurityDto) {
        setIsCreating(false); setSelectedRoleId(role.id); setName(role.name); setCode(role.code);
        setRank(role.rank); setDescription(role.description); setSelectedPerms(role.permissionCodes);
        setIsEditOpen(true);
    }

    function handleInitiateCreate() {
        setSelectedRoleId(null); setIsCreating(true); setName(""); setCode("");
        setRank(roles.length > 0 ? Math.max(...roles.map(r => r.rank)) + 1 : 1);
        setDescription(""); setSelectedPerms([]); setIsEditOpen(true);
    }

    async function handleSave() {
        if (!name || !code) return;
        setLoading(true);
        try {
            if (isCreating) await securityRolesApi.create({ code, name, rank, description, permissionCodes: selectedPerms });
            else if (selectedRoleId) await securityRolesApi.update(selectedRoleId, { name, rank, description, permissionCodes: selectedPerms });
            await loadData(); setIsEditOpen(false);
        } catch (ex: any) { setErr(ex.message); } finally { setLoading(false); }
    }

    async function handleDelete() {
        const sel = roles.find(r => r.id === selectedRoleId);
        if (!sel || sel.isSystem) return;
        if (!window.confirm(`Ștergi rolul ${sel.name}?`)) return;
        setLoading(true);
        try { await securityRolesApi.delete(sel.id); await loadData(); setIsEditOpen(false); }
        catch (ex: any) { setErr(ex.message); } finally { setLoading(false); }
    }

    const currentRole = roles.find(r => r.id === selectedRoleId);

    return (
        <AppShell title="Configurare Roluri">
            <PageToolbar
                left={<h2 className="text-zinc-400 text-sm italic font-normal">Gestionare roluri sistem</h2>}
                right={<div className="flex gap-2">
                    <Button onClick={loadData} variant="ghost">Actualizează</Button>
                    <Button variant="primary" onClick={handleInitiateCreate}>Adaugă Rol</Button>
                </div>}
            />

            {err && <ErrorBox message={err} onClose={() => setErr(null)} />}

            <TableShell minWidth={900}>
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-white/5 text-zinc-300">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Nume</th>
                            <th className="px-4 py-3 text-left font-semibold">Cod</th>
                            <th className="px-4 py-3 text-left font-semibold">Rank</th>
                            <th className="px-4 py-3 text-left font-semibold">Descriere</th>
                            <th className="px-4 py-3 text-right font-semibold">Acțiuni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {roles.map(r => (
                            <tr key={r.id} className="hover:bg-white/5 group transition-colors">
                                <td className="px-4 py-3"><div className="flex items-center gap-2 font-medium text-zinc-100">{r.name}{r.isSystem && <Pill tone="amber">System</Pill>}</div></td>
                                <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">{r.code}</td>
                                <td className="px-4 py-3"><div className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[11px] inline-block font-bold">R{r.rank}</div></td>
                                <td className="px-4 py-3 text-zinc-500 max-w-[300px] truncate">{r.description}</td>
                                <td className="px-4 py-3 text-right"><Button size="sm" onClick={() => handleEditRole(r)}>Configurează</Button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableShell>

            <Drawer open={isEditOpen} onClose={() => setIsEditOpen(false)} title={isCreating ? "Rol Nou" : `Rol: ${currentRole?.name}`} widthClassName="w-full sm:w-[680px]">
                <div className="space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                        <FieldLabel>Atribute Generale</FieldLabel>
                        <Input label="Cod" value={code} onChange={e => setCode(e.target.value)} disabled={!isCreating} />
                        <Input label="Nume" value={name} onChange={e => setName(e.target.value)} />
                        <Input label="Rank" type="number" value={rank} onChange={e => setRank(parseInt(e.target.value))} />
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-400 ml-1">Descriere</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-teal-400/40 min-h-[80px]" />
                        </div>
                    </div>
                    <div>
                        <FieldLabel>Permisiuni Incluse</FieldLabel>
                        <div className="mt-2 space-y-4">
                            {permissions.map(group => (
                                <div key={group.group} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                                    <div className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-2 px-1">{group.group}</div>
                                    <div className="space-y-0.5">
                                        {group.items.map(p => (
                                            <label key={p.code} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer group/p">
                                                <div className="min-w-0 pr-4"><div className="text-sm font-medium text-zinc-200">{p.name}</div><div className="text-[10px] text-zinc-500">{p.code}</div></div>
                                                <input type="checkbox" checked={selectedPerms.includes(p.code)} onChange={() => {
                                                    setSelectedPerms(prev => prev.includes(p.code) ? prev.filter(x => x !== p.code) : [...prev, p.code]);
                                                }} className="h-5 w-5 rounded border-zinc-700 bg-zinc-800 text-teal-500" />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-white/10">
                        <div>{!isCreating && !currentRole?.isSystem && <Button variant="ghost" onClick={handleDelete}>Șterge Rol</Button>}</div>
                        <div className="flex gap-2"><Button onClick={() => setIsEditOpen(false)}>Anulează</Button><Button variant="primary" onClick={handleSave} disabled={loading || !name || !code}>Salvează</Button></div>
                    </div>
                </div>
            </Drawer>
        </AppShell>
    );
}
