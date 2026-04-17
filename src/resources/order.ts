import { defineResource } from './base.js';
import { filterWritableKeys } from '../filter-writable-keys.js';
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
  createdAt: string;
  allowBackOrdering: boolean;
  callbackUrl: string | null;
  callbackMethod: CallbackMethod | null;
  externalReferenceId: string | null;
  items: OrderItem[];
}

export interface OrderWrite {
  allowBackOrdering?: boolean;
  items?: OrderItem[];
  callbackUrl?: string | null;
  callbackMethod?: CallbackMethod | null;
  externalReferenceId?: string | null;
}

const WRITABLE_KEYS = [
  'allowBackOrdering',
  'items',
  'callbackUrl',
  'callbackMethod',
  'externalReferenceId',
] as const satisfies readonly (keyof OrderWrite)[];

export const ORDER_RESOURCE = defineResource<Order, OrderWrite>()({
  type: 'orders',
  path: 'orders',
  writableKeys: WRITABLE_KEYS,
  operations: ['list', 'find', 'create', 'update', 'remove'],
  serializeCustom(data) {
    const result = filterWritableKeys(data, WRITABLE_KEYS);
    if (result.items && Array.isArray(result.items)) {
      result.items = serializeOrderItems(result.items as OrderItem[]);
    }
    return result;
  },
  deserializeCustom(data: Record<string, unknown>) {
    const items = data.items;
    if (Array.isArray(items)) {
      return { items: deserializeOrderItems(items) } as Partial<Order>;
    }
    return {};
  },
});
