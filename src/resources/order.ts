import type { ResourceMeta } from './base.js';
import type { OrderItem } from '../nested/order-item.js';
import type { OrderStatus, CallbackMethod } from '../enums.js';
import { serializeOrderItems, deserializeOrderItems } from '../nested/order-item.js';

export interface Order {
  id: string;
  type: 'orders';
  amount: string;
  status: OrderStatus;
  description: string;
  reference: string;
  created_at: string;
  allow_back_ordering: boolean;
  callback_url: string | null;
  callback_method: CallbackMethod | null;
  items: OrderItem[];
}

export interface OrderWrite {
  allow_back_ordering?: boolean;
  items?: OrderItem[];
  callback_url?: string | null;
  callback_method?: CallbackMethod | null;
}

export const ORDER_META: ResourceMeta<Order, OrderWrite> = {
  type: 'orders',
  path: 'orders',
  writableKeys: ['allow_back_ordering', 'items', 'callback_url', 'callback_method'],
  serializeCustom(data, _method) {
    const result: Record<string, unknown> = {};
    for (const key of ORDER_META.writableKeys) {
      if (key in (data as Record<string, unknown>)) {
        result[key as string] = (data as Record<string, unknown>)[key];
      }
    }
    if (result.items && Array.isArray(result.items)) {
      result.items = serializeOrderItems(result.items as OrderItem[]);
    }
    return result;
  },
  deserializeCustom(data) {
    const items = (data as Record<string, unknown>).items;
    if (Array.isArray(items)) {
      return { items: deserializeOrderItems(items) } as Partial<Order>;
    }
    return {};
  },
};
