import { describe, it, expect } from 'vitest';
import { serializeForCreate, serializeForUpdate } from '../src/serializer.js';
import { DID_META } from '../src/resources/did.js';
import { ORDER_META } from '../src/resources/order.js';
import { EXPORT_META } from '../src/resources/export.js';
import { IDENTITY_META } from '../src/resources/identity.js';
import { ADDRESS_META } from '../src/resources/address.js';
import { ADDRESS_VERIFICATION_META } from '../src/resources/address-verification.js';
import { SHARED_CAPACITY_GROUP_META } from '../src/resources/shared-capacity-group.js';
import { VOICE_IN_TRUNK_META } from '../src/resources/voice-in-trunk.js';
import { VOICE_IN_TRUNK_GROUP_META } from '../src/resources/voice-in-trunk-group.js';
import { VOICE_OUT_TRUNK_META } from '../src/resources/voice-out-trunk.js';
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
      created_at: '2024-01-01', // read-only
    };
    const result = serializeForUpdate(DID_META, { ...data, id: '1' });
    const attrs = result.data.attributes;
    expect(attrs.description).toBe('test');
    expect(attrs.number).toBeUndefined();
    expect(attrs.blocked).toBeUndefined();
    expect(attrs.created_at).toBeUndefined();
  });

  it('Order excludes read-only fields', () => {
    const data = {
      allow_back_ordering: true,
      items: [],
      amount: '100.00', // read-only
      status: 'Completed', // read-only
      reference: 'REF', // read-only
    };
    const result = serializeForCreate(ORDER_META, data);
    const attrs = result.data.attributes;
    expect(attrs.allow_back_ordering).toBe(true);
    expect(attrs.amount).toBeUndefined();
    expect(attrs.status).toBeUndefined();
    expect(attrs.reference).toBeUndefined();
  });

  it('Export excludes read-only fields', () => {
    const data = {
      export_type: 'cdr_in',
      filters: {},
      status: 'Completed', // read-only
      url: 'http://...', // read-only
      created_at: '2024', // read-only
    };
    const result = serializeForCreate(EXPORT_META, data);
    const attrs = result.data.attributes;
    expect(attrs.export_type).toBe('cdr_in');
    expect(attrs.status).toBeUndefined();
    expect(attrs.url).toBeUndefined();
    expect(attrs.created_at).toBeUndefined();
  });

  it('Identity excludes read-only fields', () => {
    const data = {
      first_name: 'John',
      last_name: 'Doe',
      created_at: '2024-01-01', // read-only
      verified: true, // read-only
    };
    const result = serializeForCreate(IDENTITY_META, data);
    const attrs = result.data.attributes;
    expect(attrs.first_name).toBe('John');
    expect(attrs.last_name).toBe('Doe');
    expect(attrs.created_at).toBeUndefined();
    expect(attrs.verified).toBeUndefined();
  });

  it('Address excludes read-only fields', () => {
    const data = {
      city_name: 'London',
      postal_code: 'SW1A',
      created_at: '2024-01-01', // read-only
      verified: false, // read-only
    };
    const result = serializeForCreate(ADDRESS_META, data);
    const attrs = result.data.attributes;
    expect(attrs.city_name).toBe('London');
    expect(attrs.created_at).toBeUndefined();
    expect(attrs.verified).toBeUndefined();
  });

  it('AddressVerification excludes read-only fields', () => {
    const data = {
      service_description: 'test',
      status: 'Pending', // read-only
      reject_reasons: [], // read-only
      reference: 'REF', // read-only
    };
    const result = serializeForCreate(ADDRESS_VERIFICATION_META, data);
    const attrs = result.data.attributes;
    expect(attrs.service_description).toBe('test');
    expect(attrs.status).toBeUndefined();
    expect(attrs.reject_reasons).toBeUndefined();
    expect(attrs.reference).toBeUndefined();
  });

  it('SharedCapacityGroup excludes read-only fields', () => {
    const data = {
      name: 'test',
      shared_channels_count: 5,
      created_at: '2024-01-01', // read-only
    };
    const result = serializeForCreate(SHARED_CAPACITY_GROUP_META, data);
    const attrs = result.data.attributes;
    expect(attrs.name).toBe('test');
    expect(attrs.shared_channels_count).toBe(5);
    expect(attrs.created_at).toBeUndefined();
  });

  it('VoiceInTrunk excludes read-only fields', () => {
    const data = {
      name: 'test trunk',
      configuration: { type: 'pstn_configurations' as const, dst: '123' },
      created_at: '2024-01-01', // read-only
    };
    const result = serializeForCreate(VOICE_IN_TRUNK_META, data);
    const attrs = result.data.attributes;
    expect(attrs.name).toBe('test trunk');
    expect(attrs.created_at).toBeUndefined();
  });

  it('VoiceInTrunkGroup excludes read-only fields', () => {
    const data = {
      name: 'test group',
      capacity_limit: 'shared',
      created_at: '2024-01-01', // read-only
    };
    const result = serializeForCreate(VOICE_IN_TRUNK_GROUP_META, data);
    const attrs = result.data.attributes;
    expect(attrs.name).toBe('test group');
    expect(attrs.created_at).toBeUndefined();
  });

  it('VoiceOutTrunk excludes read-only fields', () => {
    const data = {
      name: 'test out trunk',
      allowed_sip_ips: ['127.0.0.1'],
      username: 'readonly', // read-only
      password: 'readonly', // read-only
      threshold_reached: true, // read-only
      created_at: '2024-01-01', // read-only
    };
    const result = serializeForCreate(VOICE_OUT_TRUNK_META, data);
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
    const item = didOrderItem({ sku_id: 'sku-1', qty: 2 });
    expect(item.type).toBe('did_order_items');
    expect(item.sku_id).toBe('sku-1');
    expect(item.qty).toBe(2);
  });

  it('availableDidOrderItem sets type and required fields', () => {
    const item = availableDidOrderItem({ sku_id: 'sku-1', available_did_id: 'ad-1' });
    expect(item.type).toBe('did_order_items');
    expect(item.sku_id).toBe('sku-1');
    expect(item.available_did_id).toBe('ad-1');
  });

  it('reservationDidOrderItem sets type and required fields', () => {
    const item = reservationDidOrderItem({ sku_id: 'sku-1', did_reservation_id: 'res-1' });
    expect(item.type).toBe('did_order_items');
    expect(item.sku_id).toBe('sku-1');
    expect(item.did_reservation_id).toBe('res-1');
  });

  it('capacityOrderItem sets type and passes attributes', () => {
    const item = capacityOrderItem({ capacity_pool_id: 'pool-1', qty: 5 });
    expect(item.type).toBe('capacity_order_items');
    expect(item.capacity_pool_id).toBe('pool-1');
    expect(item.qty).toBe(5);
  });
});
