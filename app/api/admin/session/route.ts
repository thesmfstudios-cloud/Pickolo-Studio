import { adminAccess, adminFailure, adminJson } from "@/lib/admin-access";
import { razorpayXPayoutsEnabled } from "@/lib/razorpayx";
export async function GET(request: Request) {
  try {
    const { user, profile, client } = await adminAccess(request);
    // Empty arguments probe a read-only RPC; absence is a setup blocker, not a fake healthy state.
    const readiness = await client.rpc("admin_operations_readiness");
    return adminJson({
      operator: {
        name: profile.full_name || "Pickolo operator",
        email: user.email,
      },
      payoutsEnabled: razorpayXPayoutsEnabled(),
      safetyReady:
        !readiness.error &&
        readiness.data?.adminReady === true &&
        readiness.data?.approvalDocumentGate === true &&
        readiness.data?.providerConfirmedPayouts === true,
      readiness: readiness.error ? null : readiness.data,
    });
  } catch (error) {
    return adminFailure(error);
  }
}
