import { createReadOnlyResource, type ResourceRef } from './base.js';
import type { DidGroup } from './did-group.js';
import type { NanpaPrefix } from './nanpa-prefix.js';

export interface AvailableDid {
  id: string;
  type: 'available_dids';
  number: string;
  didGroup?: DidGroup | ResourceRef;
  nanpaPrefix?: NanpaPrefix | ResourceRef;
}

export const AVAILABLE_DID_RESOURCE = createReadOnlyResource<AvailableDid>('available_dids');
