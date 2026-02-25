import type { ResourceConfig } from './base.js';

export interface PublicKey {
  id: string;
  type: 'public_keys';
  key: string;
}

export const PUBLIC_KEY_RESOURCE: ResourceConfig<PublicKey> = {
  type: 'public_keys',
  path: 'public_keys',
  writableKeys: [],
};
