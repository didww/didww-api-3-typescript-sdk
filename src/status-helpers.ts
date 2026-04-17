import type { VoiceOutTrunk } from './resources/voice-out-trunk.js';
import type { Export } from './resources/export.js';
import type { EmergencyCallingService } from './resources/emergency-calling-service.js';
import type { AddressVerification } from './resources/address-verification.js';
import type { EmergencyVerification } from './resources/emergency-verification.js';
import type { Order } from './resources/order.js';
import {
  VoiceOutTrunkStatus,
  ExportStatus,
  EmergencyCallingServiceStatus,
  AddressVerificationStatus,
  EmergencyVerificationStatus,
  OrderStatus,
} from './enums.js';

// VoiceOutTrunk status predicates
export function isActive(trunk: VoiceOutTrunk): boolean {
  return trunk.status === VoiceOutTrunkStatus.ACTIVE;
}
export function isBlocked(trunk: VoiceOutTrunk): boolean {
  return trunk.status === VoiceOutTrunkStatus.BLOCKED;
}

// Export status predicates
export function isExportPending(exp: Export): boolean {
  return exp.status === ExportStatus.PENDING;
}
export function isExportProcessing(exp: Export): boolean {
  return exp.status === ExportStatus.PROCESSING;
}
export function isExportCompleted(exp: Export): boolean {
  return exp.status === ExportStatus.COMPLETED;
}

// EmergencyCallingService status predicates
export function isEcsActive(ecs: EmergencyCallingService): boolean {
  return ecs.status === EmergencyCallingServiceStatus.ACTIVE;
}
export function isEcsCanceled(ecs: EmergencyCallingService): boolean {
  return ecs.status === EmergencyCallingServiceStatus.CANCELED;
}
export function isEcsChangesRequired(ecs: EmergencyCallingService): boolean {
  return ecs.status === EmergencyCallingServiceStatus.CHANGES_REQUIRED;
}
export function isEcsInProcess(ecs: EmergencyCallingService): boolean {
  return ecs.status === EmergencyCallingServiceStatus.IN_PROCESS;
}
export function isEcsNew(ecs: EmergencyCallingService): boolean {
  return ecs.status === EmergencyCallingServiceStatus.NEW;
}
export function isEcsPendingUpdate(ecs: EmergencyCallingService): boolean {
  return ecs.status === EmergencyCallingServiceStatus.PENDING_UPDATE;
}

// AddressVerification status predicates
export function isAddressVerificationPending(av: AddressVerification): boolean {
  return av.status === AddressVerificationStatus.PENDING;
}
export function isAddressVerificationApproved(av: AddressVerification): boolean {
  return av.status === AddressVerificationStatus.APPROVED;
}
export function isAddressVerificationRejected(av: AddressVerification): boolean {
  return av.status === AddressVerificationStatus.REJECTED;
}

// EmergencyVerification status predicates
export function isEmergencyVerificationPending(ev: EmergencyVerification): boolean {
  return ev.status === EmergencyVerificationStatus.PENDING;
}
export function isEmergencyVerificationApproved(ev: EmergencyVerification): boolean {
  return ev.status === EmergencyVerificationStatus.APPROVED;
}
export function isEmergencyVerificationRejected(ev: EmergencyVerification): boolean {
  return ev.status === EmergencyVerificationStatus.REJECTED;
}

// Order status predicates
export function isOrderPending(order: Order): boolean {
  return order.status === OrderStatus.PENDING;
}
export function isOrderCompleted(order: Order): boolean {
  return order.status === OrderStatus.COMPLETED;
}
export function isOrderCanceled(order: Order): boolean {
  return order.status === OrderStatus.CANCELED;
}
