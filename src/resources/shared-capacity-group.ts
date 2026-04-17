import { defineResource, type ResourceRef } from './base.js';
import type { CapacityPool } from './capacity-pool.js';
import type { Did } from './did.js';

export interface SharedCapacityGroup {
  id: string;
  type: 'shared_capacity_groups';
  name: string;
  sharedChannelsCount: number;
  meteredChannelsCount: number;
  createdAt: string;
  externalReferenceId: string | null;
  capacityPool?: CapacityPool | ResourceRef;
  dids?: (Did | ResourceRef)[];
}

export interface SharedCapacityGroupWrite {
  name?: string;
  sharedChannelsCount?: number;
  meteredChannelsCount?: number;
  externalReferenceId?: string | null;
  capacityPool?: ResourceRef;
}

export const SHARED_CAPACITY_GROUP_RESOURCE = defineResource<SharedCapacityGroup, SharedCapacityGroupWrite>()({
  type: 'shared_capacity_groups',
  path: 'shared_capacity_groups',
  writableKeys: ['name', 'sharedChannelsCount', 'meteredChannelsCount', 'externalReferenceId', 'capacityPool'],
  relationshipKeys: ['capacityPool'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
});
