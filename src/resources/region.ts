import type { ResourceConfig, ResourceRef } from './base.js';
import type { Country } from './country.js';

export interface Region {
  id: string;
  type: 'regions';
  name: string;
  iso: string;
  country?: Country | ResourceRef;
}

export const REGION_RESOURCE: ResourceConfig<Region> = {
  type: 'regions',
  path: 'regions',
  writableKeys: [],
};
