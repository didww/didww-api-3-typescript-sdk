import { describe, it, expect } from 'vitest';
import { serializeForCreate, serializeForUpdate } from '../src/serializer.js';
import { DID_RESOURCE } from '../src/resources/did.js';
import { ORDER_RESOURCE } from '../src/resources/order.js';
import { EXPORT_RESOURCE } from '../src/resources/export.js';
import { IDENTITY_RESOURCE } from '../src/resources/identity.js';
import { ADDRESS_RESOURCE } from '../src/resources/address.js';
import { ADDRESS_VERIFICATION_RESOURCE } from '../src/resources/address-verification.js';
import { SHARED_CAPACITY_GROUP_RESOURCE } from '../src/resources/shared-capacity-group.js';
import { VOICE_IN_TRUNK_RESOURCE } from '../src/resources/voice-in-trunk.js';
import { VOICE_IN_TRUNK_GROUP_RESOURCE } from '../src/resources/voice-in-trunk-group.js';
import { VOICE_OUT_TRUNK_RESOURCE } from '../src/resources/voice-out-trunk.js';
import {
  didOrderItem,
  availableDidOrderItem,
  reservationDidOrderItem,
  capacityOrderItem,
} from '../src/nested/order-item.js';

describe('Serialization - excludes read-only fields', () => {
  it('DID excludes read-only fields', () => {
    const data = {
      description: 'test',
      number: '12345', // read-only
      blocked: true, // read-only
      createdAt: '2024-01-01', // read-only
    };
    const result = serializeForUpdate(DID_RESOURCE, { ...data, id: '1' });
    const attrs = result.data.attributes;
    expect(attrs.description).toBe('test');
    expect(attrs.number).toBeUndefined();
    expect(attrs.blocked).toBeUndefined();
    expect(attrs.created_at).toBeUndefined();
  });

  it('Order excludes read-only fields', () => {
    const data = {
      allowBackOrdering: true,
      items: [],
      amount: '100.00', // read-only
      status: 'Completed', // read-only
      reference: 'REF', // read-only
    };
    const result = serializeForCreate(ORDER_RESOURCE, data);
    const attrs = result.data.attributes;
    expect(attrs.allow_back_ordering).toBe(true);
    expect(attrs.amount).toBeUndefined();
    expect(attrs.status).toBeUndefined();
    expect(attrs.reference).toBeUndefined();
  });

  it('Export excludes read-only fields', () => {
    const data = {
      exportType: 'cdr_in',
      filters: {},
      status: 'Completed', // read-only
      url: 'http://...', // read-only
      createdAt: '2024', // read-only
    };
    const result = serializeForCreate(EXPORT_RESOURCE, data);
    const attrs = result.data.attributes;
    expect(attrs.export_type).toBe('cdr_in');
    expect(attrs.status).toBeUndefined();
    expect(attrs.url).toBeUndefined();
    expect(attrs.created_at).toBeUndefined();
  });

  it('Identity excludes read-only fields', () => {
    const data = {
      firstName: 'John',
      lastName: 'Doe',
      createdAt: '2024-01-01', // read-only
      verified: true, // read-only
    };
    const result = serializeForCreate(IDENTITY_RESOURCE, data);
    const attrs = result.data.attributes;
    expect(attrs.first_name).toBe('John');
    expect(attrs.last_name).toBe('Doe');
    expect(attrs.created_at).toBeUndefined();
    expect(attrs.verified).toBeUndefined();
  });

  it('Address excludes read-only fields', () => {
    const data = {
      cityName: 'London',
      postalCode: 'SW1A',
      createdAt: '2024-01-01', // read-only
      verified: false, // read-only
    };
    const result = serializeForCreate(ADDRESS_RESOURCE, data);
    const attrs = result.data.attributes;
    expect(attrs.city_name).toBe('London');
    expect(attrs.created_at).toBeUndefined();
    expect(attrs.verified).toBeUndefined();
  });

  it('AddressVerification excludes read-only fields', () => {
    const data = {
      serviceDescription: 'test',
      status: 'Pending', // read-only
      rejectReasons: [], // read-only
      reference: 'REF', // read-only
    };
    const result = serializeForCreate(ADDRESS_VERIFICATION_RESOURCE, data);
    const attrs = result.data.attributes;
    expect(attrs.service_description).toBe('test');
    expect(attrs.status).toBeUndefined();
    expect(attrs.reject_reasons).toBeUndefined();
    expect(attrs.reference).toBeUndefined();
  });

  it('SharedCapacityGroup excludes read-only fields', () => {
    const data = {
      name: 'test',
      sharedChannelsCount: 5,
      createdAt: '2024-01-01', // read-only
    };
    const result = serializeForCreate(SHARED_CAPACITY_GROUP_RESOURCE, data);
    const attrs = result.data.attributes;
    expect(attrs.name).toBe('test');
    expect(attrs.shared_channels_count).toBe(5);
    expect(attrs.created_at).toBeUndefined();
  });

  it('VoiceInTrunk excludes read-only fields', () => {
    const data = {
      name: 'test trunk',
      configuration: { type: 'pstn_configurations' as const, dst: '123' },
      createdAt: '2024-01-01', // read-only
    };
    const result = serializeForCreate(VOICE_IN_TRUNK_RESOURCE, data);
    const attrs = result.data.attributes;
    expect(attrs.name).toBe('test trunk');
    expect(attrs.created_at).toBeUndefined();
  });

  it('VoiceInTrunkGroup excludes read-only fields', () => {
    const data = {
      name: 'test group',
      capacityLimit: 'shared',
      createdAt: '2024-01-01', // read-only
    };
    const result = serializeForCreate(VOICE_IN_TRUNK_GROUP_RESOURCE, data);
    const attrs = result.data.attributes;
    expect(attrs.name).toBe('test group');
    expect(attrs.created_at).toBeUndefined();
  });

  it('VoiceOutTrunk excludes read-only fields', () => {
    const data = {
      name: 'test out trunk',
      allowedSipIps: ['127.0.0.1'],
      username: 'readonly', // read-only
      password: 'readonly', // read-only
      thresholdReached: true, // read-only
      createdAt: '2024-01-01', // read-only
    };
    const result = serializeForCreate(VOICE_OUT_TRUNK_RESOURCE, data);
    const attrs = result.data.attributes;
    expect(attrs.name).toBe('test out trunk');
    expect(attrs.username).toBeUndefined();
    expect(attrs.password).toBeUndefined();
    expect(attrs.threshold_reached).toBeUndefined();
    expect(attrs.created_at).toBeUndefined();
  });
});

