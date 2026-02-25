import type { ResourceConfig } from './base.js';

export interface Pop {
  id: string;
  type: 'pops';
  name: string;
}

export const POP_RESOURCE: ResourceConfig<Pop> = {
  type: 'pops',
  path: 'pops',
  writableKeys: [],
};
