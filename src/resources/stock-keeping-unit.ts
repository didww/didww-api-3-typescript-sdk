import { createReadOnlyResource } from './base.js';

export interface StockKeepingUnit {
  id: string;
  type: 'stock_keeping_units';
  setupPrice: string;
  monthlyPrice: string;
  channelsIncludedCount: number;
}

export const STOCK_KEEPING_UNIT_RESOURCE = createReadOnlyResource<StockKeepingUnit>('stock_keeping_units');
