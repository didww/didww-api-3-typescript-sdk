import type { ResourceMeta, ResourceRef } from './base.js';

export interface CapacityPool {
  id: string;
  type: 'capacity_pools';
  name: string;
  renewDate: string;
  totalChannelsCount: number;
  assignedChannelsCount: number;
  minimumLimit: number;
  minimumQtyPerOrder: number;
  setupPrice: string;
  monthlyPrice: string;
  meteredRate: string;
  countries?: ResourceRef[];
  sharedCapacityGroups?: ResourceRef[];
  qtyBasedPricings?: ResourceRef[];
}

export interface CapacityPoolWrite {
  totalChannelsCount?: number;
}

export const CAPACITY_POOL_META: ResourceMeta<CapacityPool, CapacityPoolWrite> = {
  type: 'capacity_pools',
  path: 'capacity_pools',
  writableKeys: ['totalChannelsCount'],
};
