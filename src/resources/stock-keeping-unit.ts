import type { ResourceMeta } from './base.js';

export interface StockKeepingUnit {
  id: string;
  type: 'stock_keeping_units';
  setup_price: string;
  monthly_price: string;
  channels_included_count: number;
}

export const STOCK_KEEPING_UNIT_META: ResourceMeta<StockKeepingUnit> = {
  type: 'stock_keeping_units',
  path: 'stock_keeping_units',
  writableKeys: [],
};
