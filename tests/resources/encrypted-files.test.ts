import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { DidwwClientError } from '../../src/errors.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('EncryptedFiles', () => {
  describeOperationEnforcement({
    clientMethod: 'encryptedFiles',
    allowedOperations: ['list', 'find', 'remove'],
    resourceType: 'encrypted_files',
  });
  it('lists encrypted files', async () => {
    const client = setupClient('encrypted_files/list.yaml');
    const result = await client.encryptedFiles().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('encrypted_files');
  });

  it('finds an encrypted file', async () => {
    const client = setupClient('encrypted_files/show.yaml');
    const result = await client.encryptedFiles().find('6eed102c-66a9-4a9b-a95f-4312d70ec12a');
    expect(result.data.id).toBe('6eed102c-66a9-4a9b-a95f-4312d70ec12a');
    expect(result.data.type).toBe('encrypted_files');
    expect(result.data.description).toBe('some description');
  });

  it('uploads a single encrypted file', async () => {
    const client = setupClient('encrypted_files/upload.yaml');
    const id = await client.uploadEncryptedFile(
      'c74684d7863639169c21c4d04747f8d6fa05cfe3:::8a586bd37fa0000501715321b2e6a7b3ca57894c',
      { data: Buffer.from('file-content-1'), description: 'some description', filename: 'file1.enc' },
    );
    expect(id).toBe('6eed102c-66a9-4a9b-a95f-4312d70ec12a');
  });

  it('deletes an encrypted file', async () => {
    const client = setupClient('encrypted_files/delete.yaml');
    await expect(client.encryptedFiles().remove('7f2fbdca-8008-44ce-bcb6-3537ea5efaac')).resolves.toBeUndefined();
  });

  it('throws on unexpected upload response', async () => {
    const client = setupClient('encrypted_files/upload_error.yaml');
    try {
      await client.uploadEncryptedFile('fingerprint-123', { data: Buffer.from('example') });
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DidwwClientError);
      expect((err as Error).message).toBe('Unexpected encrypted_files upload response');
    }
  });
});
