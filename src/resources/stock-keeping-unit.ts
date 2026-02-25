import type { ResourceMeta } from './base.js';

export interface StockKeepingUnit {
  id: string;
  type: 'stock_keeping_units';
  setupPrice: string;
  monthlyPrice: string;
  channelsIncludedCount: number;
}

export const STOCK_KEEPING_UNIT_META: ResourceMeta<StockKeepingUnit> = {
  type: 'stock_keeping_units',
  path: 'stock_keeping_units',
  writableKeys: [],
};
