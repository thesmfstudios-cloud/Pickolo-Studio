import { createHmac, timingSafeEqual } from 'crypto';

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

export function razorpayConfigured() {
  return Boolean(keyId && keySecret);
}

function credentials() {
  if (!keyId || !keySecret) {
    throw new Error('Razorpay server credentials are not configured.');
  }
  return { keyId, keySecret };
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const { keyId, keySecret } = credentials();
  const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.description || 'Unable to create Razorpay order.');
  }

  return data as {
    id: string;
    amount: number;
    currency: string;
    status: string;
    receipt: string;
  };
}

export async function fetchRazorpayPayment(paymentId: string) {
  const { keyId, keySecret } = credentials();
  const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');

  const response = await fetch(
    'https://api.razorpay.com/v1/payments/' + encodeURIComponent(paymentId),
    {
      headers: { Authorization: 'Basic ' + auth },
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.description || 'Unable to verify Razorpay payment.');
  }

  return data as {
    id: string;
    order_id: string | null;
    amount: number;
    currency: string;
    status: string;
  };
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const { keySecret } = credentials();
  const expected = createHmac('sha256', keySecret)
    .update(orderId + '|' + paymentId)
    .digest('hex');

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured.');
  }

  const expected = createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);
}

export function publicRazorpayKey() {
  if (!keyId) throw new Error('RAZORPAY_KEY_ID is not configured.');
  return keyId;
}
