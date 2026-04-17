import { createReadOnlyResource } from './base.js';

/**
 * DID History record representing a single ownership event.
 *
 * When `action` is `'billing_cycles_count_changed'`, the response includes
 * JSON:API resource-level `meta` with `from` and `to` string fields
 * indicating the previous and new billing_cycles_count values.
 * Meta is absent for every other action.
 */
export interface DidHistory {
  id: string;
  type: 'did_history';
  /** The DID number this event relates to. */
  didNumber: string;
  /** Event action (e.g. "assigned", "unassigned", "billing_cycles_count_changed"). */
  action: string;
  /** How the event was triggered (e.g. "api", "admin"). */
  method: string;
  /** When the event occurred. */
  createdAt: string;
  /** Resource-level JSON:API meta. Generic key-value map for forward compatibility. */
  meta?: Record<string, string>;
}

export const DID_HISTORY_RESOURCE = createReadOnlyResource<DidHistory>('did_history', 'did_history');
