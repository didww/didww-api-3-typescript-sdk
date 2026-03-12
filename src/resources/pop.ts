import { createReadOnlyResource } from './base.js';

export interface Pop {
  id: string;
  type: 'pops';
  name: string;
}

export const POP_RESOURCE = createReadOnlyResource<Pop>('pops');
