import type { ResourceConfig } from './base.js';

export interface EncryptedFile {
  id: string;
  type: 'encrypted_files';
  description: string;
  expireAt: string;
}

export const ENCRYPTED_FILE_RESOURCE = {
  type: 'encrypted_files',
  path: 'encrypted_files',
  writableKeys: [],
  operations: ['list', 'find', 'remove'],
} as const satisfies ResourceConfig<EncryptedFile>;
