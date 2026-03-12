import { createReadOnlyResource } from './base.js';

export interface DidGroupType {
  id: string;
  type: 'did_group_types';
  name: string;
}

export const DID_GROUP_TYPE_RESOURCE = createReadOnlyResource<DidGroupType>('did_group_types');
