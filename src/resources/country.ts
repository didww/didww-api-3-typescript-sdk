import type { ResourceMeta } from './base.js';

export interface Country {
  id: string;
  type: 'countries';
  name: string;
  prefix: string;
  iso: string;
}

export const COUNTRY_META: ResourceMeta<Country> = {
  type: 'countries',
  path: 'countries',
  writableKeys: [],
};
