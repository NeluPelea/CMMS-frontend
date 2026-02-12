import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import {
    suppliersApi,
    type SupplierSummaryDto,
    type SupplierDetailsDto,
    type SupplierContactDto,
    getParts,
    type PartDto,
    type ContactSaveReq,
    type SupplierUpdateReq
} from "../api";
import {
    Button,
    EmptyRow,
    ErrorBox,
    Input,
    PageToolbar,
    Pill,
    PillButton,
    TableShell,
    Tabs,
    cx
} from "../components/ui";


export default function SuppliersPage() {
    const [list, setList] = useState<SupplierSummaryDto[]>([]);
    const [, setTotal] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [details, setDetails] = useState<SupplierDetailsDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Filters
    const [q, setQ] = useState("");
    const [isActive, setIsActive] = useState<boolean | "">("");
    const [isPreferred, setIsPreferred] = useState<boolean | "">("");

    useEffect(() => {
        loadList();
    }, [q, isActive, isPreferred]);

    async function loadList() {
        setLoading(true);
        try {
            const res = await suppliersApi.list({
                q: q || undefined,
                isActive: isActive === "" ? undefined : isActive,
                isPreferred: isPreferred === "" ? undefined : isPreferred,
                take: 1000
            });
            setList(res.items);
            setTotal(res.total);
        } catch (ex: any) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (selectedId) loadDetails(selectedId);
        else setDetails(null);
    }, [selectedId]);

    async function loadDetails(id: string) {
        setLoading(true);
        try {
            const data = await suppliersApi.get(id);
            setDetails(data);
        } catch (ex: any) {
            setErr(ex.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleAddSupplier() {
        const name = prompt("Nume furnizor:");
        if (!name) return;
        try {
            const { id } = await suppliersApi.create({
                name,
                isPreferred: false
            });
            setSelectedId(id);
            loadList();
        } catch (ex: any) {
            alert(ex.message);
        }
    }

    async function toggleFavorite(s: SupplierSummaryDto, e: React.MouseEvent) {
        e.stopPropagation();
        const newVal = !s.isPreferred;

        // Optimistic UI
        setList(prev => prev.map(it => it.id === s.id ? { ...it, isPreferred: newVal } : it));
        if (details?.id === s.id) {
            setDetails(prev => prev ? { ...prev, isPreferred: newVal } : null);
        }

        try {
            await suppliersApi.toggleFavorite(s.id, newVal);
        } catch (ex: any) {
            // Revert on error
            setList(prev => prev.map(it => it.id === s.id ? { ...it, isPreferred: !newVal } : it));
            if (details?.id === s.id) {
                setDetails(prev => prev ? { ...prev, isPreferred: !newVal } : null);
            }
            alert(ex.message);
        }
    }

    return (
        <AppShell title="Furnizori">
            <div className="flex flex-col gap-6">
                <PageToolbar
                    left={
                        <div className="flex gap-2 items-center flex-wrap">
                            <Input
                                placeholder="Cauta nume, localitate, contact..."
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                className="w-64"
                            />
                            <div className="flex gap-1">
                                <PillButton active={isActive === ""} onClick={() => setIsActive("")} tone="zinc">Toți</PillButton>
                                <PillButton active={isActive === true} onClick={() => setIsActive(true)} tone="teal">Activ</PillButton>
                                <PillButton active={isActive === false} onClick={() => setIsActive(false)} tone="rose">Inactiv</PillButton>
                            </div>
                            <PillButton active={isPreferred === true} onClick={() => setIsPreferred(isPreferred === true ? "" : true)} tone="amber">
                                {isPreferred === true ? "★ Favoriți" : "Favoriți"}
                            </PillButton>
                        </div>
                    }
                    right={
                        <Button variant="primary" onClick={handleAddSupplier}>+ Adaugă Furnizor</Button>
                    }
                />

                {err && <ErrorBox message={err} onClose={() => setErr(null)} />}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* List Column */}
                    <div className={cx(
                        "lg:col-span-4 space-y-2",
                        selectedId ? "hidden lg:block" : "block"
                    )}>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-2 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                            {list.length === 0 && !loading && (
                                <div className="p-10 text-center text-zinc-500 text-sm italic">Nu s-au găsit furnizori.</div>
                            )}
                            {list.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => setSelectedId(s.id)}
                                    className={cx(
                                        "p-4 rounded-xl cursor-pointer transition-all border group mb-2 last:mb-0",
                                        selectedId === s.id
                                            ? "bg-teal-500/10 border-teal-500/40"
                                            : "border-transparent bg-white/[0.02] hover:bg-white/5"
                                    )}
                                >
                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center overflow-hidden">
                                            {s.websiteUrl ? (
                                                <img
                                                    src={suppliersApi.getLogoUrl(s.websiteUrl)}
                                                    alt=""
                                                    className="w-full h-full object-contain"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-xs font-bold text-zinc-500">${s.name.substring(0, 2).toUpperCase()}</span>`; }}
                                                />
                                            ) : (
                                                <span className="text-xs font-bold text-zinc-500">{s.name.substring(0, 2).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-start mb-1 gap-2">
                                                <h3 className="font-bold text-zinc-100 truncate flex-grow">
                                                    {s.name}
                                                </h3>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={(e) => toggleFavorite(s, e)}
                                                        className={cx("transition-colors", s.isPreferred ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400")}
                                                    >
                                                        <svg className="w-5 h-5" fill={s.isPreferred ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                                    </button>
                                                    {!s.isActive && <Pill tone="rose">Inactiv</Pill>}
                                                </div>
                                            </div>
                                            <div className="text-xs text-teal-500/80 mb-2 font-medium">
                                                {s.city || "—"}
                                            </div>
                                            <div className="space-y-1">
                                                {s.contacts.map((c, i) => (
                                                    <div key={i} className="text-[11px] text-zinc-400 flex flex-wrap gap-x-2 items-center">
                                                        <span className="font-medium text-zinc-300">{c.fullName}</span>
                                                        {c.phone && <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} className="hover:text-teal-400 hover:underline">{c.phone}</a>}
                                                        {c.email && <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="hover:text-teal-400 hover:underline">{c.email}</a>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Details Column */}
                    <div className={cx(
                        "lg:col-span-8",
                        !selectedId ? "hidden lg:block lg:opacity-30 pointer-events-none" : "block"
                    )}>
                        {!selectedId ? (
                            <div className="h-64 flex items-center justify-center border-2 border-dashed border-white/10 rounded-3xl text-zinc-500">
                                Selectează un furnizor pentru detalii
                            </div>
                        ) : details ? (
                            <div className="space-y-4">
                                <div className="lg:hidden mb-4">
                                    <Button onClick={() => setSelectedId(null)} variant="ghost" size="sm">← Inapoi la lista</Button>
                                </div>
                                <SupplierDetailsPanel details={details} onUpdate={() => { loadDetails(selectedId); loadList(); }} />
                            </div>
                        ) : (
                            <div className="p-10 text-center animate-pulse text-zinc-500">Se încarcă...</div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

function SupplierDetailsPanel({ details, onUpdate }: { details: SupplierDetailsDto, onUpdate: () => void }) {
    const [tab, setTab] = useState("general");

    const tabs = [
        { key: "general", label: "General" },
        { key: "company", label: "Date Firmă" },
        { key: "contacts", label: "Contacte" },
        { key: "parts", label: "Catalog Piese" }
    ];

    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-6 border-b border-white/5 bg-white/5">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-100">{details.name}</h2>
                        <div className="flex gap-2 mt-2">
                            <Pill tone={details.isActive ? "teal" : "rose"}>{details.isActive ? "Activ" : "Inactiv"}</Pill>
                            {details.isPreferred && <Pill tone="amber">Favorit ★</Pill>}
                            {details.city && <span className="text-sm text-zinc-400 ml-2">{details.city}</span>}
                        </div>
                    </div>
                </div>

                <Tabs
                    items={tabs}
                    value={tab}
                    onChange={setTab}
                    render={(k) => {
                        switch (k) {
                            case "general": return <TabGeneral key={details.id} details={details} onUpdate={onUpdate} />;
                            case "company": return <TabCompany key={details.id} details={details} onUpdate={onUpdate} />;
                            case "contacts": return <TabContacts key={details.id} details={details} onUpdate={onUpdate} />;
                            case "parts": return <TabParts key={details.id} details={details} onUpdate={onUpdate} />;
                            default: return null;
                        }
                    }}
                />
            </div>
        </div>
    );
}

// --- TAB COMPONENTS ---

function DetailItem({ label, value, colSpan = 1 }: { label: string, value: React.ReactNode, colSpan?: number }) {
    return (
        <div className={cx("bg-white/5 p-3 rounded-xl border border-white/5", colSpan > 1 ? `lg:col-span-${colSpan}` : "")}>
            <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">{label}</div>
            <div className="text-sm text-zinc-200">{value || <span className="text-zinc-600">—</span>}</div>
        </div>
    );
}

function TabGeneral({ details, onUpdate }: { details: SupplierDetailsDto, onUpdate: () => void }) {
    const [edit, setEdit] = useState(false);
    const [form, setForm] = useState({
        name: details.name,
        code: details.code || "",
        websiteUrl: details.websiteUrl || "",
        isActive: details.isActive,
        isPreferred: details.isPreferred,
        notes: details.notes || "",
        // Keep other fields for update
        taxId: details.taxId || "",
        regCom: details.regCom || "",
        addressLine1: details.addressLine1 || "",
        city: details.city || "",
        county: details.county || "",
        country: details.country || "România",
        postalCode: details.postalCode || "",
        paymentTermsDays: details.paymentTermsDays || 0,
        currency: details.currency || "RON",
        iban: details.iban || "",
        bankName: details.bankName || ""
    });

    async function handleSave() {
        if (!form.name || form.name.trim().length < 2) {
            alert("Numele furnizorului trebuie să aibă minim 2 caractere.");
            return;
        }
        try {
            await suppliersApi.update(details.id, form);
            setEdit(false);
            onUpdate();
        } catch (ex: any) { alert(ex.message); }
    }

    if (edit) {
        return (
            <div className="p-4 space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Input label="Nume Furnizor *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    <Input label="Cod Intern" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                    <Input label="Site Web" value={form.websiteUrl} onChange={e => setForm({ ...form, websiteUrl: e.target.value })} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={e => setForm({ ...form, isActive: e.target.checked })}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-teal-500 focus:ring-teal-500/20"
                        />
                        <span className="text-sm text-zinc-300 group-hover:text-zinc-100">Furnizor Activ</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                        <input
                            type="checkbox"
                            checked={form.isPreferred}
                            onChange={e => setForm({ ...form, isPreferred: e.target.checked })}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/20"
                        />
                        <span className="text-sm text-zinc-300 group-hover:text-zinc-100">Furnizor Favorit ★</span>
                    </label>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <label className="block">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-2">Note Furnizor</div>
                        <textarea
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            rows={4}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                            placeholder="Note despre furnizor..."
                        />
                    </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                    <Button onClick={() => setEdit(false)} variant="ghost">Anulează</Button>
                    <Button onClick={handleSave} variant="primary">Salvează Date Generale</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <DetailItem label="Nume Furnizor" value={details.name} />
                <DetailItem label="Cod Intern" value={details.code} />
                <DetailItem label="Site Web" value={details.websiteUrl ? <a href={details.websiteUrl} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">{details.websiteUrl}</a> : null} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailItem label="Status" value={<Pill tone={details.isActive ? "teal" : "rose"}>{details.isActive ? "Activ" : "Inactiv"}</Pill>} />
                <DetailItem label="Favorit" value={details.isPreferred ? <Pill tone="amber">Favorit ★</Pill> : <span className="text-zinc-600">—</span>} />
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-2">Note Furnizor</div>
                <div className="text-sm text-zinc-300 whitespace-pre-wrap">{details.notes || "Fără note."}</div>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/5">
                <Button onClick={() => setEdit(true)} variant="primary">Editează Date Generale</Button>
            </div>
        </div>
    );
}

function TabCompany({ details, onUpdate }: { details: SupplierDetailsDto, onUpdate: () => void }) {
    const [edit, setEdit] = useState(false);
    const [form, setForm] = useState<SupplierUpdateReq>({
        name: details.name,
        code: details.code || "",
        isActive: details.isActive,
        isPreferred: details.isPreferred,
        websiteUrl: details.websiteUrl || "",
        taxId: details.taxId || "",
        regCom: details.regCom || "",
        addressLine1: details.addressLine1 || "",
        city: details.city || "",
        county: details.county || "",
        country: details.country || "România",
        postalCode: details.postalCode || "",
        paymentTermsDays: details.paymentTermsDays || 0,
        currency: details.currency || "RON",
        iban: details.iban || "",
        bankName: details.bankName || "",
        notes: details.notes || ""
    });

    async function handleSave() {
        try {
            await suppliersApi.update(details.id, form);
            setEdit(false);
            onUpdate();
        } catch (ex: any) { alert(ex.message); }
    }

    if (edit) {
        return (
            <div className="p-4 space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Input label="CUI / VAT" value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} />
                    <Input label="Reg. Com." value={form.regCom} onChange={e => setForm({ ...form, regCom: e.target.value })} />
                    <Input label="Termen Plată (zile)" type="number" value={form.paymentTermsDays} onChange={e => setForm({ ...form, paymentTermsDays: parseInt(e.target.value) || 0 })} />
                    <Input label="Monedă" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Adresă" value={form.addressLine1} onChange={e => setForm({ ...form, addressLine1: e.target.value })} />
                    <Input label="Oraș" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                    <Input label="Județ" value={form.county} onChange={e => setForm({ ...form, county: e.target.value })} />
                    <Input label="Cod Poștal" value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="IBAN" value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value })} />
                    <Input label="Bancă" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                    <Button onClick={() => setEdit(false)} variant="ghost">Anulează</Button>
                    <Button onClick={handleSave} variant="primary">Salvează Date Firmă</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <DetailItem label="CUI / VAT" value={details.taxId} />
                <DetailItem label="Reg. Com." value={details.regCom} />
                <DetailItem label="Termen Plată" value={details.paymentTermsDays ? `${details.paymentTermsDays} zile` : null} />
                <DetailItem label="Monedă Implicită" value={details.currency} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Sediu Social</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <DetailItem label="Adresă" value={details.addressLine1} colSpan={2} />
                        <DetailItem label="Oraș" value={details.city} />
                        <DetailItem label="Județ" value={details.county} />
                        <DetailItem label="Cod Poștal" value={details.postalCode} />
                        <DetailItem label="Țară" value={details.country} />
                    </div>
                </div>
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Date Bancare</h3>
                    <div className="grid grid-cols-1 gap-3">
                        <DetailItem label="IBAN" value={details.iban} />
                        <DetailItem label="Bancă" value={details.bankName} />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/5">
                <Button onClick={() => setEdit(true)} variant="primary">Editează Date Firmă</Button>
            </div>
        </div>
    );
}

function TabContacts({ details, onUpdate }: { details: SupplierDetailsDto, onUpdate: () => void }) {
    const [modal, setModal] = useState<{ open: boolean, contact: Partial<SupplierContactDto> | null }>({ open: false, contact: null });

    async function handleSaveContact() {
        if (!modal.contact?.fullName) return;
        try {
            const req: ContactSaveReq = {
                fullName: modal.contact.fullName,
                roleTitle: modal.contact.roleTitle,
                phone: modal.contact.phone,
                email: modal.contact.email,
                isPrimary: modal.contact.isPrimary ?? false,
                isActive: modal.contact.isActive ?? true,
                notes: modal.contact.notes
            };

            if (modal.contact.id) {
                await suppliersApi.updateContact(details.id, modal.contact.id, req);
            } else {
                await suppliersApi.addContact(details.id, req);
            }
            setModal({ open: false, contact: null });
            onUpdate();
        } catch (ex: any) { alert(ex.message); }
    }

    async function handleDelete(contactId: string) {
        if (!confirm("Dezactivezi acest contact?")) return;
        try {
            await suppliersApi.deleteContact(details.id, contactId);
            onUpdate();
        } catch (ex: any) { alert(ex.message); }
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setModal({ open: true, contact: {} })}>+ Adaugă Contact</Button>
            </div>

            {modal.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-hidden">
                        <h3 className="text-xl font-bold text-zinc-100 mb-6">{modal.contact?.id ? "Editare Contact" : "Contact Nou"}</h3>
                        <div className="space-y-4">
                            <Input label="Nume Complet" value={modal.contact?.fullName || ""} onChange={e => setModal({ ...modal, contact: { ...modal.contact, fullName: e.target.value } })} />
                            <Input label="Rol / Funcție" value={modal.contact?.roleTitle || ""} onChange={e => setModal({ ...modal, contact: { ...modal.contact, roleTitle: e.target.value } })} />
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Telefon" value={modal.contact?.phone || ""} onChange={e => setModal({ ...modal, contact: { ...modal.contact, phone: e.target.value } })} />
                                <Input label="Email" value={modal.contact?.email || ""} onChange={e => setModal({ ...modal, contact: { ...modal.contact, email: e.target.value } })} />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer group p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={modal.contact?.isPrimary || false}
                                    onChange={e => setModal({ ...modal, contact: { ...modal.contact, isPrimary: e.target.checked } })}
                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-teal-500 focus:ring-teal-500/20"
                                />
                                <span className="text-sm text-zinc-300 group-hover:text-zinc-100">Contact Principal</span>
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 mt-8">
                            <Button onClick={() => setModal({ open: false, contact: null })} variant="ghost">Anulează</Button>
                            <Button onClick={handleSaveContact} variant="primary">Salvează</Button>
                        </div>
                    </div>
                </div>
            )}

            <TableShell minWidth={500}>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-zinc-500 uppercase text-left border-b border-white/5">
                            <th className="px-3 py-2">Nume</th>
                            <th className="px-3 py-2">Rol / Funcție</th>
                            <th className="px-3 py-2">Contact</th>
                            <th className="px-3 py-2 text-center">Principal</th>
                            <th className="px-3 py-2 text-right">Acțiuni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {details.contacts.length === 0 && <EmptyRow colSpan={5} text="Niciun contact definit." />}
                        {details.contacts.map(c => (
                            <tr key={c.id} className={cx("group", !c.isActive && "opacity-40 grayscale")}>
                                <td className="px-3 py-3 font-medium text-zinc-200">{c.fullName}</td>
                                <td className="px-3 py-3 text-zinc-400 text-xs">{c.roleTitle || "—"}</td>
                                <td className="px-3 py-3">
                                    <div className="flex flex-col text-[11px]">
                                        {c.email && <a href={`mailto:${c.email}`} className="text-teal-400 hover:underline">{c.email}</a>}
                                        {c.phone && <a href={`tel:${c.phone}`} className="text-zinc-300 hover:underline font-mono">{c.phone}</a>}
                                    </div>
                                </td>
                                <td className="px-3 py-3 text-center">
                                    {c.isPrimary ? <span className="text-amber-400">★</span> : <span className="text-zinc-800">—</span>}
                                </td>
                                <td className="px-3 py-3 text-right flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="sm" onClick={() => setModal({ open: true, contact: c })}>Editează</Button>
                                    <Button variant="ghost" size="sm" className="text-rose-400" onClick={() => handleDelete(c.id)}>Sterge</Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableShell>
        </div>
    );
}

function TabParts({ details, onUpdate }: { details: SupplierDetailsDto, onUpdate: () => void }) {
    const [showAdd, setShowAdd] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<PartDto[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedPart, setSelectedPart] = useState<PartDto | null>(null);
    const [newPartForm, setNewPartForm] = useState({
        supplierSku: "",
        lastUnitPrice: "",
        currency: details.currency || "RON",
        leadTimeDays: "",
        notes: ""
    });

    // Editing state for inline edit
    const [editingPartId, setEditingPartId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{
        supplierSku: string;
        lastUnitPrice: string;
        currency: string;
        leadTimeDays: string;
    } | null>(null);

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const results = await getParts({ q: searchQuery, take: 20 });
                const associatedIds = new Set(details.parts.map(p => p.partId));
                setSearchResults(results.filter(p => !associatedIds.has(p.id)));
            } catch (ex: any) {
                console.error(ex);
            } finally {
                setSearchLoading(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, details.parts]);

    async function handleAssociate() {
        if (!selectedPart) return;
        try {
            await suppliersApi.addSupplierPart(details.id, {
                partId: selectedPart.id,
                supplierSku: newPartForm.supplierSku || undefined,
                lastUnitPrice: newPartForm.lastUnitPrice ? parseFloat(newPartForm.lastUnitPrice) : undefined,
                currency: newPartForm.currency || undefined,
                leadTimeDays: newPartForm.leadTimeDays ? parseInt(newPartForm.leadTimeDays) : undefined,
                notes: newPartForm.notes || undefined,
                isActive: true
            });
            setShowAdd(false);
            setSearchQuery("");
            setSelectedPart(null);
            setNewPartForm({ supplierSku: "", lastUnitPrice: "", currency: details.currency || "RON", leadTimeDays: "", notes: "" });
            onUpdate();
        } catch (ex: any) { alert(ex.message); }
    }

    async function handleDelete(partId: string) {
        if (!confirm("Sigur elimini această piesă din catalogul furnizorului?")) return;
        try {
            await suppliersApi.deleteSupplierPart(details.id, partId);
            onUpdate();
        } catch (ex: any) { alert(ex.message); }
    }

    function startEdit(part: any) {
        setEditingPartId(part.id);
        setEditForm({
            supplierSku: part.supplierSku || "",
            lastUnitPrice: part.lastUnitPrice?.toString() || "",
            currency: part.currency || "RON",
            leadTimeDays: part.leadTimeDays?.toString() || ""
        });
    }

    async function saveEdit(part: any) {
        if (!editForm) return;
        try {
            await suppliersApi.updateSupplierPart(details.id, part.id, {
                partId: part.partId,
                supplierSku: editForm.supplierSku || undefined,
                lastUnitPrice: editForm.lastUnitPrice ? parseFloat(editForm.lastUnitPrice) : undefined,
                currency: editForm.currency || undefined,
                leadTimeDays: editForm.leadTimeDays ? parseInt(editForm.leadTimeDays) : undefined,
                isActive: part.isActive
            });
            setEditingPartId(null);
            setEditForm(null);
            onUpdate();
        } catch (ex: any) {
            alert(ex.message);
        }
    }

    function cancelEdit() {
        setEditingPartId(null);
        setEditForm(null);
    }

    return (
        <div className="p-4 space-y-4">
            <div className="flex justify-between items-center px-1">
                <span className="text-xs text-zinc-500">{details.parts.length} piese în catalog</span>
                <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>
                    {showAdd ? "Închide" : "+ Asociază Piesă"}
                </Button>
            </div>

            {showAdd && (
                <div className="bg-teal-500/5 border border-teal-500/20 rounded-2xl p-4 shadow-inner space-y-4">
                    <h3 className="text-xs font-bold text-teal-400 mb-3 px-1">Căutare și Asociere Piesă</h3>

                    {/* Search Input */}
                    <div className="relative">
                        <Input
                            placeholder="Caută piesă după nume sau cod/SKU..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {searchQuery.trim() && searchResults.length > 0 && !selectedPart && (
                        <div className="bg-zinc-950/80 border border-white/10 rounded-xl max-h-64 overflow-y-auto custom-scrollbar">
                            {searchResults.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        setSelectedPart(p);
                                        setSearchQuery("");
                                        setSearchResults([]);
                                    }}
                                    className="p-3 hover:bg-teal-500/10 cursor-pointer border-b border-white/5 last:border-0 transition-colors"
                                >
                                    <div className="text-sm font-medium text-zinc-200">{p.code ? `${p.code} — ${p.name}` : p.name}</div>
                                    {p.uom && <div className="text-[10px] text-zinc-500">UM: {p.uom}</div>}
                                </div>
                            ))}
                        </div>
                    )}

                    {searchQuery.trim() && searchResults.length === 0 && !searchLoading && !selectedPart && (
                        <div className="text-center text-zinc-600 text-xs italic py-4">Nicio piesă găsită.</div>
                    )}

                    {/* Selected Part Form */}
                    {selectedPart && (
                        <div className="bg-zinc-900/60 border border-teal-500/30 rounded-xl p-4 space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-sm font-bold text-teal-400">{selectedPart.name}</div>
                                    <div className="text-[10px] text-zinc-500 font-mono uppercase">{selectedPart.code}</div>
                                </div>
                                <button
                                    onClick={() => setSelectedPart(null)}
                                    className="text-zinc-500 hover:text-zinc-300"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="SKU Furnizor"
                                    value={newPartForm.supplierSku}
                                    onChange={e => setNewPartForm({ ...newPartForm, supplierSku: e.target.value })}
                                    placeholder="SKU-ul furnizorului"
                                />
                                <Input
                                    label="Preț Unitar"
                                    type="number"
                                    step="0.01"
                                    value={newPartForm.lastUnitPrice}
                                    onChange={e => setNewPartForm({ ...newPartForm, lastUnitPrice: e.target.value })}
                                    placeholder="0.00"
                                />
                                <Input
                                    label="Monedă"
                                    value={newPartForm.currency}
                                    onChange={e => setNewPartForm({ ...newPartForm, currency: e.target.value })}
                                />
                                <Input
                                    label="Lead Time (zile)"
                                    type="number"
                                    value={newPartForm.leadTimeDays}
                                    onChange={e => setNewPartForm({ ...newPartForm, leadTimeDays: e.target.value })}
                                    placeholder="0"
                                />
                            </div>

                            <Input
                                label="Note"
                                value={newPartForm.notes}
                                onChange={e => setNewPartForm({ ...newPartForm, notes: e.target.value })}
                                placeholder="Note despre această asociere..."
                            />

                            <div className="flex justify-end gap-2">
                                <Button onClick={() => setSelectedPart(null)} variant="ghost" size="sm">Anulează</Button>
                                <Button onClick={handleAssociate} variant="primary" size="sm">Asociază</Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <TableShell minWidth={700}>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-zinc-500 uppercase text-left border-b border-white/5">
                            <th className="px-3 py-2">Piesă / Cod</th>
                            <th className="px-3 py-2">SKU Furnizor</th>
                            <th className="px-3 py-2 text-right">Preț Unitar</th>
                            <th className="px-3 py-2 text-center">Lead Time</th>
                            <th className="px-3 py-2 text-right">Acțiuni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {details.parts.length === 0 && <EmptyRow colSpan={5} text="Catalogul este gol." />}
                        {details.parts.map(p => (
                            <tr key={p.id} className="group">
                                <td className="px-3 py-3">
                                    <div className="font-medium text-zinc-200">{p.partName}</div>
                                    <div className="text-[10px] text-zinc-500 font-mono uppercase">{p.partCode}</div>
                                </td>
                                <td className="px-3 py-3">
                                    {editingPartId === p.id ? (
                                        <input
                                            type="text"
                                            value={editForm?.supplierSku || ""}
                                            onChange={e => setEditForm({ ...editForm!, supplierSku: e.target.value })}
                                            className="w-full bg-white/5 border border-teal-500/40 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                                            placeholder="SKU"
                                        />
                                    ) : (
                                        <span className="text-zinc-400 font-mono text-sm">{p.supplierSku || "—"}</span>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-right">
                                    {editingPartId === p.id ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editForm?.lastUnitPrice || ""}
                                                onChange={e => setEditForm({ ...editForm!, lastUnitPrice: e.target.value })}
                                                className="w-24 bg-white/5 border border-teal-500/40 rounded px-2 py-1 text-sm text-zinc-200 text-right focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                                                placeholder="0.00"
                                            />
                                            <input
                                                type="text"
                                                value={editForm?.currency || ""}
                                                onChange={e => setEditForm({ ...editForm!, currency: e.target.value })}
                                                className="w-16 bg-white/5 border border-teal-500/40 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                                                placeholder="RON"
                                            />
                                        </div>
                                    ) : (
                                        <div className="font-mono text-zinc-200">
                                            {p.lastUnitPrice?.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} {p.currency}
                                            {p.discountPercent ? <div className="text-[10px] text-emerald-400">-{p.discountPercent}%</div> : null}
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-center">
                                    {editingPartId === p.id ? (
                                        <input
                                            type="number"
                                            value={editForm?.leadTimeDays || ""}
                                            onChange={e => setEditForm({ ...editForm!, leadTimeDays: e.target.value })}
                                            className="w-20 mx-auto bg-white/5 border border-teal-500/40 rounded px-2 py-1 text-sm text-zinc-200 text-center focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                                            placeholder="0"
                                        />
                                    ) : (
                                        <span className="text-zinc-400">{p.leadTimeDays ? `${p.leadTimeDays} zile` : "—"}</span>
                                    )}
                                </td>
                                <td className="px-3 py-3 text-right">
                                    {editingPartId === p.id ? (
                                        <div className="flex justify-end gap-1">
                                            <button
                                                onClick={() => saveEdit(p)}
                                                className="p-1 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors"
                                                title="Salvează"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="p-1 rounded-lg bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 transition-colors"
                                                title="Anulează"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>Editează</Button>
                                            <button onClick={() => handleDelete(p.id)} className="text-rose-400/50 hover:text-rose-400 p-1">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableShell>
        </div>
    );
}

