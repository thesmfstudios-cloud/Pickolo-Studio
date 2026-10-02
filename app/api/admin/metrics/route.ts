import {
  adminAccess,
  adminFailure,
  adminJson,
  rpcFailure,
} from "@/lib/admin-access";
export async function GET(request: Request) {
  try {
    const { client } = await adminAccess(request);
    const result = await client.rpc("admin_operations_metrics");
    if (result.error) rpcFailure(result.error);
    return adminJson(result.data);
  } catch (error) {
    return adminFailure(error);
  }
}
