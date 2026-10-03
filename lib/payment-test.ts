import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export class PaymentTestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const paymentJson = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
export function paymentFailure(error: unknown) {
  return paymentJson(
    {
      error:
        error instanceof PaymentTestError
          ? error.message
          : "Payment test unavailable. No business records were changed.",
    },
    error instanceof PaymentTestError ? error.status : 500,
  );
}
export async function paymentAdmin(request: Request) {
  const token = /^Bearer\s+(\S+)$/i.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (!token) throw new PaymentTestError("Please sign in as an admin.", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey)
    throw new PaymentTestError("Admin connection is not configured.", 503);
  const client = createClient(url, publicKey, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user)
    throw new PaymentTestError("Admin session expired. Sign in again.", 401);
  const profile = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile.error || profile.data?.role !== "admin")
    throw new PaymentTestError("Admin access required.", 403);
  return user.id;
}
type Kind = "payment" | "payout";
function config(kind: Kind) {
  const prefix = kind === "payment" ? "RAZORPAY_TEST" : "RAZORPAYX_TEST";
  const keyId = process.env[prefix + "_KEY_ID"] ?? "";
  const secret = process.env[prefix + "_KEY_SECRET"] ?? "";
  const account = process.env.RAZORPAYX_TEST_ACCOUNT_NUMBER ?? "";
  // No fallback to production variables, even if they contain test keys.
  if (
    process.env.PAYMENT_TEST_ENABLED !== "true" ||
    !/^rzp_test_[a-zA-Z0-9]+$/.test(keyId) ||
    !secret ||
    (kind === "payout" && !account)
  )
    throw new PaymentTestError(
      "Separate " +
        (kind === "payment" ? "Razorpay" : "RazorpayX") +
        " test credentials are not configured. Live keys are never used here.",
      503,
    );
  return { keyId, secret, account };
}
export function paymentTestReadiness() {
  const ready = (kind: Kind) => {
    try {
      config(kind);
      return true;
    } catch {
      return false;
    }
  };
  return {
    mode: "test",
    paymentReady: ready("payment"),
    payoutReady: ready("payout"),
    livePayoutsEnabled: false,
    businessRecordsChanged: false,
  };
}
type Ticket = {
  kind: Kind;
  actor: string;
  id: string;
  expires: number;
  provider?: string;
};
function sign(ticket: Ticket) {
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", config(ticket.kind).secret)
      .update(payload)
      .digest("hex")
  );
}
function ticket(raw: unknown, kind: Kind, actor: string): Ticket {
  if (typeof raw !== "string" || raw.length > 1200)
    throw new PaymentTestError("Invalid test session.");
  const [payload, signature, extra] = raw.split(".");
  const expected = createHmac("sha256", config(kind).secret)
    .update(payload)
    .digest("hex");
  if (
    extra ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    throw new PaymentTestError("Invalid test session.");
  let data: Ticket;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    throw new PaymentTestError("Invalid test session.");
  }
  if (
    data.kind !== kind ||
    data.actor !== actor ||
    !Number.isFinite(data.expires) ||
    data.expires < Date.now() ||
    !/^[0-9a-f-]{36}$/.test(data.id)
  )
    throw new PaymentTestError(
      "Test session expired or belongs to another admin. Start a new test.",
      409,
    );
  return data;
}
async function provider(
  kind: Kind,
  path: string,
  body?: unknown,
  idempotency?: string,
) {
  const { keyId, secret } = config(kind);
  let response: Response;
  try {
    response = await fetch("https://api.razorpay.com/v1/" + path, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization:
          "Basic " + Buffer.from(keyId + ":" + secret).toString("base64"),
        "Content-Type": "application/json",
        ...(idempotency ? { "X-Payout-Idempotency": idempotency } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new PaymentTestError(
      "Test provider did not respond. The test request may have reached it. For payouts, retry the same test session; do not start another transfer.",
      502,
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== "object")
    throw new PaymentTestError(
      "Razorpay rejected the sandbox request. Check test keys, test balance and provider permissions. No real money moved.",
      502,
    );
  return result;
}
export async function runPaymentTest(
  actor: string,
  body: Record<string, unknown>,
) {
  const kind = body.kind;
  if (kind !== "payment" && kind !== "payout")
    throw new PaymentTestError("Choose a payment or payout test.");
  config(kind);
  if (body.action === "prepare") {
    const data: Ticket = {
      kind,
      actor,
      id: randomUUID(),
      expires: Date.now() + 86400000,
    };
    return {
      mode: "test",
      ticket: sign(data),
      amountPaise: 100,
      message: "₹1 sandbox test prepared. No real money or booking changes.",
    };
  }
  const data = ticket(body.ticket, kind, actor);
  const reference = "pickolo_test_" + data.id.replaceAll("-", "").slice(0, 24);
  if (kind === "payment" && body.action === "create") {
    const result = await provider(kind, "orders", {
      amount: 100,
      currency: "INR",
      receipt: reference,
      notes: { purpose: "pickolo_admin_sandbox", test_session: data.id },
    });
    if (
      !/^order_[a-zA-Z0-9]+$/.test(result.id) ||
      result.amount !== 100 ||
      result.currency !== "INR" ||
      result.receipt !== reference
    )
      throw new PaymentTestError("Unexpected sandbox order response.", 502);
    return {
      mode: "test",
      keyId: config(kind).keyId,
      orderId: result.id,
      amountPaise: 100,
      ticket: sign({ ...data, provider: result.id }),
    };
  }
  if (kind === "payment" && body.action === "verify") {
    if (
      !data.provider ||
      !/^order_[a-zA-Z0-9]+$/.test(data.provider) ||
      typeof body.paymentId !== "string" ||
      !/^pay_[a-zA-Z0-9]+$/.test(body.paymentId) ||
      typeof body.signature !== "string"
    )
      throw new PaymentTestError("Invalid checkout response.");
    const expected = createHmac("sha256", config(kind).secret)
      .update(data.provider + "|" + body.paymentId)
      .digest("hex");
    if (
      !/^[a-f0-9]{64}$/.test(body.signature) ||
      !timingSafeEqual(Buffer.from(body.signature), Buffer.from(expected))
    )
      throw new PaymentTestError("Checkout signature could not be verified.");
    const result = await provider(kind, "payments/" + body.paymentId);
    if (
      result.id !== body.paymentId ||
      result.order_id !== data.provider ||
      result.amount !== 100 ||
      result.currency !== "INR"
    )
      throw new PaymentTestError(
        "Test payment does not match this order.",
        409,
      );
    return {
      mode: "test",
      status: result.status,
      paid: result.status === "captured",
      message:
        result.status === "captured"
          ? "Sandbox payment captured. No booking or earnings changed."
          : "Sandbox payment is not captured yet. No booking or earnings changed.",
    };
  }
  if (
    kind === "payout" &&
    (body.action === "create" || body.action === "reconcile")
  ) {
    if (body.action === "reconcile" && !data.provider)
      throw new PaymentTestError(
        "No payout reference yet. Retry this same prepared session to recover the provider reference.",
        409,
      );
    const result = data.provider
      ? await provider(kind, "payouts/" + data.provider)
      : await provider(
          kind,
          "payouts",
          {
            account_number: config(kind).account,
            amount: 100,
            currency: "INR",
            mode: "UPI",
            purpose: "payout",
            fund_account: {
              account_type: "vpa",
              vpa: { address: "pickolo-test@upi" },
              contact: {
                name: "Pickolo Sandbox Partner",
                type: "vendor",
                reference_id: data.id,
              },
            },
            queue_if_low_balance: true,
            reference_id: reference,
            narration: "Pickolo sandbox only",
            notes: { purpose: "pickolo_admin_sandbox" },
          },
          data.id,
        );
    if (
      !/^pout_[a-zA-Z0-9]+$/.test(result.id) ||
      result.amount !== 100 ||
      result.currency !== "INR" ||
      result.reference_id !== reference ||
      typeof result.status !== "string" ||
      (data.provider && result.id !== data.provider)
    )
      throw new PaymentTestError(
        "Unexpected sandbox payout response. Keep the test session and contact support.",
        502,
      );
    return {
      mode: "test",
      payoutId: result.id,
      ticket: sign({ ...data, provider: result.id }),
      status: result.status,
      paid: result.status === "processed",
      message:
        result.status === "processed"
          ? "Sandbox payout processed. No actual partner was paid."
          : "Sandbox payout " +
            result.status +
            ". Not paid; change its state in RazorpayX Test Mode, then check again.",
    };
  }
  throw new PaymentTestError("Unknown test action.");
}
