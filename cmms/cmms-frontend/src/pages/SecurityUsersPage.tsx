import { useEffect, useState, useMemo } from "react";
import AppShell from "../components/AppShell";
import {
    Input,
    Button,
    Pill,
    ErrorBox,
    PageToolbar,
    Drawer,
    TableShell,
    EmptyRow,
    cx
} from "../components/ui/ui";
import {
    securityUsersApi,
    securityRolesApi,
    securityPermissionsApi,
    type UserSecurityDto,
    type RoleSecurityDto,
    type PermissionGroupDto,
    type UserEffectiveDto,
} from "../api";
import { hasPerm } from "../api/auth";

function FieldLabel(props: { children: React.ReactNode }) {
    return (
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {props.children}
        </div>
    );
}

export default function SecurityUsersPage() {
    const [users, setUsers] = useState<UserSecurityDto[]>([]);
    const [roles, setRoles] = useState<RoleSecurityDto[]>([]);
    const [permissions, setPermissions] = useState<PermissionGroupDto[]>([]);

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUserEffect, setSelectedUserEffect] = useState<UserEffectiveDto | null>(null);

    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [newDisplayName, setNewDisplayName] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isResetOpen, setIsResetOpen] = useState(false);
    const [resetPassword, setResetPassword] = useState("");
    const [resetMustChange, setResetMustChange] = useState(true);

    const canEditUsers = hasPerm("SECURITY_USERS_UPDATE");
    const canCreateUsers = hasPerm("SECURITY_USERS_CREATE");
    const canResetPass = hasPerm("SECURITY_USERS_RESET_PASSWORD");
    const canAssignPerms = hasPerm("SECURITY_PERMISSIONS_ASSIGN");

    useEffect(() => { loadData(); }, []);
    useEffect(() => {
        if (selectedUserId) loadUserEffect(selectedUserId);
        else setSelectedUserEffect(null);
    }, [selectedUserId]);

    async function loadData() {
        setLoading(true);
        try {
            const [u, r, p] = await Promise.all([
                securityUsersApi.list(undefined, true),
                securityRolesApi.list(),
                securityPermissionsApi.list()
            ]);
            setUsers(u); setRoles(r); setPermissions(p);
        } catch (ex: any) { setErr(ex.message); } finally { setLoading(false); }
    }

    async function loadUserEffect(id: string) {
        try {
            const data = await securityUsersApi.getEffective(id);
            setSelectedUserEffect(data);
        } catch (ex: any) { setErr("Eroare: " + ex.message); }
    }

    const filteredUsers = useMemo(() => {
        return users.filter(u =>
            u.username.toLowerCase().includes(search.toLowerCase()) ||
            u.displayName.toLowerCase().includes(search.toLowerCase())
        );
    }, [users, search]);

    const selectedUser = users.find(u => u.id === selectedUserId);

    async function handleCreateUser() {
        if (!newUsername || !newPassword) return;
        setLoading(true);
        try {
            await securityUsersApi.create({
                username: newUsername, displayName: newDisplayName || newUsername,
                initialPassword: newPassword, isActive: true, mustChangePassword: true, roleIds: []
            });
            setIsCreateOpen(false); setNewUsername(""); setNewDisplayName(""); setNewPassword(""); await loadData();
        } catch (ex: any) { setErr(ex.message); } finally { setLoading(false); }
    }

    async function handleUpdateRoles(roleIds: string[]) {
        if (!selectedUserId) return;
        try {
            await securityUsersApi.update(selectedUserId, { roleIds });
            await loadData(); await loadUserEffect(selectedUserId);
        } catch (ex: any) { setErr(ex.message); }
    }

    async function handleToggleOverride(permCode: string) {
        if (!selectedUserId || !selectedUserEffect) return;
        const currentOverride = selectedUserEffect.overrides.find(o => o.permissionCode === permCode);
        const isInherited = selectedUserEffect.effectivePermissions.includes(permCode) && !currentOverride;
        let nextValue: boolean | null = null;
        if (currentOverride) nextValue = currentOverride.isGranted ? false : null;
        else nextValue = isInherited ? false : true;
        try {
            await securityUsersApi.setOverride(selectedUserId, { permissionCode: permCode, isGranted: nextValue });
            await loadUserEffect(selectedUserId);
        } catch (ex: any) { setErr(ex.message); }
    }

    async function handleResetPassword() {
        if (!selectedUserId || !resetPassword) return;
        try {
            await securityUsersApi.resetPassword(selectedUserId, { newPassword: resetPassword, mustChangePassword: resetMustChange });
            setIsResetOpen(false); setResetPassword("");
        } catch (ex: any) { setErr(ex.message); }
    }

    async function toggleActive() {
        if (!selectedUser) return;
        try {
            await securityUsersApi.update(selectedUser.id, { isActive: !selectedUser.isActive });
            await loadData();
        } catch (ex: any) { setErr(ex.message); }
    }

    function openEdit(id: string) { setSelectedUserId(id); setIsEditOpen(true); }

    return (
        <AppShell title="Acces Utilizatori">
            <PageToolbar
                left={<div className="w-64 lg:w-96"><Input placeholder="Caută utilizator..." value={search} onChange={e => setSearch(e.target.value)} /></div>}
                right={<div className="flex gap-2"><Button onClick={loadData} variant="ghost">Actualizează</Button>
                    {canCreateUsers && <Button variant="primary" onClick={() => setIsCreateOpen(true)}>Creează Utilizator</Button>}</div>}
            />

            {err && <ErrorBox message={err} onClose={() => setErr(null)} />}

            <TableShell minWidth={900}>
                <table className="w-full border-collapse text-sm">
                    <thead className="bg-white/5 text-zinc-300">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Nume Afișat</th>
                            <th className="px-4 py-3 text-left font-semibold">User (@)</th>
                            <th className="px-4 py-3 text-left font-semibold">Roluri</th>
                            <th className="px-4 py-3 text-left font-semibold">Status</th>
                            <th className="px-4 py-3 text-right font-semibold">Acțiuni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {filteredUsers.map(u => (
                            <tr key={u.id} className="hover:bg-white/5 group transition-colors">
                                <td className="px-4 py-3 text-zinc-100 font-medium">{u.displayName}</td>
                                <td className="px-4 py-3 text-zinc-400">@{u.username}</td>
                                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{u.roles.map(r => <Pill key={r.id} tone={r.rank === 0 ? "amber" : "teal"}>{r.name}</Pill>)}</div></td>
                                <td className="px-4 py-3"><Pill tone={u.isActive ? "emerald" : "rose"}>{u.isActive ? "Activ" : "Inactiv"}</Pill></td>
                                <td className="px-4 py-3 text-right"><Button size="sm" onClick={() => openEdit(u.id)}>Acces & Permisiuni</Button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableShell>

            <Drawer open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Adaugă Utilizator Nou">
                <div className="space-y-4">
                    <FieldLabel>Identitate</FieldLabel>
                    <Input label="Utilizator" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                    <Input label="Nume Afișat" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} />
                    <Input label="Parolă" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    <div className="flex justify-end gap-2 pt-4"><Button onClick={() => setIsCreateOpen(false)}>Anulează</Button><Button variant="primary" onClick={handleCreateUser} disabled={loading}>Salvează</Button></div>
                </div>
            </Drawer>

            <Drawer open={isEditOpen} onClose={() => setIsEditOpen(false)} title={`Configurare: ${selectedUser?.displayName}`} widthClassName="w-full sm:w-[680px]">
                <div className="space-y-6">
                    <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10">
                        <div><div className="text-sm font-bold">{selectedUser?.displayName}</div><div className="text-xs text-zinc-500">@{selectedUser?.username}</div></div>
                        <div className="flex gap-2">{canResetPass && <Button size="sm" onClick={() => setIsResetOpen(true)}>Parolă</Button>}{canEditUsers && <Button size="sm" onClick={toggleActive} variant={selectedUser?.isActive ? "ghost" : "primary"}>{selectedUser?.isActive ? "Dezactivează" : "Activează"}</Button>}</div>
                    </div>
                    <div>
                        <FieldLabel>Roluri Sistem</FieldLabel>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {roles.map(r => {
                                const isOwned = selectedUser?.roles.some(ur => ur.id === r.id);
                                return (
                                    <label key={r.id} className={cx("flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition", isOwned ? "bg-teal-500/10 border-teal-500/30" : "bg-white/5 border-white/10 hover:bg-white/10")}>
                                        <input type="checkbox" checked={isOwned} disabled={!canEditUsers} onChange={e => {
                                            const ids = selectedUser?.roles.map(x => x.id) || [];
                                            if (e.target.checked) ids.push(r.id); else ids.splice(ids.indexOf(r.id), 1);
                                            handleUpdateRoles(ids);
                                        }} className="h-5 w-5 rounded border-zinc-700 bg-zinc-800 text-teal-500" />
                                        <div className="min-w-0"><div className="text-sm font-semibold truncate">{r.name}</div><div className="text-[10px] text-zinc-500">{r.code}</div></div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <FieldLabel>Matrice Permisiuni</FieldLabel>
                        <div className="mt-4 space-y-4">
                            {selectedUserEffect && permissions.map(group => (
                                <div key={group.group} className="bg-white/5 p-3 rounded-2xl border border-white/10">
                                    <div className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-2">{group.group}</div>
                                    {group.items.map(item => {
                                        const effect = selectedUserEffect.effectivePermissions.includes(item.code);
                                        const over = selectedUserEffect.overrides.find(o => o.permissionCode === item.code);
                                        let tone: any = over ? (over.isGranted ? "teal" : "rose") : (effect ? "amber" : "zinc");
                                        let label = over ? (over.isGranted ? "Modificat" : "Revocat") : (effect ? "Moștenit" : "");
                                        return (
                                            <div key={item.code} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg group/p">
                                                <div className="min-w-0 pr-4"><div className="text-sm font-medium">{item.name}</div><div className="text-[10px] text-zinc-500">{item.code}</div></div>
                                                <div className="flex items-center gap-3">{label && <Pill tone={tone}>{label}</Pill>}<input type="checkbox" checked={effect} disabled={!canAssignPerms} onChange={() => handleToggleOverride(item.code)} className={cx("h-5 w-5 rounded border-zinc-700 bg-zinc-800 text-teal-500", over?.isGranted === false ? "opacity-30" : "")} /></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Drawer>

            <Drawer open={isResetOpen} onClose={() => setIsResetOpen(false)} title="Resetare Parolă">
                <div className="space-y-4">
                    <Input label="Parolă Nouă" type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={resetMustChange} onChange={e => setResetMustChange(e.target.checked)} /> Forțează schimbarea la login</label>
                    <div className="flex justify-end gap-2 pt-4"><Button onClick={() => setIsResetOpen(false)}>Anulează</Button><Button variant="primary" onClick={handleResetPassword} disabled={!resetPassword}>Setează</Button></div>
                </div>
            </Drawer>
        </AppShell>
    );
}
