import { createReadOnlyResource, type ResourceRef } from './base.js';
import type { Country } from './country.js';
import type { Region } from './region.js';

export interface NanpaPrefix {
  id: string;
  type: 'nanpa_prefixes';
  npa: string;
  nxx: string;
  country?: Country | ResourceRef;
  region?: Region | ResourceRef;
}

export const NANPA_PREFIX_RESOURCE = createReadOnlyResource<NanpaPrefix>('nanpa_prefixes');
