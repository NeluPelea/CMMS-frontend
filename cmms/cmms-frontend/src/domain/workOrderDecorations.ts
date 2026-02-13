import type { WorkOrderDto } from "../api";
import { WorkOrderClassification, WorkOrderStatus, WorkOrderType } from "./enums";

export interface WorkOrderDecoration {
    borderClass: string;
    showReactiveBadge: boolean;
}

export function getWorkOrderDecoration(wo: WorkOrderDto): WorkOrderDecoration {
    let borderClass = "border-l-4 border-l-zinc-500"; // fallback neutral
    let showReactiveBadge = false;

    // A) Status based
    if (wo.status === WorkOrderStatus.Done || wo.status === WorkOrderStatus.Cancelled) {
        borderClass = "border-l-4 border-l-emerald-700";
    } else if (wo.status === WorkOrderStatus.InProgress) {
        borderClass = "border-l-4 border-l-emerald-400";
    } else {
        // Open/New - Type based
        if (wo.type === WorkOrderType.Preventive || !!wo.pmPlanId) {
            borderClass = "border-l-4 border-l-amber-500";
        } else if (wo.classification === WorkOrderClassification.Proactive) {
            borderClass = "border-l-4 border-l-sky-500";
        } else if (wo.classification === WorkOrderClassification.Reactive) {
            borderClass = "border-l-4 border-l-rose-600";
            showReactiveBadge = true;
        } else {
            // Default Open/New
            borderClass = "border-l-4 border-l-zinc-500";
        }
    }

    return { borderClass, showReactiveBadge };
}

export function getResponsibleDisplayName(wo: WorkOrderDto): string {
    if (wo.assignedToPerson && wo.assignedToPerson.displayName) {
        return wo.assignedToPerson.displayName;
    }
    // Fallback if we had team logic, but currently we don't have it in DTO.
    return "Nealocat";
}
