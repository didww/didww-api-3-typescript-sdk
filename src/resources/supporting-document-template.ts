import type { ResourceMeta } from './base.js';

export interface SupportingDocumentTemplate {
  id: string;
  type: 'supporting_document_templates';
  name: string;
  permanent: boolean;
  url: string;
}

export const SUPPORTING_DOCUMENT_TEMPLATE_META: ResourceMeta<SupportingDocumentTemplate> = {
  type: 'supporting_document_templates',
  path: 'supporting_document_templates',
  writableKeys: [],
};
