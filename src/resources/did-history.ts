import { createReadOnlyResource } from './base.js';

export interface DidHistory {
  id: string;
  type: 'did_history';
  didNumber: string;
  action: string;
  method: string;
  createdAt: string;
}

export const DID_HISTORY_RESOURCE = createReadOnlyResource<DidHistory>('did_history', 'did_history');
