import type { ResourceMeta, ResourceRef } from './base.js';

export interface CapacityPool {
  id: string;
  type: 'capacity_pools';
  name: string;
  renew_date: string;
  total_channels_count: number;
  assigned_channels_count: number;
  minimum_limit: number;
  minimum_qty_per_order: number;
  setup_price: string;
  monthly_price: string;
  metered_rate: string;
  countries?: ResourceRef[];
  shared_capacity_groups?: ResourceRef[];
  qty_based_pricings?: ResourceRef[];
}

export interface CapacityPoolWrite {
  total_channels_count?: number;
}

export const CAPACITY_POOL_META: ResourceMeta<CapacityPool, CapacityPoolWrite> = {
  type: 'capacity_pools',
  path: 'capacity_pools',
  writableKeys: ['total_channels_count'],
};
