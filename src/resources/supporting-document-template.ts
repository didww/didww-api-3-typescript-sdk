import { createReadOnlyResource } from './base.js';

export interface SupportingDocumentTemplate {
  id: string;
  type: 'supporting_document_templates';
  name: string;
  permanent: boolean;
  url: string;
}

export const SUPPORTING_DOCUMENT_TEMPLATE_RESOURCE = createReadOnlyResource<SupportingDocumentTemplate>(
  'supporting_document_templates',
);
