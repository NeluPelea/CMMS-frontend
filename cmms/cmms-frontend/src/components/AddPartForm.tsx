import React, { useState, useEffect, useCallback } from "react";
import { getParts, addWorkOrderPart, type PartDto } from "../api";
import { Button, Input, ErrorBox } from "./ui";

interface AddPartFormProps {
    workOrderId: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export function AddPartForm({ workOrderId, onSuccess, onCancel }: AddPartFormProps) {
    const [search, setSearch] = useState("");
    const [parts, setParts] = useState<PartDto[]>([]);
    const [selectedPart, setSelectedPart] = useState<PartDto | null>(null);
    const [qty, setQty] = useState("1");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const searchParts = useCallback(async () => {
        if (search.length < 2) {
            setParts([]);
            return;
        }
        setLoading(true);
        try {
            const data = await getParts({ q: search, take: 10, ia: true });
            setParts(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        const timer = setTimeout(searchParts, 300);
        return () => clearTimeout(timer);
    }, [searchParts]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPart) return;
        const n = Number(qty);
        if (isNaN(n) || n <= 0) return;

        setLoading(true);
        setError(null);
        try {
            await addWorkOrderPart(workOrderId, selectedPart.id, n);
            onSuccess();
        } catch (e: any) {
            setError(e.message || "Eroare la adaugarea piesei");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && <ErrorBox message={error} onClose={() => setError(null)} />}

            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Cauta Piesa
                </label>
                <div className="relative">
                    <Input
                        value={selectedPart ? selectedPart.name : search}
                        onChange={(e) => {
                            if (selectedPart) setSelectedPart(null);
                            setSearch(e.target.value);
                        }}
                        placeholder="Nume sau cod piesa..."
                        autoFocus
                    />
                    {loading && (
                        <div className="absolute right-3 top-2.5">
                            <div className="w-5 h-5 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                        </div>
                    )}
                </div>

                {!selectedPart && parts.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {parts.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                className="w-full px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                                onClick={() => {
                                    setSelectedPart(p);
                                    setSearch("");
                                    setParts([]);
                                }}
                            >
                                <div className="text-sm font-medium text-zinc-200">{p.name}</div>
                                <div className="text-xs text-zinc-500">{p.code || "Fara cod"}</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Cantitate
                </label>
                <Input
                    type="number"
                    min="1"
                    step="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Anuleaza
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={!selectedPart || loading}
                >
                    {loading ? "Se salveaza..." : "Adauga Piesa"}
                </Button>
            </div>
        </form>
    );
}
