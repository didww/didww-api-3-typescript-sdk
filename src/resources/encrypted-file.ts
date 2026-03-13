import { createReadOnlyResource } from './base.js';

export interface EncryptedFile {
  id: string;
  type: 'encrypted_files';
  description: string;
  expireAt: string;
}

export const ENCRYPTED_FILE_RESOURCE = createReadOnlyResource<EncryptedFile>('encrypted_files');
