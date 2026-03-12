import { createReadOnlyResource } from './base.js';

export interface Balance {
  id: string;
  type: 'balances';
  totalBalance: string;
  balance: string;
  credit: string;
}

export const BALANCE_RESOURCE = createReadOnlyResource<Balance>('balances', 'balance');
