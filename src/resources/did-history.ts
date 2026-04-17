import { createReadOnlyResource } from './base.js';

/**
 * Meta fields present on a DidHistory record when
 * `action` is `'billing_cycles_count_changed'`.
 */
export interface DidHistoryBillingCyclesMeta {
  /** Previous billing_cycles_count value. */
  from: number;
  /** New billing_cycles_count value. */
  to: number;
}

/**
 * DID History record representing a single ownership event.
 *
 * When `action` is `'billing_cycles_count_changed'`, the response includes
 * JSON:API `meta` with `from` and `to` integers representing the previous
 * and new billing_cycles_count values. These meta fields are absent for
 * every other action.
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
  /**
   * Resource-level meta. Present only when `action` is
   * `'billing_cycles_count_changed'`; contains `from` and `to` integers
   * representing the previous and new billing_cycles_count values.
   */
  meta?: DidHistoryBillingCyclesMeta;
}

export const DID_HISTORY_RESOURCE = createReadOnlyResource<DidHistory>('did_history', 'did_history');
