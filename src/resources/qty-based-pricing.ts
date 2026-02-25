import type { ResourceConfig } from './base.js';

export interface QtyBasedPricing {
  id: string;
  type: 'qty_based_pricings';
  qty: number;
  setupPrice: string;
  monthlyPrice: string;
}

export const QTY_BASED_PRICING_RESOURCE: ResourceConfig<QtyBasedPricing> = {
  type: 'qty_based_pricings',
  path: 'qty_based_pricings',
  writableKeys: [],
};
