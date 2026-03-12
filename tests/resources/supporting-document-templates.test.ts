import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';

describe('SupportingDocumentTemplates', () => {
  it('lists supporting document templates', async () => {
    loadCassette('supporting_document_templates/list.yaml');
    const client = createTestClient();
    const result = await client.supportingDocumentTemplates().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('supporting_document_templates');
    expect(result.data[0].name).toBeDefined();
  });
});
