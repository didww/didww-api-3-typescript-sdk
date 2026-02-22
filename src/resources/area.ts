import type { ResourceMeta, ResourceRef } from './base.js';

export interface Area {
  id: string;
  type: 'areas';
  name: string;
  country?: ResourceRef;
}

export const AREA_META: ResourceMeta<Area> = {
  type: 'areas',
  path: 'areas',
  writableKeys: [],
};
