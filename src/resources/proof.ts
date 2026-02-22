import type { ResourceMeta, ResourceRef } from './base.js';

export interface Proof {
  id: string;
  type: 'proofs';
  created_at: string;
  expires_at: string | null;
  proof_type?: ResourceRef;
  entity?: ResourceRef;
  files?: ResourceRef[];
}

export interface ProofWrite {
  proof_type?: ResourceRef;
  entity?: ResourceRef;
  files?: ResourceRef[];
}

export const PROOF_META: ResourceMeta<Proof, ProofWrite> = {
  type: 'proofs',
  path: 'proofs',
  writableKeys: ['proof_type', 'entity', 'files'],
};
