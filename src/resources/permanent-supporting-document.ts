import { defineResource, type ResourceRef } from './base.js';
import type { Identity } from './identity.js';
import type { SupportingDocumentTemplate } from './supporting-document-template.js';
import type { EncryptedFile } from './encrypted-file.js';

export interface PermanentSupportingDocument {
  id: string;
  type: 'permanent_supporting_documents';
  createdAt: string;
  externalReferenceId: string | null;
  identity?: Identity | ResourceRef;
  template?: SupportingDocumentTemplate | ResourceRef;
  files?: (EncryptedFile | ResourceRef)[];
}

export interface PermanentSupportingDocumentWrite {
  externalReferenceId?: string | null;
  identity?: ResourceRef;
  template?: ResourceRef;
  files?: ResourceRef[];
}

export const PERMANENT_SUPPORTING_DOCUMENT_RESOURCE = defineResource<
  PermanentSupportingDocument,
  PermanentSupportingDocumentWrite
>()({
  type: 'permanent_supporting_documents',
  path: 'permanent_supporting_documents',
  writableKeys: ['externalReferenceId', 'identity', 'template', 'files'],
  relationshipKeys: ['identity', 'template', 'files'],
  operations: ['list', 'find', 'create', 'remove'],
});
