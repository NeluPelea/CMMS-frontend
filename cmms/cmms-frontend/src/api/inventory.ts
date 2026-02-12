// src/api/inventory.ts
import { apiFetch } from "./http";

export type InventoryRowDto = {
  id: string;
  partId: string;
  partName: string;
  partCode?: string | null;
  skuCode?: string | null;
  uom?: string | null;
  qtyOnHand: number;
  minQty?: number;
  purchasePrice?: number | null;
  purchaseCurrency?: string | null;
  unitPriceRon: number;
  valueRon: number;
};

export async function getInventory(p?: { q?: string; take?: number }): Promise<InventoryRowDto[]> {
  const qs = new URLSearchParams();
  if (p?.q) qs.set("q", p.q);
  if (p?.take != null) qs.set("take", String(p.take));
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<InventoryRowDto[]>(`/api/inventory${tail}`, { method: "GET" });
}

export async function adjustInventory(id: string, delta: number): Promise<null> {
  return apiFetch<null>(`/api/inventory/${id}/adjust`, {
    method: "POST",
    body: JSON.stringify({ delta }),
  });
}
