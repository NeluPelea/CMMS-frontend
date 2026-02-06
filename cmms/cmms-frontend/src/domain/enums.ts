// src/domain/enums.ts
export const WorkOrderType = {
    Corrective: 1,
    Preventive: 2,
    Improvement: 3,
    Project: 4
} as const;

export type WorkOrderType = typeof WorkOrderType[keyof typeof WorkOrderType];

export const WorkOrderStatus = {
    Open: 1,
    InProgress: 2,
    Done: 3,
    Cancelled: 4
} as const;

export type WorkOrderStatus = typeof WorkOrderStatus[keyof typeof WorkOrderStatus];

export function woStatusLabel(s: WorkOrderStatus): string {
    switch (s) {
        case WorkOrderStatus.Open: return "Deschis";
        case WorkOrderStatus.InProgress: return "In Lucru";
        case WorkOrderStatus.Done: return "Finalizat";
        case WorkOrderStatus.Cancelled: return "Anulat";
        default: return "Necunoscut";
    }
}

export function woTypeLabel(t: WorkOrderType): string {
    switch (t) {
        case WorkOrderType.Corrective: return "Correctiv";
        case WorkOrderType.Preventive: return "Preventiv";
        case WorkOrderType.Improvement: return "Imbunatatire";
        case WorkOrderType.Project: return "Proiect";
        default: return "Altul";
    }
}