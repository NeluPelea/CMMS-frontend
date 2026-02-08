import React, { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { Card, ErrorBox } from "../components/ui";
import { apiFetch, API_BASE, getToken } from "../api/http";

interface TemplateMetadata {
    type: number;
    fileName: string;
    updatedAt: string;
}

export default function SettingsPage() {
    const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    async function load() {
        try {
            setLoading(true);
            const data = await apiFetch<TemplateMetadata[]>("/api/document-templates");
            setTemplates(data);
        } catch (err: any) {
            setError(err.message || "Failed to load templates");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, endpoint: string) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== "image/png") {
            setError("Only .png files are allowed.");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("Max file size 5MB.");
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

            setSuccess("Template uploaded successfully!");
            await load();
        } catch (err: any) {
            setError(err.message || "Upload failed");
        } finally {
            setLoading(false);
            e.target.value = ""; // clear input
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

                <Card title="Module Documente PDF (PNG Template)">
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
                                            <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-lg font-medium text-sm">
                                                Change PNG
                                                <input type="file" accept=".png" className="hidden" onChange={(e) => handleUpload(e, "header-png")} disabled={loading} />
                                            </label>
                                        </div>
                                    </>
                                ) : (
                                    <label className="cursor-pointer flex flex-col items-center gap-2">
                                        <div className="text-2xl">🖼️</div>
                                        <span className="text-sm text-zinc-400">Click to upload header.png</span>
                                        <input type="file" accept=".png" className="hidden" onChange={(e) => handleUpload(e, "header-png")} disabled={loading} />
                                    </label>
                                )}
                            </div>

                            {headerTemplate && (
                                <div className="space-y-1">
                                    <div className="text-[10px] text-zinc-500 font-mono">
                                        File: {headerTemplate.fileName}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-mono">
                                        Last update: {new Date(headerTemplate.updatedAt).toLocaleString()}
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
                                            <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-lg font-medium text-sm">
                                                Change PNG
                                                <input type="file" accept=".png" className="hidden" onChange={(e) => handleUpload(e, "footer-png")} disabled={loading} />
                                            </label>
                                        </div>
                                    </>
                                ) : (
                                    <label className="cursor-pointer flex flex-col items-center gap-2">
                                        <div className="text-2xl">🖼️</div>
                                        <span className="text-sm text-zinc-400">Click to upload footer.png</span>
                                        <input type="file" accept=".png" className="hidden" onChange={(e) => handleUpload(e, "footer-png")} disabled={loading} />
                                    </label>
                                )}
                            </div>

                            {footerTemplate && (
                                <div className="space-y-1">
                                    <div className="text-[10px] text-zinc-500 font-mono">
                                        File: {footerTemplate.fileName}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-mono">
                                        Last update: {new Date(footerTemplate.updatedAt).toLocaleString()}
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
