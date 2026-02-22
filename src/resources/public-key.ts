import type { ResourceMeta } from './base.js';

export interface PublicKey {
  id: string;
  type: 'public_keys';
  key: string;
}

export const PUBLIC_KEY_META: ResourceMeta<PublicKey> = {
  type: 'public_keys',
  path: 'public_keys',
  writableKeys: [],
};
