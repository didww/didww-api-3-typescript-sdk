import { defineResource, type ResourceRef } from './base.js';
import type { Country } from './country.js';
import type { SharedCapacityGroup } from './shared-capacity-group.js';
import type { QtyBasedPricing } from './qty-based-pricing.js';

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
  countries?: (Country | ResourceRef)[];
  sharedCapacityGroups?: (SharedCapacityGroup | ResourceRef)[];
  qtyBasedPricings?: (QtyBasedPricing | ResourceRef)[];
}

export interface CapacityPoolWrite {
  totalChannelsCount?: number;
}

export const CAPACITY_POOL_RESOURCE = defineResource<CapacityPool, CapacityPoolWrite>()({
  type: 'capacity_pools',
  path: 'capacity_pools',
  writableKeys: ['totalChannelsCount'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
});
