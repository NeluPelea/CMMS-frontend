import { useState } from "react";
import { Modal, Button, cx } from "./ui";
import { type WorkOrderDto, type LaborLogDto } from "../api";

interface CompleteOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    workOrder: WorkOrderDto;
    laborLogs: LaborLogDto[];
    partsCount: number;
    onConfirm: (solution: string) => Promise<void>;
}

export default function CompleteOrderModal({
    isOpen,
    onClose,
    workOrder,
    laborLogs,
    partsCount,
    onConfirm
}: CompleteOrderModalProps) {
    const [solution, setSolution] = useState("");
    const [loading, setLoading] = useState(false);

    const totalTasks = workOrder.tasks?.length || 0;
    const completedTasks = workOrder.tasks?.filter((t: any) => t.isCompleted).length || 0;
    const allTasksDone = totalTasks === completedTasks;

    const totalHours = laborLogs.reduce((acc, curr) => acc + (curr.minutes / 60), 0);

    const isValid = allTasksDone && solution.trim().length >= 5;

    const handleConfirm = async () => {
        if (!isValid || loading) return;
        setLoading(true);
        try {
            await onConfirm(solution.trim());
        } catch (e: any) {
            alert(e.message || "Eroare la finalizarea comenzii");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Finalizare Lucrare"
            widthClassName="max-w-xl"
        >
            <div className="space-y-6">
                {/* Summary Section */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Sarcini</div>
                        <div className={cx(
                            "text-xl font-black",
                            allTasksDone ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {completedTasks} / {totalTasks}
                        </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Ore</div>
                        <div className="text-xl font-black text-teal-400">
                            {totalHours.toFixed(1)}h
                        </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Piese</div>
                        <div className="text-xl font-black text-indigo-400">
                            {partsCount}
                        </div>
                    </div>
                </div>

                {!allTasksDone && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
                        ⚠️ Atenție: Mai sunt sarcini nefinalizate în checklist!
                    </div>
                )}

                {/* Feedback Section */}
                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                        Soluție / Notă Finală <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-teal-400/40 min-h-[120px] transition-all"
                        placeholder="Descrie pe scurt ce s-a reparat sau ce intervenție a avut loc..."
                        value={solution}
                        onChange={(e) => setSolution(e.target.value)}
                        disabled={loading}
                    />
                    <div className="mt-1 text-[10px] text-zinc-500 text-right">
                        Minim 5 caractere necesare.
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Anulează
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        disabled={!isValid || loading}
                    >
                        {loading ? "Se închide..." : "Confirmă și Închide"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
