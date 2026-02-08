import { useState } from "react";
import AppShell from "../components/AppShell";
import { Button, Card, ErrorBox, PageToolbar } from "../components/ui";
import { chatAi, type AiChatRequest } from "../api";

export default function AiCopilotPage() {
    const [message, setMessage] = useState("");
    const [assetId, setAssetId] = useState("");
    const [fromUtc, setFromUtc] = useState("");
    const [toUtc, setToUtc] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [answer, setAnswer] = useState<string | null>(null);

    const handleSend = async () => {
        if (!message.trim()) {
            setError("Va rugam introduceti un mesaj");
            return;
        }

        setLoading(true);
        setError(null);
        setAnswer(null);

        try {
            const request: AiChatRequest = {
                message: message.trim(),
            };

            if (assetId.trim()) {
                request.assetId = assetId.trim();
            }

            if (fromUtc) {
                request.fromUtc = new Date(fromUtc).toISOString();
            }

            if (toUtc) {
                request.toUtc = new Date(toUtc).toISOString();
            }

            const response = await chatAi(request);
            setAnswer(response.answer);
        } catch (err: any) {
            setError(err.message || "Eroare la obtinerea raspunsului AI");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppShell>
            <PageToolbar
                left={
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-100">AI Copilot</h1>
                        <p className="text-sm text-zinc-400">Asistent mentenanta bazat pe Groq AI</p>
                    </div>
                }
            />

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Input Card */}
                <Card>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-2">
                                Mesaj <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Intreaba orice despre mentenanta, utilaje sau ordine de lucru..."
                                rows={4}
                                className="w-full px-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 resize-none"
                                disabled={loading}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    ID Utilaj (optional)
                                </label>
                                <input
                                    type="text"
                                    value={assetId}
                                    onChange={(e) => setAssetId(e.target.value)}
                                    placeholder="Asset GUID"
                                    className="w-full px-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    De la (optional)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={fromUtc}
                                    onChange={(e) => setFromUtc(e.target.value)}
                                    className="w-full px-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Pana la (optional)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={toUtc}
                                    onChange={(e) => setToUtc(e.target.value)}
                                    className="w-full px-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                onClick={handleSend}
                                disabled={loading || !message.trim()}
                                variant="primary"
                            >
                                {loading ? "Se trimite..." : "Trimite"}
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Error */}
                {error && <ErrorBox message={error} />}

                {/* Response Card */}
                {answer && (
                    <Card>
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-teal-400 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                Raspuns AI
                            </h3>
                            <div className="prose prose-invert prose-sm max-w-none">
                                <pre className="whitespace-pre-wrap text-zinc-300 font-sans text-sm leading-relaxed bg-zinc-900/50 p-4 rounded-lg border border-white/5">
                                    {answer}
                                </pre>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Help Card */}
                <Card>
                    <div className="p-6">
                        <h3 className="text-sm font-semibold text-zinc-400 mb-3">💡 Sfat</h3>
                        <ul className="text-xs text-zinc-500 space-y-2">
                            <li>• Intreaba despre istoricul mentenantei utilajului, probleme comune sau recomandari</li>
                            <li>• Furnizeaza un ID Utilaj pentru informatii contextuale</li>
                            <li>• Asistentul AI este read-only si nu va face modificari in datele tale</li>
                            <li>• Bazat pe Groq AI folosind modelul llama-3.3-70b-versatile</li>
                        </ul>
                    </div>
                </Card>
            </div>
        </AppShell>
    );
}
