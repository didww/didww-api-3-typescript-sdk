import { describe, it, expect } from 'vitest';
import { setupClient } from '../helpers/client.js';
import { describeOperationEnforcement } from '../helpers/operation-enforcement.js';

describe('DidHistory', () => {
  describeOperationEnforcement({
    clientMethod: 'didHistory',
    allowedOperations: ['list', 'find'],
    resourceType: 'did_history',
  });

  it('lists did history entries', async () => {
    const client = setupClient('did_history/list.yaml');
    const result = await client.didHistory().list();
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].type).toBe('did_history');
    expect(result.data[0].didNumber).toBe('12025551234');
    expect(result.data[0].action).toBe('assigned');
    expect(result.data[0].method).toBe('api3');
  });

  it('finds a did history entry', async () => {
    const client = setupClient('did_history/show.yaml');
    const result = await client.didHistory().find('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(result.data.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(result.data.didNumber).toBe('12025551234');
    expect(result.data.action).toBe('assigned');
    expect(result.data.method).toBe('api3');
  });

  it('exposes meta from/to for billing_cycles_count_changed action', async () => {
    const client = setupClient('did_history/show_billing_cycles.yaml');
    const result = await client.didHistory().find('b1c2d3e4-f5a6-7890-bcde-f12345678901');
    expect(result.data.id).toBe('b1c2d3e4-f5a6-7890-bcde-f12345678901');
    expect(result.data.action).toBe('billing_cycles_count_changed');
    expect(result.data.didNumber).toBe('442038680521');
    expect(result.data.meta).toBeDefined();
    expect(result.data.meta!.from).toBe(1);
    expect(result.data.meta!.to).toBe(12);
  });
});
