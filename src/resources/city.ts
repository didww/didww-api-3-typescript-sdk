import type { ResourceMeta, ResourceRef } from './base.js';

export interface City {
  id: string;
  type: 'cities';
  name: string;
  country?: ResourceRef;
  region?: ResourceRef;
  area?: ResourceRef;
}

export const CITY_META: ResourceMeta<City> = {
  type: 'cities',
  path: 'cities',
  writableKeys: [],
};
