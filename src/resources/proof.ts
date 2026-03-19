import { defineResource, type ResourceRef } from './base.js';
import type { ProofType } from './proof-type.js';
import type { EncryptedFile } from './encrypted-file.js';

export interface Proof {
  id: string;
  type: 'proofs';
  createdAt: string;
  expiresAt: string | null;
  proofType?: ProofType | ResourceRef;
  entity?: ResourceRef;
  files?: (EncryptedFile | ResourceRef)[];
}

export interface ProofWrite {
  proofType?: ResourceRef;
  entity?: ResourceRef;
  files?: ResourceRef[];
}

export const PROOF_RESOURCE = defineResource<Proof, ProofWrite>()({
  type: 'proofs',
  path: 'proofs',
  writableKeys: ['proofType', 'entity', 'files'],
  relationshipKeys: ['proofType', 'entity', 'files'],
  operations: ['list', 'find', 'create', 'remove'],
});
