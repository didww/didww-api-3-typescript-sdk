import type { ResourceMeta, ResourceRef } from './base.js';
import type { Feature } from '../enums.js';

export interface DidGroup {
  id: string;
  type: 'did_groups';
  prefix: string;
  features: Feature[];
  isMetered: boolean;
  areaName: string;
  allowAdditionalChannels: boolean;
  country?: ResourceRef;
  region?: ResourceRef;
  city?: ResourceRef;
  didGroupType?: ResourceRef;
  stockKeepingUnits?: ResourceRef[];
  requirement?: ResourceRef;
}

export const DID_GROUP_META: ResourceMeta<DidGroup> = {
  type: 'did_groups',
  path: 'did_groups',
  writableKeys: [],
};
