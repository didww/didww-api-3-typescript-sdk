import type { ResourceConfig, ResourceRef } from './base.js';
import type { Country } from './country.js';
import type { Region } from './region.js';
import type { Area } from './area.js';

export interface City {
  id: string;
  type: 'cities';
  name: string;
  country?: Country | ResourceRef;
  region?: Region | ResourceRef;
  area?: Area | ResourceRef;
}

export const CITY_RESOURCE: ResourceConfig<City> = {
  type: 'cities',
  path: 'cities',
  writableKeys: [],
};
