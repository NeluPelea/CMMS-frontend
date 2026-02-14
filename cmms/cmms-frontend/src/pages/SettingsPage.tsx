import React, { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { Card, ErrorBox, Input, Button } from "../components/ui";
import { apiFetch, API_BASE, getToken } from "../api/http";
import { getSettings, updateSettings, type SettingsDto } from "../api/settings";
import { hasPerm } from "../api/auth";

interface TemplateMetadata {
    type: number;
    fileName: string;
    updatedAt: string;
}

export default function SettingsPage() {
    // Document Templates
    const [templates, setTemplates] = useState<TemplateMetadata[]>([]);

    // Global Settings
    const [settings, setSettings] = useState<SettingsDto>({ vatRate: 0, fxRonEur: 0, fxRonUsd: 0 });

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    async function load() {
        try {
            setLoading(true);
            const [tmpl, cfg] = await Promise.all([
                apiFetch<TemplateMetadata[]>("/api/document-templates"),
                getSettings()
            ]);
            setTemplates(tmpl);
            setSettings(cfg);
        } catch (err: any) {
            setError(err.message || "Eroare la incarcarea datelor");
        } finally {
            setLoading(false);
        }
    }

    async function onSaveSettings() {
        try {
            setLoading(true);
            setSuccess(null);
            setError(null);
            await updateSettings(settings);
            setSuccess("Setari salvate cu succes!");
        } catch (err: any) {
            setError(err.message || "Eroare la salvare");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, endpoint: string) {
        // ... (existing upload logic remains mostly same but using unified state)
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "image/png") {
            setError("Sunt permise doar fisierele .png.");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("Dimensiune maxima 5MB.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const token = getToken();
            const res = await fetch(`${API_BASE}/api/document-templates/${endpoint}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.message || `HTTP ${res.status}`);
            }

            setSuccess("Sablon incarcat cu succes!");
            load(); // reload all
        } catch (err: any) {
            setError(err.message || "Incarcare esuata");
            setLoading(false);
        } finally {
            e.target.value = "";
        }
    }

    const headerTemplate = templates.find((t: TemplateMetadata) => t.type === 1);
    const footerTemplate = templates.find((t: TemplateMetadata) => t.type === 2);

    return (
        <AppShell title="Setari">
            <div className="max-w-4xl space-y-6">
                {error && <ErrorBox message={error} onClose={() => setError(null)} />}
                {success && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl flex justify-between items-center text-sm">
                        {success}
                        <button onClick={() => setSuccess(null)}>&times;</button>
                    </div>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Tile: Cota TVA */}
                    <Card title="Cota TVA">
                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
                                    Valoare (%)
                                </label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={settings.vatRate}
                                        onChange={e => setSettings({ ...settings, vatRate: parseFloat(e.target.value) || 0 })}
                                    />
                                    <span className="text-zinc-400 font-bold text-lg">%</span>
                                </div>
                            </div>
                            {hasPerm("SETTINGS_UPDATE") && (
                                <div className="pt-2">
                                    <Button onClick={onSaveSettings} disabled={loading} variant="primary">
                                        Salveaza
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Tile: Curs BNR */}
                    <Card title="Curs BNR">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
                                        RON / EUR
                                    </label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        value={settings.fxRonEur}
                                        onChange={e => setSettings({ ...settings, fxRonEur: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
                                        RON / USD
                                    </label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        value={settings.fxRonUsd}
                                        onChange={e => setSettings({ ...settings, fxRonUsd: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                            <div className="pt-2">
                                <Button onClick={onSaveSettings} disabled={loading} variant="primary">
                                    Salveaza
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>

                <Card title="Module Documente PDF (PNG Template)">
                    {/* ... existing template logic ... */}
                    <p className="text-zinc-400 text-sm mb-6">
                        Incarca logo-uri sau antete/subsoluri in format PNG pentru a fi folosite in documentele generate automat (QuestPDF).
                    </p>

                    <div className="grid gap-8 sm:grid-cols-2">
                        {/* Header Section */}
                        <div className="space-y-4">
                            <h3 className="text-zinc-200 font-semibold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                                Header (Antet)
                            </h3>

                            <div className="relative group aspect-[3/1] rounded-xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center p-4 overflow-hidden transition hover:border-teal-500/50">
                                {headerTemplate ? (
                                    <>
                                        <img
                                            src={`${API_BASE}/api/document-templates/header-png?t=${new Date(headerTemplate.updatedAt).getTime()}`}
                                            alt="Header preview"
                                            className="max-h-full max-w-full object-contain"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                            {hasPerm("SETTINGS_UPDATE") && (
                                                <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-lg font-medium text-sm">
                                                    Schimba PNG
                                                    <input type="file" accept=".png" className="hidden" onChange={(e) => handleUpload(e, "header-png")} disabled={loading} />
                                                </label>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    hasPerm("SETTINGS_UPDATE") && (
                                        <label className="cursor-pointer flex flex-col items-center gap-2">
                                            <div className="text-2xl">🖼️</div>
                                            <span className="text-sm text-zinc-400">Click pentru a incarca header.png</span>
                                            <input type="file" accept=".png" className="hidden" onChange={(e) => handleUpload(e, "header-png")} disabled={loading} />
                                        </label>
                                    )
                                )}
                            </div>

                            {headerTemplate && (
                                <div className="space-y-1">
                                    <div className="text-[10px] text-zinc-500 font-mono">
                                        Fisier: {headerTemplate.fileName}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-mono">
                                        Ultima actualizare: {new Date(headerTemplate.updatedAt).toLocaleString()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Section */}
                        <div className="space-y-4">
                            <h3 className="text-zinc-200 font-semibold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                                Footer (Subsol)
                            </h3>

                            <div className="relative group aspect-[3/1] rounded-xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center p-4 overflow-hidden transition hover:border-teal-500/50">
                                {footerTemplate ? (
                                    <>
                                        <img
                                            src={`${API_BASE}/api/document-templates/footer-png?t=${new Date(footerTemplate.updatedAt).getTime()}`}
                                            alt="Footer preview"
                                            className="max-h-full max-w-full object-contain"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                            {hasPerm("SETTINGS_UPDATE") && (
                                                <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-lg font-medium text-sm">
                                                    Schimba PNG
                                                    <input type="file" accept=".png" className="hidden" onChange={(e) => handleUpload(e, "footer-png")} disabled={loading} />
                                                </label>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    hasPerm("SETTINGS_UPDATE") && (
                                        <label className="cursor-pointer flex flex-col items-center gap-2">
                                            <div className="text-2xl">🖼️</div>
                                            <span className="text-sm text-zinc-400">Click pentru a incarca footer.png</span>
                                            <input type="file" accept=".png" className="hidden" onChange={(e) => handleUpload(e, "footer-png")} disabled={loading} />
                                        </label>
                                    )
                                )}
                            </div>

                            {footerTemplate && (
                                <div className="space-y-1">
                                    <div className="text-[10px] text-zinc-500 font-mono">
                                        Fisier: {footerTemplate.fileName}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-mono">
                                        Ultima actualizare: {new Date(footerTemplate.updatedAt).toLocaleString()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
                        <strong>Info:</strong> PNG-urile incarcate vor aparea automat pe fiecare pagina a rapoartelor exportate in format PDF.
                    </div>
                </Card>
            </div>
        </AppShell>
    );
}
