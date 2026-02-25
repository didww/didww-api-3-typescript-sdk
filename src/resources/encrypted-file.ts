import type { ResourceMeta } from './base.js';

export interface EncryptedFile {
  id: string;
  type: 'encrypted_files';
  description: string;
  expireAt: string;
  createdAt: string;
}

export const ENCRYPTED_FILE_META: ResourceMeta<EncryptedFile> = {
  type: 'encrypted_files',
  path: 'encrypted_files',
  writableKeys: [],
};
