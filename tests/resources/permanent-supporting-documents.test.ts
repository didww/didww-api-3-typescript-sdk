import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { ref, isIncluded } from '../../src/resources/base.js';
import type { SupportingDocumentTemplate } from '../../src/resources/supporting-document-template.js';

describe('PermanentSupportingDocuments', () => {
  it('creates a permanent supporting document', async () => {
    const client = setupClient('permanent_supporting_documents/create.yaml');
    const result = await client.permanentSupportingDocuments().create({
      identity: ref('identities', '5e9df058-50d2-4e34-b0d4-d1746b86f41a'),
      template: ref('supporting_document_templates', '4199435f-646e-4e9d-a143-8f3b972b10c5'),
      files: [ref('encrypted_files', '254b3c2d-c40c-4ff7-93b1-a677aee7fa10')],
    });
    expect(result.data.id).toBe('19510da3-c07e-4fa9-a696-6b9ab89cc172');
    const tmpl = result.data.template;
    expect(tmpl).toBeDefined();
    expect(isIncluded(tmpl!)).toBe(true);
    expect((tmpl as SupportingDocumentTemplate).name).toBe('Germany Special Registration Form');
    expect((tmpl as SupportingDocumentTemplate).permanent).toBe(true);
  });

  it('deletes a permanent supporting document', async () => {
    const client = setupClient('permanent_supporting_documents/delete.yaml');
    await expect(
      client.permanentSupportingDocuments().remove('19510da3-c07e-4fa9-a696-6b9ab89cc172'),
    ).resolves.toBeUndefined();
  });
});
