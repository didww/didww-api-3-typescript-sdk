import type { ResourceMeta, ResourceRef } from './base.js';

export interface Address {
  id: string;
  type: 'addresses';
  city_name: string;
  postal_code: string;
  address: string;
  description: string;
  created_at: string;
  verified: boolean;
  country?: ResourceRef;
  identity?: ResourceRef;
  proofs?: ResourceRef[];
  area?: ResourceRef;
  city?: ResourceRef;
}

export interface AddressWrite {
  city_name?: string;
  postal_code?: string;
  address?: string;
  description?: string;
  country?: ResourceRef;
  identity?: ResourceRef;
  area?: ResourceRef;
  city?: ResourceRef;
}

export const ADDRESS_META: ResourceMeta<Address, AddressWrite> = {
  type: 'addresses',
  path: 'addresses',
  writableKeys: ['city_name', 'postal_code', 'address', 'description', 'country', 'identity', 'area', 'city'],
};
