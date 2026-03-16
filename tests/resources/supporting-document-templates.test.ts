import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('SupportingDocumentTemplates', () => {
  describeOperationEnforcement({
    clientMethod: 'supportingDocumentTemplates',
    allowedOperations: ['list', 'find'],
    resourceType: 'supporting_document_templates',
  });
  it('lists supporting document templates', async () => {
    const client = setupClient('supporting_document_templates/list.yaml');
    const result = await client.supportingDocumentTemplates().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('supporting_document_templates');
    expect(result.data[0].name).toBeDefined();
  });
});
