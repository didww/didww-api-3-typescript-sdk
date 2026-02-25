import type { ResourceConfig } from './base.js';

export interface ProofType {
  id: string;
  type: 'proof_types';
  name: string;
  entityType: string;
}

export const PROOF_TYPE_RESOURCE: ResourceConfig<ProofType> = {
  type: 'proof_types',
  path: 'proof_types',
  writableKeys: [],
};
