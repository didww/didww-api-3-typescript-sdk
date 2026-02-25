import type { ResourceMeta, ResourceRef } from './base.js';

export interface SharedCapacityGroup {
  id: string;
  type: 'shared_capacity_groups';
  name: string;
  sharedChannelsCount: number;
  meteredChannelsCount: number;
  createdAt: string;
  capacityPool?: ResourceRef;
  dids?: ResourceRef[];
}

export interface SharedCapacityGroupWrite {
  name?: string;
  sharedChannelsCount?: number;
  meteredChannelsCount?: number;
  capacityPool?: ResourceRef;
}

export const SHARED_CAPACITY_GROUP_META: ResourceMeta<SharedCapacityGroup, SharedCapacityGroupWrite> = {
  type: 'shared_capacity_groups',
  path: 'shared_capacity_groups',
  writableKeys: ['name', 'sharedChannelsCount', 'meteredChannelsCount', 'capacityPool'],
};
