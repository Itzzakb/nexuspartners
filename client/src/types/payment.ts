export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'razorpay' | 'cash' | 'upi' | 'bank_transfer' | 'other';
export type PaymentType = 'new' | 'renewal' | 'other';
export type LinkStatus = 'created' | 'paid' | 'expired' | 'cancelled' | 'partially_paid';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'completed';
export type SubscriptionFrequency = 'monthly' | 'quarterly' | 'yearly' | 'one_time';

export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  studentName: string;
  studentPhone: string;
  studentEmail: string;
  amount: number;
  currency: string;
  amountFormatted: string;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  status: PaymentStatus;
  description: string;
  razorpayPaymentId: string;
  razorpayPaymentLinkId: string;
  ticketId?: string;
  companyId: string;
  companyLabel: string;
  notes: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentLink {
  id: string;
  razorpayLinkId: string;
  shortUrl: string;
  amount: number;
  currency: string;
  amountFormatted: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerContact: string;
  paymentType: PaymentType;
  status: LinkStatus;
  statusUpdatedAt: string | null;
  lastWebhookEvent: string;
  lastPaymentStatus: '' | 'failed' | 'captured';
  lastPaymentId: string;
  lastPaymentAttemptAt: string | null;
  failureCode: string;
  failureDescription: string;
  expireBy: string | null;
  notifyEmail: boolean;
  notifySms: boolean;
  paymentRecordId?: string;
  ticketId?: string;
  companyId: string;
  companyLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionSchedule {
  id: string;
  studentName: string;
  studentPhone: string;
  studentEmail: string;
  planName: string;
  amount: number;
  currency: string;
  amountFormatted: string;
  frequency: SubscriptionFrequency;
  nextDueDate: string | null;
  status: SubscriptionStatus;
  notes: string;
  companyId: string;
  companyLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentStats {
  total: number;
  paid: number;
  pending: number;
  totalCollected: number;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  razorpay: 'Razorpay',
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
};

export const LINK_STATUS_LABELS: Record<LinkStatus, string> = {
  created: 'Created',
  paid: 'Paid',
  expired: 'Expired',
  cancelled: 'Cancelled',
  partially_paid: 'Partially paid',
};

export const PAYMENT_CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
] as const;
