import type { ResourceMeta, ResourceRef } from './base.js';

export interface Region {
  id: string;
  type: 'regions';
  name: string;
  iso: string;
  country?: ResourceRef;
}

export const REGION_META: ResourceMeta<Region> = {
  type: 'regions',
  path: 'regions',
  writableKeys: [],
};
