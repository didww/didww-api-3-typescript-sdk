import type { ResourceMeta, ResourceRef } from './base.js';

export interface DidReservation {
  id: string;
  type: 'did_reservations';
  description: string;
  expire_at: string;
  created_at: string;
  available_did?: ResourceRef;
}

export interface DidReservationWrite {
  description?: string;
  available_did?: ResourceRef;
}

export const DID_RESERVATION_META: ResourceMeta<DidReservation, DidReservationWrite> = {
  type: 'did_reservations',
  path: 'did_reservations',
  writableKeys: ['description', 'available_did'],
};
