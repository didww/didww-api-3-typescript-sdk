import { createReadOnlyResource, type ResourceRef } from './base.js';
import type { Country } from './country.js';

export interface Area {
  id: string;
  type: 'areas';
  name: string;
  country?: Country | ResourceRef;
}

export const AREA_RESOURCE = createReadOnlyResource<Area>('areas');
