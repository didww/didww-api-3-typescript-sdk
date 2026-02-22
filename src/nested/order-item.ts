export interface DidOrderItem {
  type: 'did_order_items';
  sku_id: string;
  qty?: number;
  billing_cycles_count?: number;
  nanpa_prefix_id?: string;
  available_did_id?: string;
  did_reservation_id?: string;
  nrc?: string;
  mrc?: string;
  prorated_mrc?: string;
  billed_from?: string;
  billed_to?: string;
  did_group_id?: string;
}

export interface CapacityOrderItem {
  type: 'capacity_order_items';
  capacity_pool_id: string;
  qty: number;
  nrc?: string;
  mrc?: string;
}

export interface GenericOrderItem {
  type: 'generic_order_items';
  qty?: number;
  nrc?: string;
  mrc?: string;
  prorated_mrc?: string;
  billed_from?: string;
  billed_to?: string;
}

export type OrderItem = DidOrderItem | CapacityOrderItem | GenericOrderItem;

export function didOrderItem(attrs: Omit<DidOrderItem, 'type'>): DidOrderItem {
  return { type: 'did_order_items', ...attrs };
}

export function capacityOrderItem(attrs: Omit<CapacityOrderItem, 'type'>): CapacityOrderItem {
  return { type: 'capacity_order_items', ...attrs };
}

export function serializeOrderItems(items: OrderItem[]): Record<string, unknown>[] {
  return items.map((item) => {
    const { type, ...attributes } = item;
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined && value !== null) {
        filtered[key] = value;
      }
    }
    return { type, attributes: filtered };
  });
}

export function deserializeOrderItems(data: unknown[]): OrderItem[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    if (!item || typeof item !== 'object') return item as OrderItem;
    const obj = item as Record<string, unknown>;
    const type = obj.type as string;
    const attributes = (obj.attributes as Record<string, unknown>) || {};
    return { type, ...attributes } as OrderItem;
  });
}
