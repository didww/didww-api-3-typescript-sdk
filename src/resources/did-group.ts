import { createReadOnlyResource, type ResourceRef } from './base.js';
import type { Feature } from '../enums.js';
import type { Country } from './country.js';
import type { Region } from './region.js';
import type { City } from './city.js';
import type { DidGroupType } from './did-group-type.js';
import type { StockKeepingUnit } from './stock-keeping-unit.js';
import type { Requirement } from './requirement.js';

export interface DidGroup {
  id: string;
  type: 'did_groups';
  prefix: string;
  features: Feature[];
  isMetered: boolean;
  areaName: string;
  allowAdditionalChannels: boolean;
  country?: Country | ResourceRef;
  region?: Region | ResourceRef;
  city?: City | ResourceRef;
  didGroupType?: DidGroupType | ResourceRef;
  stockKeepingUnits?: (StockKeepingUnit | ResourceRef)[];
  requirement?: Requirement | ResourceRef;
}

export const DID_GROUP_RESOURCE = createReadOnlyResource<DidGroup>('did_groups');
