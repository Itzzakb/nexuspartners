import crypto from 'crypto';

export function isMockMode(credentials = {}) {
  const keyId = credentials.keyId || process.env.RAZORPAY_KEY_ID || '';
  return !keyId || keyId.startsWith('mock');
}

export function getRazorpayCredentials(company) {
  if (company?.razorpay?.enabled && company.razorpay.keyId && company.razorpay.keySecret) {
    return { keyId: company.razorpay.keyId, keySecret: company.razorpay.keySecret };
  }
  return {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  };
}

export async function createRazorpayPaymentLink(credentials, payload) {
  if (isMockMode(credentials)) {
    const mockId = `plink_mock_${Date.now()}`;
    return {
      id: mockId,
      short_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payments/mock/${mockId}`,
      status: 'created',
      amount: payload.amount,
      currency: payload.currency,
    };
  }

  const auth = Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.description || data.error || `Razorpay error ${res.status}`);
  }
  return data;
}

export function verifyWebhookSignature(rawBody, signature, secret) {
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!webhookSecret) {
    return isMockMode();
  }
  if (!signature) return false;

  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
  return expected === signature;
}

export function buildRazorpayLinkPayload({
  amount,
  currency,
  description,
  customer,
  expireBy,
  notifyEmail,
  notifySms,
  referenceId,
}) {
  const payload = {
    amount: Math.round(amount),
    currency: currency || 'INR',
    description: description || 'Subscription payment',
    customer: {
      name: customer.name || '',
      email: customer.email || '',
      contact: customer.contact || '',
    },
    notify: {
      sms: notifySms !== false,
      email: notifyEmail !== false,
    },
  };

  if (expireBy) {
    payload.expire_by = Math.floor(new Date(expireBy).getTime() / 1000);
  }
  if (referenceId) {
    payload.reference_id = referenceId;
  }

  return payload;
}
