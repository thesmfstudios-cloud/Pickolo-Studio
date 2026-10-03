import {
  paymentAdmin,
  paymentFailure,
  paymentJson,
  paymentTestReadiness,
  runPaymentTest,
  PaymentTestError,
} from "@/lib/payment-test";

export async function GET(request: Request) {
  try {
    await paymentAdmin(request);
    return paymentJson(paymentTestReadiness());
  } catch (error) {
    return paymentFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await paymentAdmin(request);
    const text = await request.text();
    if (text.length > 4096)
      throw new PaymentTestError("Test request is too large.", 413);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new PaymentTestError("Invalid test request.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new PaymentTestError("Invalid test request.");
    return paymentJson(await runPaymentTest(actor, body));
  } catch (error) {
    return paymentFailure(error);
  }
}
