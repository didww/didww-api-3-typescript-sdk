import type { ResourceConfig } from './base.js';

export interface Balance {
  id: string;
  type: 'balances';
  totalBalance: string;
  balance: string;
  credit: string;
}

export const BALANCE_RESOURCE: ResourceConfig<Balance> = {
  type: 'balances',
  path: 'balance',
  writableKeys: [],
};
