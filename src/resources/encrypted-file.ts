import type { ResourceConfig } from './base.js';

export interface EncryptedFile {
  id: string;
  type: 'encrypted_files';
  description: string;
  expireAt: string;
  createdAt: string;
}

export const ENCRYPTED_FILE_RESOURCE: ResourceConfig<EncryptedFile> = {
  type: 'encrypted_files',
  path: 'encrypted_files',
  writableKeys: [],
};
