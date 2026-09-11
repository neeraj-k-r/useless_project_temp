export type UserRole = 'USER' | 'CONTROLLER';

export type OutageStatus = 'NORMAL' | 'REPORTING' | 'VERIFIED_OUTAGE';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  communityId: string;
  localityName?: string;
  district?: string;
  pincode: string;
  role: UserRole;
  createdAt: number;
  lastSeen: number;
  torchSupported?: boolean;
}

export interface Community {
  id: string;
  name: string;
  district: string;
  pincode: string;
  lat: number;
  lng: number;
  status: OutageStatus;
  memberCount: number;
  activeReportsCount: number;
  activeRestoresCount: number;
  outageThreshold: number;
  restoreThreshold: number;
  timeWindowMinutes: number; // e.g. 5 mins
  lastOutageVerifiedAt?: number;
  lastRestoredAt?: number;
}

export type ReportType = 'CURRENT_POYI' | 'CURRENT_VANNU';

export interface OutageReport {
  id: string;
  userId: string;
  userName: string;
  communityId: string;
  type: ReportType;
  createdAt: number;
}

export interface OutageEvent {
  id: string;
  communityId: string;
  status: 'ACTIVE' | 'RESTORED';
  verifiedAt: number;
  verifiedBy: 'CONSENSUS' | 'CONTROLLER';
  confirmationsCount: number;
  restoredAt?: number;
}

export type TorchAction = 'BLINK_THEN_ON' | 'TORCH_OFF' | 'SOLID_ON' | 'SOS';
export type TorchPattern = '3_BLINKS' | 'CONTINUOUS' | 'PULSE';

export interface TorchEvent {
  id: string;
  communityId: string;
  action: TorchAction;
  pattern: TorchPattern;
  createdAt: number;
  createdBy: string;
}

export interface ActivityItem {
  id: string;
  timestamp: number;
  userName: string;
  type: 'REPORT_POYI' | 'REPORT_VANNU' | 'OUTAGE_VERIFIED' | 'TORCH_ACTIVATED' | 'POWER_RESTORED';
  message: string;
  communityId: string;
}
