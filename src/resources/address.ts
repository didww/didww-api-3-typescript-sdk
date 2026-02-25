import type { ResourceMeta, ResourceRef } from './base.js';
import type { Country } from './country.js';
import type { Identity } from './identity.js';
import type { Proof } from './proof.js';
import type { Area } from './area.js';
import type { City } from './city.js';

export interface Address {
  id: string;
  type: 'addresses';
  cityName: string;
  postalCode: string;
  address: string;
  description: string;
  createdAt: string;
  verified: boolean;
  country?: Country | ResourceRef;
  identity?: Identity | ResourceRef;
  proofs?: (Proof | ResourceRef)[];
  area?: Area | ResourceRef;
  city?: City | ResourceRef;
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
