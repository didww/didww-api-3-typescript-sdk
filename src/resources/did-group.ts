import type { ResourceMeta, ResourceRef } from './base.js';

export interface DidGroupFeature {
  name: string;
  value: boolean;
}

export interface DidGroup {
  id: string;
  type: 'did_groups';
  prefix: string;
  features: DidGroupFeature[];
  is_metered: boolean;
  area_name: string;
  allow_additional_channels: boolean;
  country?: ResourceRef;
  region?: ResourceRef;
  city?: ResourceRef;
  did_group_type?: ResourceRef;
  stock_keeping_units?: ResourceRef[];
  requirement?: ResourceRef;
}

export const DID_GROUP_META: ResourceMeta<DidGroup> = {
  type: 'did_groups',
  path: 'did_groups',
  writableKeys: [],
};
