import type { ResourceMeta } from './base.js';
import type { OrderItem } from '../nested/order-item.js';
import { serializeOrderItems, deserializeOrderItems } from '../nested/order-item.js';

export interface Order {
  id: string;
  type: 'orders';
  amount: string;
  status: string;
  description: string;
  reference: string;
  created_at: string;
  allow_back_ordering: boolean;
  callback_url: string | null;
  callback_method: string | null;
  items: OrderItem[];
}

export interface OrderWrite {
  allow_back_ordering?: boolean;
  items?: OrderItem[];
  callback_url?: string | null;
  callback_method?: string | null;
}

export const ORDER_META: ResourceMeta<Order, OrderWrite> = {
  type: 'orders',
  path: 'orders',
  writableKeys: ['allow_back_ordering', 'items', 'callback_url', 'callback_method'],
  serializeCustom(data, _method) {
    const result: Record<string, unknown> = {};
    for (const key of ORDER_META.writableKeys) {
      if (key in (data as any)) {
        result[key as string] = (data as any)[key];
      }
    }
    if (result.items && Array.isArray(result.items)) {
      result.items = serializeOrderItems(result.items as OrderItem[]);
    }
    return result;
  },
  deserializeCustom(data) {
    const items = (data as any).items;
    if (Array.isArray(items)) {
      return { items: deserializeOrderItems(items) } as any;
    }
    return {};
  },
};
