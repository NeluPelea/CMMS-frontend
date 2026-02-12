import { useEffect, useState } from "react";
import { Button, Card, ErrorBox, Input } from "./ui";
import { adjustInventory, getInventory, type InventoryRowDto } from "../api";

export function StockAdjustmentTile({ onAdjusted }: { onAdjusted?: (partId: string) => void }) {
    // Search state
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<InventoryRowDto[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Selection
    const [selectedItem, setSelectedItem] = useState<InventoryRowDto | null>(null);

    // Adjustment state
    const [delta, setDelta] = useState<string>("");
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Debounced search
    useEffect(() => {
        const t = setTimeout(async () => {
            // searching...
            if (!searchTerm.trim()) {
                setSearchResults([]);
                return;
            }

            // prevent search if we just selected an item and searchTerm matches
            if (selectedItem && searchTerm === selectedItem.partName) {
                return;
            }

            setIsSearching(true);
            try {
                const data = await getInventory({ q: searchTerm, take: 50 });
                setSearchResults(data);
                setShowResults(true);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 400);

        return () => clearTimeout(t);
    }, [searchTerm, selectedItem]);

    // accepts "2,5" or "2.5"
    function parseNumberLoose(input: string): number | null {
        const s = (input ?? "").trim().replace(/\s+/g, "").replace(",", ".");
        if (!s) return null;
        const n = Number(s);
        if (!Number.isFinite(n)) return null;
        return n;
    }

    async function onAdjust() {
        if (!selectedItem) return;

        setErr(null);
        const n = parseNumberLoose(delta);

        if (n == null || n === 0) {
            setErr("Delta trebuie sa fie un numar diferit de zero (ex: 1, -0.5, 2,5).");
            return;
        }

        try {
            setLoading(true);
            await adjustInventory(selectedItem.id, n);
            setDelta("");
            setErr(null);

            // Reload just to confirm persistence, but UI logic is disconnected
            // To be perfect we should re-fetch this item to update stock in UI if we wanted
            // For now, assume success and maybe clear selection or keep it

            // Update the selected item's qty locally to reflect change immediately?
            // Let's just create a new object with updated qty
            const updatedItem = { ...selectedItem, qtyOnHand: selectedItem.qtyOnHand + n };
            setSelectedItem(updatedItem);

            onAdjusted?.(selectedItem.partId);
        } catch (e: any) {
            setErr(e?.message || String(e));
        } finally {
            setLoading(false);
        }
    }

    function onSelect(x: InventoryRowDto) {
        setSelectedItem(x);
        setSearchTerm(x.partName);
        setShowResults(false);
    }

    return (
        <Card title="Ajustare stoc">
            {err && <ErrorBox message={err} />}
            <div className="grid gap-3 lg:grid-cols-12 items-end">
                {/* Search Input */}
                <div className="lg:col-span-6 relative">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        Articol
                    </div>
                    <Input
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setShowResults(true);
                            if (!e.target.value) setSelectedItem(null);
                        }}
                        placeholder="Cauta piesa..."
                        className="w-full"
                    />
                    {/* Dropdown results */}
                    {showResults && searchResults.length > 0 && (
                        <div className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-md border border-white/10 bg-zinc-800 shadow-lg">
                            {searchResults.map((x) => (
                                <button
                                    key={x.id}
                                    className="block w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-white/5 focus:bg-white/5 focus:outline-none"
                                    onClick={() => onSelect(x)}
                                >
                                    <div className="font-medium text-zinc-100">{x.partName}</div>
                                    <div className="text-xs text-zinc-400">
                                        SKU: {x.skuCode || "-"} | Stoc: {x.qtyOnHand}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    {isSearching && <div className="absolute right-3 top-9 text-xs text-zinc-500">...</div>}
                </div>

                {/* SKU column REMOVED */}

                <div className="lg:col-span-1">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        U.M.
                    </div>
                    <Input
                        value={selectedItem?.uom || ""}
                        readOnly
                        placeholder="-"
                        className="bg-white/5 text-zinc-500"
                    />
                </div>

                <div className="lg:col-span-2">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        MONEDA
                    </div>
                    <div className="flex gap-1">
                        <Input
                            value={selectedItem?.purchasePrice?.toFixed(2) || ""}
                            readOnly
                            placeholder="-"
                            className="bg-white/5 text-zinc-500"
                        />
                        <Input
                            value={selectedItem?.purchaseCurrency || ""}
                            readOnly
                            placeholder="-"
                            className="w-16 bg-white/5 text-zinc-500"
                        />
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        Delta (+/-)
                    </div>
                    <Input
                        value={delta}
                        onChange={(e) => setDelta(e.target.value)}
                        placeholder="ex: 1, -0.5"
                    />
                </div>

                <div className="lg:col-span-1 flex justify-end">
                    <Button onClick={onAdjust} disabled={!selectedItem || loading} variant="primary">
                        Aplica
                    </Button>
                </div>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
                INFO: Selecteaza o piesa din lista. Valorile pozitive (ex: 5) adauga stoc, cele negative (ex: -2) scad stocul.
            </div>
        </Card>
    );
}