describe('Order item factories', () => {
  it('didOrderItem sets type and passes attributes', () => {
    const item = didOrderItem({ skuId: 'sku-1', qty: 2 });
    expect(item.type).toBe('did_order_items');
    expect(item.skuId).toBe('sku-1');
    expect(item.qty).toBe(2);
  });

  it('availableDidOrderItem sets type and required fields', () => {
    const item = availableDidOrderItem({ skuId: 'sku-1', availableDidId: 'ad-1' });
    expect(item.type).toBe('did_order_items');
    expect(item.skuId).toBe('sku-1');
    expect(item.availableDidId).toBe('ad-1');
  });

  it('reservationDidOrderItem sets type and required fields', () => {
    const item = reservationDidOrderItem({ skuId: 'sku-1', didReservationId: 'res-1' });
    expect(item.type).toBe('did_order_items');
    expect(item.skuId).toBe('sku-1');
    expect(item.didReservationId).toBe('res-1');
  });

  it('capacityOrderItem sets type and passes attributes', () => {
    const item = capacityOrderItem({ capacityPoolId: 'pool-1', qty: 5 });
    expect(item.type).toBe('capacity_order_items');
    expect(item.capacityPoolId).toBe('pool-1');
    expect(item.qty).toBe(5);
  });
});

describe('DID trunk/trunk group exclusive relationships', () => {
  it('assigning voiceInTrunk auto-nullifies voiceInTrunkGroup', () => {
    const result = serializeForUpdate(DID_RESOURCE, {
      id: 'did-1',
      voiceInTrunk: { id: 'trunk-1', type: 'voice_in_trunks' },
    });
    // trunk should be set as relationship
    expect(result.data.relationships?.voice_in_trunk).toEqual({
      data: { id: 'trunk-1', type: 'voice_in_trunks' },
    });
    // trunk group should be auto-nullified
    expect(result.data.relationships?.voice_in_trunk_group).toEqual({
      data: null,
    });
  });

  it('assigning voiceInTrunkGroup auto-nullifies voiceInTrunk', () => {
    const result = serializeForUpdate(DID_RESOURCE, {
      id: 'did-1',
      voiceInTrunkGroup: { id: 'group-1', type: 'voice_in_trunk_groups' },
    });
    // trunk group should be set as relationship
    expect(result.data.relationships?.voice_in_trunk_group).toEqual({
      data: { id: 'group-1', type: 'voice_in_trunk_groups' },
    });
    // trunk should be auto-nullified
    expect(result.data.relationships?.voice_in_trunk).toEqual({
      data: null,
    });
  });

  it('setting voiceInTrunk to null does not auto-nullify voiceInTrunkGroup', () => {
    const result = serializeForUpdate(DID_RESOURCE, {
      id: 'did-1',
      voiceInTrunk: null,
    });
    // trunk should be nullified
    expect(result.data.relationships?.voice_in_trunk).toEqual({
      data: null,
    });
    // trunk group should NOT be touched
    expect(result.data.relationships?.voice_in_trunk_group).toBeUndefined();
  });

  it('setting voiceInTrunkGroup to null does not auto-nullify voiceInTrunk', () => {
    const result = serializeForUpdate(DID_RESOURCE, {
      id: 'did-1',
      voiceInTrunkGroup: null,
    });
    // trunk group should be nullified
    expect(result.data.relationships?.voice_in_trunk_group).toEqual({
      data: null,
    });
    // trunk should NOT be touched
    expect(result.data.relationships?.voice_in_trunk).toBeUndefined();
  });

  it('updating only description does not affect trunk relationships', () => {
    const result = serializeForUpdate(DID_RESOURCE, {
      id: 'did-1',
      description: 'updated',
    });
    expect(result.data.attributes.description).toBe('updated');
    expect(result.data.relationships?.voice_in_trunk).toBeUndefined();
    expect(result.data.relationships?.voice_in_trunk_group).toBeUndefined();
  });
});
