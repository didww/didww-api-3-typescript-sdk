import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';
import { ref, isIncluded } from '../../src/resources/base.js';
import type { AvailableDid } from '../../src/resources/available-did.js';

describe('DidReservations', () => {
  it('lists DID reservations', async () => {
    loadCassette('did_reservations/list.yaml');
    const client = createTestClient();
    const result = await client.didReservations().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('did_reservations');
    expect(result.data[0].description).toBe('DIDWW');
  });

  it('finds a DID reservation', async () => {
    loadCassette('did_reservations/show.yaml');
    const client = createTestClient();
    const result = await client.didReservations().find('fd38d3ff-80cf-4e67-a605-609a2884a5c4');
    expect(result.data.id).toBe('fd38d3ff-80cf-4e67-a605-609a2884a5c4');
    expect(result.data.type).toBe('did_reservations');
    const ad = result.data.availableDid;
    expect(ad).toBeDefined();
    expect(isIncluded(ad!)).toBe(true);
    expect((ad as AvailableDid).number).toBe('19492033398');
  });

  it('creates a DID reservation', async () => {
    loadCassette('did_reservations/create.yaml');
    const client = createTestClient();
    const result = await client.didReservations().create({
      description: 'test reservation',
      availableDid: ref('available_dids', '0b76223b-9625-412f-b0f3-330551473e7e'),
    });
    expect(result.data.id).toBeDefined();
    expect(result.data.type).toBe('did_reservations');
  });

  it('deletes a DID reservation', async () => {
    loadCassette('did_reservations/delete.yaml');
    const client = createTestClient();
    await expect(client.didReservations().remove('8a18a19f-b082-42f3-acca-99ea402a4e5d')).resolves.toBeUndefined();
  });
});
