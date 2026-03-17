import { defineResource } from './base.js';

export interface Balance {
  id: string;
  type: 'balances';
  totalBalance: string;
  balance: string;
  credit: string;
}

export const BALANCE_RESOURCE = defineResource<Balance>()({
  type: 'balances',
  path: 'balance',
  writableKeys: [],
  operations: ['find'],
  singleton: true,
});
