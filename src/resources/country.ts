import type { ResourceConfig } from './base.js';

export interface Country {
  id: string;
  type: 'countries';
  name: string;
  prefix: string;
  iso: string;
}

export const COUNTRY_RESOURCE: ResourceConfig<Country> = {
  type: 'countries',
  path: 'countries',
  writableKeys: [],
};
