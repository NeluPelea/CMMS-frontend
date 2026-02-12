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

export const WorkOrderClassification = {
    Proactive: 1,
    Reactive: 2
} as const;

export type WorkOrderClassification = typeof WorkOrderClassification[keyof typeof WorkOrderClassification];


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

export function woClassificationLabel(c: WorkOrderClassification): string {
    switch (c) {
        case WorkOrderClassification.Proactive: return "Proactiv";
        case WorkOrderClassification.Reactive: return "Reactiv";
        default: return "Reactiv";
    }
}

export const NcOrderStatus = {
    Draft: 0,
    Sent: 1,
    Confirmed: 2,
    PartiallyReceived: 3,
    Received: 4,
    Cancelled: 5
} as const;

export type NcOrderStatus = typeof NcOrderStatus[keyof typeof NcOrderStatus];

export function ncStatusLabel(s: NcOrderStatus): string {
    switch (s) {
        case NcOrderStatus.Draft: return "Draft";
        case NcOrderStatus.Sent: return "Trimis";
        case NcOrderStatus.Confirmed: return "Confirmat";
        case NcOrderStatus.PartiallyReceived: return "Receptionat Partial";
        case NcOrderStatus.Received: return "Receptionat Total";
        case NcOrderStatus.Cancelled: return "Anulat";
        default: return "Draft";
    }
}