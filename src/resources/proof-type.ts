import { createReadOnlyResource } from './base.js';

export interface ProofType {
  id: string;
  type: 'proof_types';
  name: string;
  entityType: string;
}

export const PROOF_TYPE_RESOURCE = createReadOnlyResource<ProofType>('proof_types');
