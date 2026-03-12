import { describe, it, expect } from 'vitest';
import { createTestClient } from '../helpers/client.js';
import { loadCassette } from '../helpers/vcr.js';
import { isIncluded } from '../../src/resources/base.js';
import type { DidGroup } from '../../src/resources/did-group.js';
import type { NanpaPrefix } from '../../src/resources/nanpa-prefix.js';

describe('AvailableDids', () => {

  it('lists available DIDs', async () => {
    loadCassette('available_dids/list.yaml');
    const client = createTestClient();
    const result = await client.availableDids().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('available_dids');
    expect(result.data[0].number).toBeDefined();
  });

  it('finds an available DID', async () => {
    loadCassette('available_dids/show.yaml');
    const client = createTestClient();
    const result = await client.availableDids().find('0b76223b-9625-412f-b0f3-330551473e7e');
    expect(result.data.id).toBe('0b76223b-9625-412f-b0f3-330551473e7e');
    expect(result.data.number).toBe('16169886810');
    const dg = result.data.didGroup;
    expect(dg).toBeDefined();
    expect(isIncluded(dg!)).toBe(true);
    expect((dg as DidGroup).areaName).toBe('Grand Rapids');
  });

  it('lists available DIDs with nanpa_prefix relationship', async () => {
    loadCassette('available_dids/list_2.yaml');
    const client = createTestClient();
    const result = await client.availableDids().list({ include: 'nanpa_prefix' });
    expect(result.data.length).toBe(1);
    expect(result.data[0].number).toBe('18649204444');
    const np = result.data[0].nanpaPrefix;
    expect(np).toBeDefined();
    expect(isIncluded(np!)).toBe(true);
    expect((np as NanpaPrefix).npa).toBe('864');
    expect((np as NanpaPrefix).nxx).toBe('920');
  });

  it('finds an available DID with nanpa_prefix', async () => {
    loadCassette('available_dids/show_with_nanpa_prefix.yaml');
    const client = createTestClient();
    const result = await client.availableDids().find('58304301-5216-4f6e-ab17-1a13b99bfb3a', {
      include: 'nanpa_prefix',
    });
    expect(result.data.number).toBe('15162172763');
    const np = result.data.nanpaPrefix;
    expect(np).toBeDefined();
    expect(isIncluded(np!)).toBe(true);
    expect((np as NanpaPrefix).npa).toBe('516');
    expect((np as NanpaPrefix).nxx).toBe('217');
  });
});
