import type { ResourceMeta, ResourceRef } from './base.js';

export interface AvailableDid {
  id: string;
  type: 'available_dids';
  number: string;
  didGroup?: ResourceRef;
  nanpaPrefix?: ResourceRef;
}

export const AVAILABLE_DID_META: ResourceMeta<AvailableDid> = {
  type: 'available_dids',
  path: 'available_dids',
  writableKeys: [],
};
