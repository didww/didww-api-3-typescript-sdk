import type { ResourceMeta, ResourceRef } from './base.js';
import type { Identity } from './identity.js';
import type { SupportingDocumentTemplate } from './supporting-document-template.js';
import type { EncryptedFile } from './encrypted-file.js';

export interface PermanentSupportingDocument {
  id: string;
  type: 'permanent_supporting_documents';
  createdAt: string;
  identity?: Identity | ResourceRef;
  template?: SupportingDocumentTemplate | ResourceRef;
  files?: (EncryptedFile | ResourceRef)[];
}

export interface PermanentSupportingDocumentWrite {
  identity?: ResourceRef;
  template?: ResourceRef;
  files?: ResourceRef[];
}

export const PERMANENT_SUPPORTING_DOCUMENT_META: ResourceMeta<
  PermanentSupportingDocument,
  PermanentSupportingDocumentWrite
> = {
  type: 'permanent_supporting_documents',
  path: 'permanent_supporting_documents',
  writableKeys: ['identity', 'template', 'files'],
};
