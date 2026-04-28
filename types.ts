
export enum Role {
  MAKER = 'MAKER',
  CHECKER = 'CHECKER'
}

export enum CommercialType {
  MARGIN_PERCENT = 'Margin %',
  NLC_VALUE = 'NLC Value',
  NLC_PERCENT = 'NLC %',
  ON_INVOICE = 'On Invoice %',
  OFF_INVOICE = 'Off Invoice %',
  SCM_PROCESSING_COST = 'SCM / Processing Cost'
}

export const DEFAULT_COST_MAPPING: Record<string, { processingCost: number, scmCost: number }> = {
  'KOL': { processingCost: 0, scmCost: 1.65 },
  'CHA': { processingCost: 0, scmCost: 1.75 },
  'HYD': { processingCost: 0, scmCost: 1.7 },
  'DEL': { processingCost: 0.8, scmCost: 1.9 },
  'GUW': { processingCost: 0, scmCost: 1.84 },
  'PAT': { processingCost: 0, scmCost: 1.7 },
  'RBI': { processingCost: 0, scmCost: 1.7 },
  'PUN': { processingCost: 0, scmCost: 0 },
  'MUM': { processingCost: 0, scmCost: 0 },
  'ROM': { processingCost: 0, scmCost: 0 },
  'BHU': { processingCost: 0, scmCost: 1.7 },
  'ROO': { processingCost: 0, scmCost: 1.7 },
  'RAN': { processingCost: 0, scmCost: 1.7 },
  'JAM': { processingCost: 0, scmCost: 1.7 },
  'RJH': { processingCost: 0, scmCost: 1.7 },
  'RWB': { processingCost: 0, scmCost: 1.65 },
};

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
  CommercialType.OFF_INVOICE,
  CommercialType.SCM_PROCESSING_COST
];