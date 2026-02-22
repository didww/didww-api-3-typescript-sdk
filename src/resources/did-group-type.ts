import type { ResourceMeta } from './base.js';

export interface DidGroupType {
  id: string;
  type: 'did_group_types';
  name: string;
}

export const DID_GROUP_TYPE_META: ResourceMeta<DidGroupType> = {
  type: 'did_group_types',
  path: 'did_group_types',
  writableKeys: [],
};
