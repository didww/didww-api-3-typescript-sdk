export interface DidOrderItem {
  type: 'did_order_items';
  skuId: string;
  qty?: number;
  billingCyclesCount?: number;
  nanpaPrefixId?: string;
  availableDidId?: string;
  didReservationId?: string;
  nrc?: string;
  mrc?: string;
  proratedMrc?: string;
  billedFrom?: string;
  billedTo?: string;
  didGroupId?: string;
}

export interface CapacityOrderItem {
  type: 'capacity_order_items';
  capacityPoolId: string;
  qty: number;
  nrc?: string;
  mrc?: string;
}

export interface EmergencyOrderItem {
  type: 'emergency_order_items';
  qty: number;
  emergencyCallingServiceId: string;
  nrc?: string;
  mrc?: string;
  proratedMrc?: boolean;
  billedFrom?: string;
  billedTo?: string;
}

export interface GenericOrderItem {
  type: 'generic_order_items';
  qty?: number;
  nrc?: string;
  mrc?: string;
  proratedMrc?: string;
  billedFrom?: string;
  billedTo?: string;
}

export type OrderItem = DidOrderItem | CapacityOrderItem | EmergencyOrderItem | GenericOrderItem;

export function didOrderItem(attrs: Omit<DidOrderItem, 'type'>): DidOrderItem {
  return { type: 'did_order_items', ...attrs };
}

export function availableDidOrderItem(attrs: { skuId: string; availableDidId: string }): DidOrderItem {
  return { type: 'did_order_items', ...attrs };
}

export function reservationDidOrderItem(attrs: { skuId: string; didReservationId: string }): DidOrderItem {
  return { type: 'did_order_items', ...attrs };
}

export function capacityOrderItem(attrs: Omit<CapacityOrderItem, 'type'>): CapacityOrderItem {
  return { type: 'capacity_order_items', ...attrs };
}

export function emergencyOrderItem(attrs: Omit<EmergencyOrderItem, 'type'>): EmergencyOrderItem {
  return { type: 'emergency_order_items', ...attrs };
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
