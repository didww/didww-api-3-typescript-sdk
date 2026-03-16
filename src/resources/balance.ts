import type { ResourceConfig } from './base.js';

export interface Balance {
  id: string;
  type: 'balances';
  totalBalance: string;
  balance: string;
  credit: string;
}

export const BALANCE_RESOURCE = {
  type: 'balances',
  path: 'balance',
  writableKeys: [],
  operations: ['find'],
  singleton: true,
} as const satisfies ResourceConfig<Balance>;
