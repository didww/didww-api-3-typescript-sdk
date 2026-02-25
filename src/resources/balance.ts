import type { ResourceMeta } from './base.js';

export interface Balance {
  id: string;
  type: 'balances';
  totalBalance: string;
  balance: string;
  credit: string;
}

export const BALANCE_META: ResourceMeta<Balance> = {
  type: 'balances',
  path: 'balance',
  writableKeys: [],
};
