import type { ResourceMeta } from './base.js';

export interface ProofType {
  id: string;
  type: 'proof_types';
  name: string;
  entityType: string;
}

export const PROOF_TYPE_META: ResourceMeta<ProofType> = {
  type: 'proof_types',
  path: 'proof_types',
  writableKeys: [],
};
