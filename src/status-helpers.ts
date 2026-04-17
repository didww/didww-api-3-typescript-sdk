import {
  VoiceOutTrunkStatus,
  ExportStatus,
  EmergencyCallingServiceStatus,
  AddressVerificationStatus,
  EmergencyVerificationStatus,
  OrderStatus,
} from './enums.js';

interface HasStatus<S> {
  status: S | (string & {});
}

// VoiceOutTrunk status predicates
export function isActive(trunk: HasStatus<VoiceOutTrunkStatus>): boolean {
  return trunk.status === VoiceOutTrunkStatus.ACTIVE;
}
export function isBlocked(trunk: HasStatus<VoiceOutTrunkStatus>): boolean {
  return trunk.status === VoiceOutTrunkStatus.BLOCKED;
}

// Export status predicates
export function isExportPending(exp: HasStatus<ExportStatus>): boolean {
  return exp.status === ExportStatus.PENDING;
}
export function isExportProcessing(exp: HasStatus<ExportStatus>): boolean {
  return exp.status === ExportStatus.PROCESSING;
}
export function isExportCompleted(exp: HasStatus<ExportStatus>): boolean {
  return exp.status === ExportStatus.COMPLETED;
}

// EmergencyCallingService status predicates
export function isEcsActive(ecs: HasStatus<EmergencyCallingServiceStatus>): boolean {
  return ecs.status === EmergencyCallingServiceStatus.ACTIVE;
}
export function isEcsCanceled(ecs: HasStatus<EmergencyCallingServiceStatus>): boolean {
  return ecs.status === EmergencyCallingServiceStatus.CANCELED;
}
export function isEcsChangesRequired(ecs: HasStatus<EmergencyCallingServiceStatus>): boolean {
  return ecs.status === EmergencyCallingServiceStatus.CHANGES_REQUIRED;
}
export function isEcsInProcess(ecs: HasStatus<EmergencyCallingServiceStatus>): boolean {
  return ecs.status === EmergencyCallingServiceStatus.IN_PROCESS;
}
export function isEcsNew(ecs: HasStatus<EmergencyCallingServiceStatus>): boolean {
  return ecs.status === EmergencyCallingServiceStatus.NEW;
}
export function isEcsPendingUpdate(ecs: HasStatus<EmergencyCallingServiceStatus>): boolean {
  return ecs.status === EmergencyCallingServiceStatus.PENDING_UPDATE;
}

// AddressVerification status predicates
export function isAddressVerificationPending(av: HasStatus<AddressVerificationStatus>): boolean {
  return av.status === AddressVerificationStatus.PENDING;
}
export function isAddressVerificationApproved(av: HasStatus<AddressVerificationStatus>): boolean {
  return av.status === AddressVerificationStatus.APPROVED;
}
export function isAddressVerificationRejected(av: HasStatus<AddressVerificationStatus>): boolean {
  return av.status === AddressVerificationStatus.REJECTED;
}

// EmergencyVerification status predicates
export function isEmergencyVerificationPending(ev: HasStatus<EmergencyVerificationStatus>): boolean {
  return ev.status === EmergencyVerificationStatus.PENDING;
}
export function isEmergencyVerificationApproved(ev: HasStatus<EmergencyVerificationStatus>): boolean {
  return ev.status === EmergencyVerificationStatus.APPROVED;
}
export function isEmergencyVerificationRejected(ev: HasStatus<EmergencyVerificationStatus>): boolean {
  return ev.status === EmergencyVerificationStatus.REJECTED;
}

// Order status predicates
export function isOrderPending(order: HasStatus<OrderStatus>): boolean {
  return order.status === OrderStatus.PENDING;
}
export function isOrderCompleted(order: HasStatus<OrderStatus>): boolean {
  return order.status === OrderStatus.COMPLETED;
}
export function isOrderCanceled(order: HasStatus<OrderStatus>): boolean {
  return order.status === OrderStatus.CANCELED;
}
