import { paymentAdmin, paymentFailure, paymentJson } from "@/lib/payment-test";

// Fail closed throughout the test-only phase, regardless of legacy provider keys.
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
