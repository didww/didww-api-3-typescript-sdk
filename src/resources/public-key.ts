import { createReadOnlyResource } from './base.js';

export interface PublicKey {
  id: string;
  type: 'public_keys';
  key: string;
}

export const PUBLIC_KEY_RESOURCE = createReadOnlyResource<PublicKey>('public_keys');
