import type { ResourceMeta, ResourceRef } from './base.js';
import type { Country } from './country.js';

export interface Area {
  id: string;
  type: 'areas';
  name: string;
  country?: Country | ResourceRef;
}

export const AREA_META: ResourceMeta<Area> = {
  type: 'areas',
  path: 'areas',
  writableKeys: [],
};
