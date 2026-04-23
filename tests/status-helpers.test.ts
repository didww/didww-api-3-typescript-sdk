import { describe, it, expect } from 'vitest';
import {
  VoiceOutTrunkStatus,
  ExportStatus,
  EmergencyCallingServiceStatus,
  AddressVerificationStatus,
  EmergencyVerificationStatus,
  OrderStatus,
} from '../src/enums.js';
import {
  isActive,
  isBlocked,
  isExportPending,
  isExportProcessing,
  isExportCompleted,
  isEcsActive,
  isEcsCanceled,
  isEcsChangesRequired,
  isEcsInProcess,
  isEcsNew,
  isEcsPendingUpdate,
  isAddressVerificationPending,
  isAddressVerificationApproved,
  isAddressVerificationRejected,
  isEmergencyVerificationPending,
  isEmergencyVerificationApproved,
  isEmergencyVerificationRejected,
  isOrderPending,
  isOrderCompleted,
  isOrderCanceled,
} from '../src/status-helpers.js';
import type { VoiceOutTrunk } from '../src/resources/voice-out-trunk.js';
import type { Export } from '../src/resources/export.js';
import type { EmergencyCallingService } from '../src/resources/emergency-calling-service.js';
import type { AddressVerification } from '../src/resources/address-verification.js';
import type { EmergencyVerification } from '../src/resources/emergency-verification.js';
import type { Order } from '../src/resources/order.js';

describe('status helpers', () => {
  describe('VoiceOutTrunk', () => {
    const activeTrunk = { status: VoiceOutTrunkStatus.ACTIVE } as VoiceOutTrunk;
    const blockedTrunk = { status: VoiceOutTrunkStatus.BLOCKED } as VoiceOutTrunk;

    it('isActive returns true for Active status', () => {
      expect(isActive(activeTrunk)).toBe(true);
      expect(isActive(blockedTrunk)).toBe(false);
    });

    it('isBlocked returns true for Blocked status', () => {
      expect(isBlocked(blockedTrunk)).toBe(true);
      expect(isBlocked(activeTrunk)).toBe(false);
    });
  });

  describe('Export', () => {
    const pending = { status: ExportStatus.PENDING } as Export;
    const processing = { status: ExportStatus.PROCESSING } as Export;
    const completed = { status: ExportStatus.COMPLETED } as Export;

    it('isExportPending returns true for Pending status', () => {
      expect(isExportPending(pending)).toBe(true);
      expect(isExportPending(completed)).toBe(false);
    });

    it('isExportProcessing returns true for Processing status', () => {
      expect(isExportProcessing(processing)).toBe(true);
      expect(isExportProcessing(pending)).toBe(false);
    });

    it('isExportCompleted returns true for Completed status', () => {
      expect(isExportCompleted(completed)).toBe(true);
      expect(isExportCompleted(processing)).toBe(false);
    });
  });

  describe('EmergencyCallingService', () => {
    const active = { status: EmergencyCallingServiceStatus.ACTIVE } as EmergencyCallingService;
    const canceled = { status: EmergencyCallingServiceStatus.CANCELED } as EmergencyCallingService;
    const changesRequired = { status: EmergencyCallingServiceStatus.CHANGES_REQUIRED } as EmergencyCallingService;
    const inProcess = { status: EmergencyCallingServiceStatus.IN_PROCESS } as EmergencyCallingService;
    const newStatus = { status: EmergencyCallingServiceStatus.NEW } as EmergencyCallingService;
    const pendingUpdate = { status: EmergencyCallingServiceStatus.PENDING_UPDATE } as EmergencyCallingService;

    it('isEcsActive returns true for active status', () => {
      expect(isEcsActive(active)).toBe(true);
      expect(isEcsActive(canceled)).toBe(false);
    });

    it('isEcsCanceled returns true for canceled status', () => {
      expect(isEcsCanceled(canceled)).toBe(true);
      expect(isEcsCanceled(active)).toBe(false);
    });

    it('isEcsChangesRequired returns true for changes required status', () => {
      expect(isEcsChangesRequired(changesRequired)).toBe(true);
      expect(isEcsChangesRequired(active)).toBe(false);
    });

    it('isEcsInProcess returns true for in process status', () => {
      expect(isEcsInProcess(inProcess)).toBe(true);
      expect(isEcsInProcess(active)).toBe(false);
    });

    it('isEcsNew returns true for new status', () => {
      expect(isEcsNew(newStatus)).toBe(true);
      expect(isEcsNew(active)).toBe(false);
    });

    it('isEcsPendingUpdate returns true for pending update status', () => {
      expect(isEcsPendingUpdate(pendingUpdate)).toBe(true);
      expect(isEcsPendingUpdate(active)).toBe(false);
    });
  });

  describe('AddressVerification', () => {
    const pending = { status: AddressVerificationStatus.PENDING } as AddressVerification;
    const approved = { status: AddressVerificationStatus.APPROVED } as AddressVerification;
    const rejected = { status: AddressVerificationStatus.REJECTED } as AddressVerification;

    it('isAddressVerificationPending returns true for Pending status', () => {
      expect(isAddressVerificationPending(pending)).toBe(true);
      expect(isAddressVerificationPending(approved)).toBe(false);
    });

    it('isAddressVerificationApproved returns true for Approved status', () => {
      expect(isAddressVerificationApproved(approved)).toBe(true);
      expect(isAddressVerificationApproved(pending)).toBe(false);
    });

    it('isAddressVerificationRejected returns true for Rejected status', () => {
      expect(isAddressVerificationRejected(rejected)).toBe(true);
      expect(isAddressVerificationRejected(pending)).toBe(false);
    });
  });

  describe('EmergencyVerification', () => {
    const pending = { status: EmergencyVerificationStatus.PENDING } as EmergencyVerification;
    const approved = { status: EmergencyVerificationStatus.APPROVED } as EmergencyVerification;
    const rejected = { status: EmergencyVerificationStatus.REJECTED } as EmergencyVerification;

    it('isEmergencyVerificationPending returns true for pending status', () => {
      expect(isEmergencyVerificationPending(pending)).toBe(true);
      expect(isEmergencyVerificationPending(approved)).toBe(false);
    });

    it('isEmergencyVerificationApproved returns true for approved status', () => {
      expect(isEmergencyVerificationApproved(approved)).toBe(true);
      expect(isEmergencyVerificationApproved(pending)).toBe(false);
    });

    it('isEmergencyVerificationRejected returns true for rejected status', () => {
      expect(isEmergencyVerificationRejected(rejected)).toBe(true);
      expect(isEmergencyVerificationRejected(pending)).toBe(false);
    });
  });

  describe('Order', () => {
    const pending = { status: OrderStatus.PENDING } as Order;
    const completed = { status: OrderStatus.COMPLETED } as Order;
    const cancelled = { status: OrderStatus.CANCELED } as Order;

    it('isOrderPending returns true for Pending status', () => {
      expect(isOrderPending(pending)).toBe(true);
      expect(isOrderPending(completed)).toBe(false);
    });

    it('isOrderCompleted returns true for Completed status', () => {
      expect(isOrderCompleted(completed)).toBe(true);
      expect(isOrderCompleted(pending)).toBe(false);
    });

    it('isOrderCanceled returns true for Canceled status', () => {
      expect(isOrderCanceled(cancelled)).toBe(true);
      expect(isOrderCanceled(pending)).toBe(false);
    });
  });
});
