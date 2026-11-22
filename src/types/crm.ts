import { z } from 'zod';

export type UserRole = 'admin' | 'staff';

export const EMPLOYMENT_TYPES = ['Salaried', 'Self-Employed', 'Business Owner', 'Professional'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const LOAN_TYPES = [
  'Home Loan',
  'Personal Loan',
  'Business Loan',
  'Auto Loan',
  'Education Loan',
  'Loan Against Property',
] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

export const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Interested',
  'Not Interested',
  'Callback Requested',
  'Qualified',
  'Converted',
  'Lost',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_PRIORITIES = ['High', 'Medium', 'Low'] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const CALL_STATUSES = [
  'Connected',
  'Not Connected',
  'Busy',
  'No Answer',
  'Interested',
  'Not Interested',
  'Callback Requested',
  'Wrong Number',
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const DOCUMENT_TYPES = [
  'Aadhaar Card',
  'PAN Card',
  'Bank Statement',
  'Salary Slip',
  'Employment Proof',
  'Address Proof',
  'Other Documents',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = ['Pending', 'Verified', 'Rejected', 'Re-upload Required'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const LOAN_APPLICATION_STATUSES = [
  'Lead Interested',
  'Documents Pending',
  'Documents Submitted',
  'Under Bank Review',
  'Additional Documents Required',
  'Approved',
  'Rejected',
  'Disbursed',
  'Closed',
] as const;
export type LoanApplicationStatus = (typeof LOAN_APPLICATION_STATUSES)[number];

export type DuplicateRule = 'phone' | 'email' | 'phone_or_email' | 'none';

export interface UserAccount {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  employeeId?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  uid?: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  department: string;
  joiningDate: string;
  status: 'active' | 'inactive';
  dailyCallTarget: number;
  createdAt: string;
  updatedAt: string;
}

export type LeadScoreTier = 'Hot' | 'Warm' | 'Cold';

export interface LeadScoreFactors {
  demographics: number;
  financialCapacity: number;
  sourceQuality: number;
  engagementHistory: number;
}

export interface Lead {
  id: string;
  leadCode: string;
  customerName: string;
  phone: string;
  email?: string;
  city: string;
  state: string;
  employmentType: EmploymentType;
  monthlyIncome: number;
  requiredLoanAmount: number;
  loanType: LoanType;
  preferredBank?: string;
  leadSource: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  assignedEmployeeEmail?: string;
  assignedEmployeeUid?: string;
  status: LeadStatus;
  priority: LeadPriority;
  remarks?: string;
  leadScore?: number;
  scoreTier?: LeadScoreTier;
  scoreSummary?: string;
  scoreFactors?: LeadScoreFactors;
  scoredAt?: string;
  scoreModel?: string;
  leadDate?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadAssignment {
  id: string;
  leadId: string;
  leadCode: string;
  customerName: string;
  fromEmployeeId?: string;
  fromEmployeeName?: string;
  toEmployeeId: string;
  toEmployeeName: string;
  toEmployeeEmail?: string;
  assignedByUid: string;
  assignedByName: string;
  method: 'manual' | 'bulk' | 'round_robin';
  notes?: string;
  createdAt: string;
}

export interface CallLog {
  id: string;
  leadId: string;
  leadCode: string;
  customerName: string;
  customerPhone: string;
  employeeId: string;
  employeeEmail: string;
  employeeUid?: string;
  employeeName: string;
  callTime: string;
  durationSeconds: number;
  status: CallStatus;
  remarks?: string;
  nextFollowUpDate?: string;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  leadId: string;
  leadCode: string;
  customerName: string;
  customerPhone: string;
  employeeId: string;
  employeeEmail: string;
  employeeUid?: string;
  employeeName: string;
  scheduledAt: string;
  notes?: string;
  status: 'pending' | 'completed' | 'cancelled';
  completedAt?: string;
  outcomeNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDocument {
  id: string;
  leadId: string;
  leadCode: string;
  customerName: string;
  employeeId: string;
  employeeEmail: string;
  employeeUid?: string;
  employeeName: string;
  docType: DocumentType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  hasFileBlob?: boolean;
  previewSummary?: string;
  status: DocumentStatus;
  rejectionReason?: string;
  verifiedByUid?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bank {
  id: string;
  name: string;
  shortCode: string;
  logoColor: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface LoanScheme {
  id: string;
  bankId: string;
  bankName: string;
  schemeName: string;
  loanType: LoanType;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  minIncome: number;
  minCreditScore?: number;
  processingFee: string;
  tenureMonths: string;
  description?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface LoanApplication {
  id: string;
  applicationCode: string;
  leadId: string;
  leadCode: string;
  customerName: string;
  customerPhone: string;
  employeeId: string;
  employeeEmail: string;
  employeeUid?: string;
  employeeName: string;
  bankId: string;
  bankName: string;
  schemeId: string;
  schemeName: string;
  loanType?: string;
  loanAmount: number;
  applicationDate: string;
  status: LoanApplicationStatus;
  bankReferenceNumber?: string;
  remarks?: string;
  disbursedAmount?: number;
  disbursedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanStatusHistory {
  id: string;
  applicationId: string;
  applicationCode: string;
  employeeEmail?: string;
  fromStatus?: string;
  toStatus: string;
  remarks?: string;
  changedByUid: string;
  changedByName: string;
  createdAt: string;
}

export interface DailyTarget {
  id: string;
  employeeId: string;
  employeeEmail: string;
  date: string;
  callTarget: number;
  updatedByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  actorUid: string;
  actorEmail?: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface CrmSettings {
  id: string;
  duplicateRule: DuplicateRule;
  defaultDailyCallTarget: number;
  roundRobinIndex: number;
  seeded: boolean;
  updatedAt: string;
}

export type NotificationCategory =
  | 'lead_assigned'
  | 'lead_attention'
  | 'follow_up_upcoming'
  | 'doc_update'
  | 'application_update';

export type NotificationSeverity = 'info' | 'warning' | 'urgent' | 'success';

export type NotificationEntityType = 'lead' | 'follow_up' | 'customer_document' | 'loan_application';

export interface CrmNotification {
  id: string;
  targetRole: UserRole;
  targetEmail: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType: NotificationEntityType;
  entityId: string;
  leadCode?: string;
  read: boolean;
  readAt?: string;
  actorName: string;
  createdAt: string;
  updatedAt: string;
}

// Zod Schemas for Form Validation
export const leadFormSchema = z.object({
  customerName: z.string().min(2, 'Customer name must be at least 2 characters').max(150),
  phone: z.string().min(8, 'Valid phone number required').max(32),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  monthlyIncome: z.coerce.number().min(0, 'Monthly income must be positive'),
  requiredLoanAmount: z.coerce.number().min(1000, 'Loan amount must be at least 1,000'),
  loanType: z.enum(LOAN_TYPES),
  preferredBank: z.string().max(120).optional(),
  leadSource: z.string().min(1, 'Lead source is required').max(80),
  assignedEmployeeId: z.string().optional(),
  status: z.enum(LEAD_STATUSES),
  priority: z.enum(LEAD_PRIORITIES),
  remarks: z.string().max(2000).optional(),
});

export const employeeFormSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(150),
  email: z.string().email('Valid email address required').max(200),
  phone: z.string().min(8, 'Phone number required').max(32),
  role: z.enum(['admin', 'staff']),
  department: z.string().min(2, 'Department is required').max(100),
  joiningDate: z.string().min(4, 'Joining date is required'),
  status: z.enum(['active', 'inactive']),
  dailyCallTarget: z.coerce.number().min(1, 'Daily target must be at least 1').max(500),
});

export const bankFormSchema = z.object({
  name: z.string().min(2, 'Bank name is required').max(150),
  shortCode: z.string().min(2, 'Short code is required').max(16),
  logoColor: z.string().min(4).max(24),
  contactPerson: z.string().min(2, 'Contact person is required').max(150),
  contactNumber: z.string().min(6, 'Contact number is required').max(32),
  email: z.string().email('Valid email is required').max(200),
  status: z.enum(['active', 'inactive']),
});

export const schemeFormSchema = z.object({
  bankId: z.string().min(1, 'Select a partner bank'),
  schemeName: z.string().min(2, 'Scheme name is required').max(180),
  loanType: z.enum(LOAN_TYPES),
  minAmount: z.coerce.number().min(0),
  maxAmount: z.coerce.number().min(1000),
  interestRate: z.coerce.number().min(0.1).max(60),
  minIncome: z.coerce.number().min(0),
  minCreditScore: z.coerce.number().min(300).max(900).optional(),
  processingFee: z.string().min(1, 'Processing fee is required').max(64),
  tenureMonths: z.string().min(1, 'Tenure range is required').max(64),
  description: z.string().max(1500).optional(),
  status: z.enum(['active', 'inactive']),
});

export const callLogFormSchema = z.object({
  leadId: z.string().min(1, 'Select a lead'),
  status: z.enum(CALL_STATUSES),
  durationSeconds: z.coerce.number().min(0).max(86400),
  remarks: z.string().max(2000).optional(),
  nextFollowUpDate: z.string().optional(),
  updateLeadStatus: z.enum(LEAD_STATUSES).optional(),
});

export const followUpFormSchema = z.object({
  leadId: z.string().min(1, 'Select a lead'),
  employeeId: z.string().min(1, 'Assign to an employee'),
  scheduledAt: z.string().min(8, 'Choose follow-up date and time'),
  notes: z.string().max(1500).optional(),
});

export const loanApplicationFormSchema = z.object({
  leadId: z.string().min(1, 'Select a customer lead'),
  bankId: z.string().min(1, 'Select a bank'),
  schemeId: z.string().min(1, 'Select a loan scheme'),
  loanAmount: z.coerce.number().min(1000, 'Loan amount required'),
  bankReferenceNumber: z.string().max(80).optional(),
  remarks: z.string().max(2000).optional(),
});
