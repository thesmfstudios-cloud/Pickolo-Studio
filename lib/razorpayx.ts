type RazorpayXPayoutInput = {
  amountPaise: number;
  bookingId: string;
  bookingCode: string;
  partnerId: string;
  partnerName: string;
  partnerEmail?: string | null;
  partnerPhone?: string | null;
  payoutUpiId: string;
};

type RazorpayXPayoutResult = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  referenceId: string;
};

export function razorpayXPayoutsEnabled() {
  return (
    process.env.RAZORPAYX_PAYOUTS_ENABLED === "true" &&
    Boolean(process.env.RAZORPAYX_KEY_ID) &&
    Boolean(process.env.RAZORPAYX_KEY_SECRET) &&
    Boolean(process.env.RAZORPAYX_ACCOUNT_NUMBER)
  );
}

export async function createRazorpayXUpiPayout(
  input: RazorpayXPayoutInput,
): Promise<RazorpayXPayoutResult> {
  const keyId = process.env.RAZORPAYX_KEY_ID;
  const keySecret = process.env.RAZORPAYX_KEY_SECRET;
  const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;

  if (!keyId || !keySecret || !accountNumber) {
    throw new Error("RazorpayX payout configuration is incomplete.");
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/payouts", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      "X-Payout-Idempotency": input.bookingId,
    },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      account_number: accountNumber,
      amount: input.amountPaise,
      currency: "INR",
      mode: "UPI",
      purpose: "payout",
      fund_account: {
        account_type: "vpa",
        vpa: { address: input.payoutUpiId },
        contact: {
          name: input.partnerName.slice(0, 50),
          email: input.partnerEmail || undefined,
          contact: input.partnerPhone || undefined,
          type: "vendor",
          reference_id: input.partnerId.slice(0, 40),
        },
      },
      queue_if_low_balance: true,
      reference_id: `pickolo_${input.bookingCode}`.slice(0, 40),
      narration: "Pickolo partner payout",
      notes: { booking_id: input.bookingId, partner_id: input.partnerId },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) {
    const detail =
      typeof payload?.error?.description === "string"
        ? payload.error.description
        : "RazorpayX payout request failed.";
    throw new Error(detail);
  }

  return payoutResult(payload);
}

function payoutResult(payload: Record<string, unknown>): RazorpayXPayoutResult {
  if (
    typeof payload.id !== "string" ||
    !/^pout_[a-zA-Z0-9]+$/.test(payload.id) ||
    typeof payload.status !== "string" ||
    typeof payload.amount !== "number" ||
    !Number.isSafeInteger(payload.amount)
  )
    throw new Error("Invalid provider response.");
  return {
    id: payload.id,
    status: payload.status,
    amount: payload.amount,
    currency: String(payload.currency),
    referenceId: String(payload.reference_id),
  };
}

// Operator-initiated reconciliation, not a recurring poll. Webhooks remain a
// separate deployment requirement for unattended settlement/reversal handling.
export async function fetchRazorpayXPayout(
  id: string,
): Promise<RazorpayXPayoutResult> {
  if (!/^pout_[a-zA-Z0-9]+$/.test(id) || !razorpayXPayoutsEnabled())
    throw new Error("Invalid payout configuration.");
  const credentials = Buffer.from(
    process.env.RAZORPAYX_KEY_ID + ":" + process.env.RAZORPAYX_KEY_SECRET,
  ).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/payouts/" + id, {
    headers: { Authorization: "Basic " + credentials },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Provider reconciliation unavailable.");
  return payoutResult(await response.json());
}
