// src/domain/enums.ts
export enum WorkOrderType {
  // Ajusteaza denumirile daca vrei "Corrective" vs "AdHoc"
  AdHoc = 1,
  Preventive = 2,
  Extra = 3,
}

export enum WorkOrderStatus {
  Open = 1,
  InProgress = 2,
  Done = 3,
  Cancelled = 4,
}

export function woTypeLabel(t: number) {
  switch (t) {
    case WorkOrderType.AdHoc:
      return "AdHoc";
    case WorkOrderType.Preventive:
      return "Preventive";
    case WorkOrderType.Extra:
      return "Extra";
    default:
      return `Type ${t}`;
  }
}

export function woStatusLabel(s: number) {
  switch (s) {
    case WorkOrderStatus.Open:
      return "Open";
    case WorkOrderStatus.InProgress:
      return "In progress";
    case WorkOrderStatus.Done:
      return "Done";
    case WorkOrderStatus.Cancelled:
      return "Cancelled";
    default:
      return `Status ${s}`;
  }
}

export function woStatusBadgeStyle(status: number): React.CSSProperties {
  // fara culori hard-coded (cerinta ta nu interzice, dar prefer minimal neutru)
  // folosim doar contrast, fara palette fixa.
  switch (status) {
    case WorkOrderStatus.Open:
      return { border: "1px solid #999" };
    case WorkOrderStatus.InProgress:
      return { border: "1px solid #666", fontWeight: 600 };
    case WorkOrderStatus.Done:
      return { border: "1px solid #444" };
    case WorkOrderStatus.Cancelled:
      return { border: "1px dashed #666" };
    default:
      return { border: "1px solid #999" };
  }
}
