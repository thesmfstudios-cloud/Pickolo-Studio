import { paymentAdmin, paymentFailure, paymentJson } from "@/lib/payment-test";

// Test-only rollout. Restore only after durable payout intents/settlement
// reconciliation are deployed and the owner explicitly enables live payouts.
export async function POST(request: Request) {
  try {
    await paymentAdmin(request);
    return paymentJson(
      {
        error:
          "Live partner payouts are paused during payment testing. No money moved and no booking was marked paid. Use Admin → Payment test.",
      },
      503,
    );
  } catch (error) {
    return paymentFailure(error);
  }
}
