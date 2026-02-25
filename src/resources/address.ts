import type { ResourceMeta, ResourceRef } from './base.js';

export interface Address {
  id: string;
  type: 'addresses';
  cityName: string;
  postalCode: string;
  address: string;
  description: string;
  createdAt: string;
  verified: boolean;
  country?: ResourceRef;
  identity?: ResourceRef;
  proofs?: ResourceRef[];
  area?: ResourceRef;
  city?: ResourceRef;
}

export interface AddressWrite {
  cityName?: string;
  postalCode?: string;
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
  writableKeys: ['cityName', 'postalCode', 'address', 'description', 'country', 'identity', 'area', 'city'],
};
