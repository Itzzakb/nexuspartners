/** Currencies supported for Razorpay payment links (ISO 4217). */
export const PAYMENT_CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
];

const PAYMENT_CURRENCY_CODES = new Set(PAYMENT_CURRENCIES.map((c) => c.code));

export function normalizePaymentCurrency(value) {
  return String(value || 'INR')
    .trim()
    .toUpperCase();
}

export function isSupportedPaymentCurrency(value) {
  return PAYMENT_CURRENCY_CODES.has(normalizePaymentCurrency(value));
}

/** Billing, payments, subscriptions, and payment links. */
export function getBillingCurrency(company) {
  return normalizePaymentCurrency(
    company?.billingCurrency || company?.salaryCurrency || 'INR'
  );
}

/** Employee salaries. */
export function getSalaryCurrency(company) {
  return normalizePaymentCurrency(company?.salaryCurrency || 'INR');
}
