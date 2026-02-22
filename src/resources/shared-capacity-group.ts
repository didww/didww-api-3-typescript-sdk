import type { ResourceMeta, ResourceRef } from './base.js';

export interface SharedCapacityGroup {
  id: string;
  type: 'shared_capacity_groups';
  name: string;
  shared_channels_count: number;
  metered_channels_count: number;
  created_at: string;
  capacity_pool?: ResourceRef;
  dids?: ResourceRef[];
}

export interface SharedCapacityGroupWrite {
  name?: string;
  shared_channels_count?: number;
  metered_channels_count?: number;
  capacity_pool?: ResourceRef;
}

export const SHARED_CAPACITY_GROUP_META: ResourceMeta<SharedCapacityGroup, SharedCapacityGroupWrite> = {
  type: 'shared_capacity_groups',
  path: 'shared_capacity_groups',
  writableKeys: ['name', 'shared_channels_count', 'metered_channels_count', 'capacity_pool'],
};
