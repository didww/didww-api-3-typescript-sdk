import type { ResourceMeta } from './base.js';

export interface QtyBasedPricing {
  id: string;
  type: 'qty_based_pricings';
  qty: number;
  setup_price: string;
  monthly_price: string;
}

export const QTY_BASED_PRICING_META: ResourceMeta<QtyBasedPricing> = {
  type: 'qty_based_pricings',
  path: 'qty_based_pricings',
  writableKeys: [],
};
