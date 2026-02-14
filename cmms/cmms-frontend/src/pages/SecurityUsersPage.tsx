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

    cx
} from "../components/ui/ui";
import {
    securityUsersApi,
    securityPermissionsApi,
    getPeopleSimple,
    type UserSecurityDto,
    type RoleSecurityDto,
    type UserEffectiveDto,
    type PermissionGroupDto,
    type PersonSimpleDto,
} from "../api";
import { hasPerm } from "../api/auth";

function slugify(text: string): string {
    return text
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ".")
        .replace(/[^\w.]+/g, "")
        .replace(/\.{2,}/g, ".");
}

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
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [people, setPeople] = useState<PersonSimpleDto[]>([]);
    const [selectedPersonId, setSelectedPersonId] = useState<string>("");
    const [newUsername, setNewUsername] = useState("");
    const [newDisplayName, setNewDisplayName] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editUsername, setEditUsername] = useState("");
    const [editDisplayName, setEditDisplayName] = useState("");
    const [editRoleId, setEditRoleId] = useState<string>("");

    const [isResetOpen, setIsResetOpen] = useState(false);
    const [resetPassword, setResetPassword] = useState("");
    const [resetMustChange, setResetMustChange] = useState(true);

    const [isPermsOpen, setIsPermsOpen] = useState(false);
    const [permSearch, setPermSearch] = useState("");
    const [permsCatalog, setPermsCatalog] = useState<PermissionGroupDto[]>([]);
    const [userEffective, setUserEffective] = useState<UserEffectiveDto | null>(null);
    const [localOverrides, setLocalOverrides] = useState<Record<string, boolean | null>>({});
    const [savingPerms, setSavingPerms] = useState(false);

    const canEditUsers = hasPerm("SECURITY_USERS_UPDATE");
    const canCreateUsers = hasPerm("SECURITY_USERS_CREATE");
    const canResetPass = hasPerm("SECURITY_USERS_RESET_PASSWORD");

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [u, r, p] = await Promise.all([
                securityUsersApi.list(undefined, true),
                securityUsersApi.getRoles(),
                getPeopleSimple({ includeInactive: false, take: 1000 })
            ]);
            setUsers(u); setRoles(r); setPeople(p);
        } catch (ex: any) { setErr(ex.message); } finally { setLoading(false); }
    }

    const filteredUsers = useMemo(() => {
        return users.filter(u =>
            u.username.toLowerCase().includes(search.toLowerCase()) ||
            u.displayName.toLowerCase().includes(search.toLowerCase())
        );
    }, [users, search]);

    const filteredPerms = useMemo(() => {
        if (!permSearch) return permsCatalog;
        const s = permSearch.toLowerCase();
        return permsCatalog.map(g => ({
            ...g,
            items: g.items.filter(i =>
                i.name.toLowerCase().includes(s) ||
                i.code.toLowerCase().includes(s)
            )
        })).filter(g => g.items.length > 0);
    }, [permsCatalog, permSearch]);

    const selectedUser = users.find(u => u.id === selectedUserId);

    async function handleCreateUser() {
        if (!newUsername || !newPassword) return;
        setLoading(true);
        try {
            await securityUsersApi.create({
                username: newUsername,
                displayName: newDisplayName || newUsername,
                initialPassword: newPassword,
                isActive: true,
                mustChangePassword: true,
                roleIds: [],
                personId: selectedPersonId || undefined
            });
            setIsCreateOpen(false);
            setNewUsername("");
            setNewDisplayName("");
            setNewPassword("");
            setSelectedPersonId("");
            await loadData();
        } catch (ex: any) {
            if (ex.message?.includes("Conflict")) setErr("Eroare: Utilizatorul există deja.");
            else setErr(ex.message);
        } finally { setLoading(false); }
    }

    async function handleSaveConfig() {
        if (!selectedUserId) return;
        setLoading(true);
        try {
            await securityUsersApi.update(selectedUserId, {
                username: editUsername,
                displayName: editDisplayName,
                roleIds: editRoleId ? [editRoleId] : []
            });
            await loadData();
            setIsEditOpen(false);
        } catch (ex: any) { setErr(ex.message); } finally { setLoading(false); }
    }

    async function handleResetPassword() {
        if (!selectedUserId || !resetPassword) return;
        if (!confirm("Sigur doriți să resetați parola pentru acest utilizator?")) return;
        try {
            await securityUsersApi.resetPassword(selectedUserId, { newPassword: resetPassword, mustChangePassword: resetMustChange });
            setIsResetOpen(false); setResetPassword("");
            alert("Parola a fost resetată cu succes.");
        } catch (ex: any) { setErr(ex.message); }
    }

    async function toggleUserActive(u: UserSecurityDto) {
        try {
            await securityUsersApi.update(u.id, { isActive: !u.isActive });
            await loadData();
        } catch (ex: any) { setErr(ex.message); }
    }

    function openEdit(u: UserSecurityDto) {
        setSelectedUserId(u.id);
        setEditUsername(u.username);
        setEditDisplayName(u.displayName);
        // Map current roles (take first system role if any)
        const primaryRole = u.roles[0];
        setEditRoleId(primaryRole?.id || "");
        setIsEditOpen(true);
    }

    async function openPerms(u: UserSecurityDto) {
        setSelectedUserId(u.id);
        setLoading(true);
        try {
            const [catalog, effective] = await Promise.all([
                securityPermissionsApi.list(),
                securityUsersApi.getEffective(u.id)
            ]);
            setPermsCatalog(catalog);
            setUserEffective(effective);

            // Map current overrides to local state
            const ovr: Record<string, boolean | null> = {};
            effective.overrides.forEach(o => {
                ovr[o.permissionCode] = o.isGranted;
            });
            setLocalOverrides(ovr);

            setIsPermsOpen(true);
        } catch (ex: any) { setErr(ex.message); } finally { setLoading(false); }
    }

    async function handleSavePerms() {
        if (!selectedUserId || !userEffective) return;
        setSavingPerms(true);
        try {
            // We need to compare localOverrides with current database state (userEffective.overrides)
            // and apply changes. The API setOverride(id, { code, isGranted: bool | null }) 
            // handles Grant, Revoke, and Reset (null).

            const currentCodes = new Set(userEffective.overrides.map(o => o.permissionCode));
            const localCodes = Object.keys(localOverrides);
            const allCodes = new Set([...currentCodes, ...localCodes]);

            for (const code of allCodes) {
                const currentVal = userEffective.overrides.find(o => o.permissionCode === code)?.isGranted ?? null;
                const nextVal = localOverrides[code] ?? null;

                if (currentVal !== nextVal) {
                    await securityUsersApi.setOverride(selectedUserId, { permissionCode: code, isGranted: nextVal });
                }
            }

            setIsPermsOpen(false);
            alert("Permisiuni salvate cu succes.");
        } catch (ex: any) { setErr(ex.message); } finally { setSavingPerms(false); }
    }

    async function handleImpersonate(u: UserSecurityDto) {
        try {
            const { token } = await securityUsersApi.impersonate(u.id);
            window.open(`/impersonate?token=${token}`, "_blank");
        } catch (ex: any) {
            setErr(ex.message);
        }
    }

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
                            <th className="px-4 py-3 text-left font-semibold">Modifică</th>
                            <th className="px-4 py-3 text-right font-semibold">Acțiuni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {filteredUsers.map(u => (
                            <tr key={u.id} className="hover:bg-white/5 group transition-colors">
                                <td className="px-4 py-3 text-zinc-100 font-medium">{u.displayName}</td>
                                <td className="px-4 py-3 text-zinc-400">@{u.username}</td>
                                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{u.roles.map(r => <Pill key={r.id} tone={r.rank === 0 ? "amber" : "teal"}>{r.name}</Pill>)}</div></td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => toggleUserActive(u)}
                                        disabled={!canEditUsers}
                                        className={cx(
                                            "px-3 py-1 rounded-full text-xs font-bold transition-all border",
                                            u.isActive
                                                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
                                                : "bg-rose-500/10 border-rose-500/50 text-rose-400 hover:bg-rose-500/20"
                                        )}
                                    >
                                        {u.isActive ? "Activ" : "Inactiv"}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        {u.roles.every(r => r.rank > 0) && (
                                            <Button
                                                size="sm"
                                                className="bg-blue-600 hover:bg-blue-500 text-white border-none"
                                                onClick={() => handleImpersonate(u)}
                                            >
                                                Test
                                            </Button>
                                        )}
                                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>Configurare</Button>
                                        <Button size="sm" onClick={() => openPerms(u)}>Permisiuni</Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableShell>

            <Drawer open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Adaugă Utilizator Nou">
                <div className="space-y-4">
                    <div>
                        <FieldLabel>Persoană (Angajat)</FieldLabel>
                        <select
                            value={selectedPersonId}
                            onChange={e => {
                                const pid = e.target.value;
                                setSelectedPersonId(pid);
                                const p = people.find(x => x.id === pid);
                                if (p) {
                                    setNewDisplayName(p.displayName);
                                    setNewUsername(slugify(p.displayName));
                                }
                            }}
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                        >
                            <option value="">Alege angajat (opțional)</option>
                            {people
                                .filter(p => !users.some(u => u.personId === p.id))
                                .map(p => (
                                    <option key={p.id} value={p.id}>{p.displayName} ({slugify(p.displayName)})</option>
                                ))
                            }
                        </select>
                    </div>
                    <FieldLabel>Identitate</FieldLabel>
                    <Input label="Utilizator" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                    <Input label="Nume Afișat" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} />
                    <Input label="Parolă" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    <div className="flex justify-end gap-2 pt-4"><Button onClick={() => setIsCreateOpen(false)}>Anulează</Button><Button variant="primary" onClick={handleCreateUser} disabled={loading}>Salvează</Button></div>
                </div>
            </Drawer>

            <Drawer open={isEditOpen} onClose={() => setIsEditOpen(false)} title={`Configurare Utilizator`} widthClassName="w-full sm:w-[480px]">
                <div className="space-y-6">
                    {/* Parola Section */}
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
                        <FieldLabel>Securitate</FieldLabel>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-400">Resetează parola utilizatorului</span>
                            {canResetPass && (
                                <Button size="sm" onClick={() => setIsResetOpen(true)} variant="ghost" className="text-amber-400 hover:bg-amber-400/10">
                                    Resetează parola
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Identitate Section */}
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
                        <FieldLabel>Identitate & Acces</FieldLabel>
                        <Input label="Nume Afișat" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} />
                        <Input label="Utilizator" value={editUsername} onChange={e => setEditUsername(e.target.value)} />

                        <div>
                            <div className="text-xs text-zinc-500 mb-1 ml-1">Rank / Rol principal</div>
                            <select
                                value={editRoleId}
                                onChange={e => setEditRoleId(e.target.value)}
                                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            >
                                <option value="">Fără Rol</option>
                                {roles.sort((a: RoleSecurityDto, b: RoleSecurityDto) => a.rank - b.rank).map((r: RoleSecurityDto) => (
                                    <option key={r.id} value={r.id}>
                                        {r.rank !== undefined ? `[R${r.rank}] ` : ""}{r.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button className="flex-1" onClick={() => setIsEditOpen(false)}>Anulează</Button>
                        <Button
                            variant="primary"
                            className="flex-1"
                            onClick={handleSaveConfig}
                            disabled={loading}
                        >
                            Salvează Modificări
                        </Button>
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
            <Drawer open={isPermsOpen} onClose={() => setIsPermsOpen(false)} title={`Permisiuni: ${selectedUser?.displayName}`} widthClassName="w-full sm:w-[600px]">
                <div className="flex flex-col h-full">
                    <div className="mb-4">
                        <Input
                            placeholder="Caută permisiune..."
                            value={permSearch}
                            onChange={e => setPermSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                        {filteredPerms.map((group: PermissionGroupDto) => (
                            <div key={group.group} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                                <div className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-2 px-1">{group.group}</div>
                                <div className="space-y-0.5">
                                    {group.items.map((p: any) => {
                                        const isInherited = userEffective?.effectivePermissions.includes(p.code);
                                        const currentOverride = localOverrides[p.code]; // true, false, or undefined/null

                                        const isChecked = currentOverride === true || (currentOverride === undefined || currentOverride === null ? !!isInherited : false);
                                        const hasOverride = currentOverride !== undefined && currentOverride !== null;
                                        const isRevoked = currentOverride === false;

                                        return (
                                            <label key={p.code} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer group/p">
                                                <div className="min-w-0 pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-medium text-zinc-200">{p.name}</div>
                                                        {!hasOverride && isInherited && <Pill tone="amber">Moștenit</Pill>}
                                                        {isRevoked && <Pill tone="rose">Revocat</Pill>}
                                                        {hasOverride && currentOverride === true && <Pill tone="teal">Forțat</Pill>}
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 font-mono">{p.code}</div>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    ref={el => {
                                                        if (el) el.indeterminate = !hasOverride && !!isInherited;
                                                    }}
                                                    onChange={() => {
                                                        const newVal = (localOverrides[p.code] === true) ? false : (localOverrides[p.code] === false ? null : true);
                                                        setLocalOverrides(prev => ({ ...prev, [p.code]: newVal }));
                                                    }}
                                                    className={cx(
                                                        "h-5 w-5 rounded border-zinc-700 bg-zinc-800 transition-colors",
                                                        hasOverride ? (currentOverride ? "text-teal-500" : "text-rose-500") : "text-zinc-500"
                                                    )}
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2 pt-6 mt-4 border-t border-white/10">
                        <Button className="flex-1" onClick={() => setIsPermsOpen(false)}>Anulează</Button>
                        <Button
                            variant="primary"
                            className="flex-1"
                            onClick={handleSavePerms}
                            disabled={savingPerms}
                        >
                            {savingPerms ? "Se salvează..." : "Salvează Permisiuni"}
                        </Button>
                    </div>
                </div>
            </Drawer>
        </AppShell>
    );
}
