import {
  adminAccess,
  adminBody,
  adminFailure,
  adminJson,
  AdminError,
  requireUuid,
  rpcFailure,
} from "@/lib/admin-access";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user, client } = await adminAccess(request);
    const id = requireUuid((await context.params).id),
      body = await adminBody(request);
    if (!["approve", "reject", "suspend"].includes(String(body.action)))
      throw new AdminError("Choose a valid review action.");
    const result = await client.rpc("admin_review_application", {
      p_actor: user.id,
      p_id: id,
      p_action: body.action,
      p_expected: body.expected_status,
      p_reason:
        typeof body.rejection_reason === "string"
          ? body.rejection_reason.trim()
          : "",
    });
    if (result.error) rpcFailure(result.error);
    return adminJson({ application: result.data });
  } catch (error) {
    return adminFailure(error);
  }
}
