
export enum Role {
  MAKER = 'MAKER',
  CHECKER = 'CHECKER',
  ADMIN = 'ADMIN'
}

export enum CommercialType {
  MARGIN_PERCENT = 'Margin %',
  NLC_VALUE = 'NLC Value',
  NLC_PERCENT = 'NLC %',
  ON_INVOICE = 'On Invoice %',
  OFF_INVOICE = 'Off Invoice %'
}

export interface User {
  id: string;
  employeeId: string;
  name: string;
  role: Role;
  pin?: string; // Encrypted in real app
}

export interface CommercialRecord {
  id: string;
  fsn: string;
  brand: string;
  title: string;
  city: string;
  vertical: string;
  kam: string;
  startDate: string;
  endDate: string;
  type: CommercialType;
  value: number;
  lastUpdatedBy: string;
  lastUpdatedAt: number;
}

export interface DuplicateRequest {
  id: string;
  originalRecordId: string | null; // Null if it's a new conflict without ID yet, but usually maps to existing
  payload: CommercialRecord;
  requestedBy: string;
  requestedAt: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string; // Reason for approval (Conflict, High Margin, etc.)
}

export const CITIES = [
  'PAN-INDIA', 'BLR', 'DEL', 'MUM', 'KOL', 'CHE', 'HYD', 'PUN'
];

export const COMMERCIAL_TYPES = [
  CommercialType.MARGIN_PERCENT,
  CommercialType.NLC_VALUE,
  CommercialType.NLC_PERCENT,
  CommercialType.ON_INVOICE,
  CommercialType.OFF_INVOICE
];
