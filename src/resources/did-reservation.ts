import type { ResourceConfig, ResourceRef } from './base.js';
import type { AvailableDid } from './available-did.js';

export interface DidReservation {
  id: string;
  type: 'did_reservations';
  description: string;
  expireAt: string;
  createdAt: string;
  availableDid?: AvailableDid | ResourceRef;
}

export interface DidReservationWrite {
  description?: string;
  availableDid?: ResourceRef;
}

export const DID_RESERVATION_RESOURCE: ResourceConfig<DidReservation, DidReservationWrite> = {
  type: 'did_reservations',
  path: 'did_reservations',
  writableKeys: ['description', 'availableDid'],
  relationshipKeys: ['availableDid'],
};
