import { createReadOnlyResource, type ResourceRef } from './base.js';
import type { Region } from './region.js';

export interface Country {
  id: string;
  type: 'countries';
  name: string;
  prefix: string;
  iso: string;
  regions?: (Region | ResourceRef)[];
}

export const COUNTRY_RESOURCE = createReadOnlyResource<Country>('countries');
