import type { ResourceMeta } from './base.js';

export interface Pop {
  id: string;
  type: 'pops';
  name: string;
}

export const POP_META: ResourceMeta<Pop> = {
  type: 'pops',
  path: 'pops',
  writableKeys: [],
};
