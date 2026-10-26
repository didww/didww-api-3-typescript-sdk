import { defineResource } from './base.js';
import type { ExportType, ExportStatus, ExportTrunkType, CallbackMethod } from '../enums.js';

/** Export criteria. Any key the export type does not accept is rejected by the API. */
export interface ExportFilters {
  /** Start of the exported period, `YYYY-MM-DD HH:MM:SS` in UTC, inclusive. Every export type. */
  from?: string;
  /** End of the exported period, `YYYY-MM-DD HH:MM:SS` in UTC, exclusive. Every export type. */
  to?: string;
  /** Only for CDR in */
  didNumber?: string;
  /** Only for CDR out */
  voiceOutTrunkId?: string;
  /** cdr_in: caller number as it reached DIDWW. */
  sourceNumber?: string;
  /** cdr_in: caller number as delivered to the trunk. */
  sourceNumberOut?: string;
  /** cdr_in: ISO 3166-1 alpha-2 code of the caller's country. */
  sourceCountryIso?: string;
  /** cdr_out: source number. */
  source?: string;
  /** cdr_out: presented caller ID. */
  cli?: string;
  /** cdr_out: called number. */
  destination?: string;
  /** SMS: sender address, exact match. */
  sourceAddressEq?: string;
  /** SMS: sender address contains this value. */
  sourceAddressCont?: string;
  /** SMS: recipient address, exact match. */
  destinationAddressEq?: string;
  /** SMS: recipient address contains this value. */
  destinationAddressCont?: string;
  /** SMS: message state (`Success`, `Failed`, `Queued`, and for sms_out also `Routing Error`, `In Progress`). */
  status?: string;
  /** SMS: message id. */
  smsId?: string;
  /** SMS: one SMS trunk of the account, or any of these. */
  'smsTrunk.id'?: string | string[];
  /** sms_in: trunk type, or any of these. */
  trunkType?: ExportTrunkType | ExportTrunkType[];
  /** sms_out: `a2p` or `p2p` (any case). */
  serviceType?: string;
  /** sms_out: one Sender ID verification, or any of these. */
  'senderIdVerification.id'?: string | string[];
  /** Read-only: present on exports created with an earlier API version. */
  year?: string;
  /** Read-only: present on exports created with an earlier API version. */
  month?: string;
  /** Read-only: present on exports created with an earlier API version. */
  day?: string;
}

export interface Export {
  id: string;
  type: 'exports';
  exportType: ExportType;
  url: string | null;
  callbackUrl: string | null;
  callbackMethod: CallbackMethod | null;
  status: ExportStatus | (string & {});
  filters: ExportFilters;
  createdAt: string;
  externalReferenceId: string | null;
}

export interface ExportWrite {
  exportType?: ExportType;
  filters?: ExportFilters;
  callbackUrl?: string | null;
  callbackMethod?: CallbackMethod | null;
  externalReferenceId?: string | null;
}

export const EXPORT_RESOURCE = defineResource<Export, ExportWrite>()({
  type: 'exports',
  path: 'exports',
  writableKeys: ['exportType', 'filters', 'callbackUrl', 'callbackMethod', 'externalReferenceId'],
  operations: ['list', 'find', 'create', 'update', 'remove'],
});
