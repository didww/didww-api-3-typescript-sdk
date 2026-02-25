import type { ResourceMeta, ResourceRef } from './base.js';

export interface Proof {
  id: string;
  type: 'proofs';
  createdAt: string;
  expiresAt: string | null;
  proofType?: ResourceRef;
  entity?: ResourceRef;
  files?: ResourceRef[];
}

export interface ProofWrite {
  proofType?: ResourceRef;
  entity?: ResourceRef;
  files?: ResourceRef[];
}

export const PROOF_META: ResourceMeta<Proof, ProofWrite> = {
  type: 'proofs',
  path: 'proofs',
  writableKeys: ['proofType', 'entity', 'files'],
};
