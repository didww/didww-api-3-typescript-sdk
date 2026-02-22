import type { ResourceMeta, ResourceRef } from './base.js';

export interface NanpaPrefix {
  id: string;
  type: 'nanpa_prefixes';
  npa: string;
  nxx: string;
  country?: ResourceRef;
  region?: ResourceRef;
}

export const NANPA_PREFIX_META: ResourceMeta<NanpaPrefix> = {
  type: 'nanpa_prefixes',
  path: 'nanpa_prefixes',
  writableKeys: [],
};
