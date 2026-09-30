import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./supabase-config";

const url = SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getServiceClient() {
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role configuration is not available.");
  }
  if (serviceRoleKey.startsWith("eyJ")) {
    const claims = JSON.parse(
      Buffer.from(serviceRoleKey.split(".")[1], "base64url").toString(),
    );
    if (claims.ref !== "ywlayixocyjwodhfcyus" || claims.role !== "service_role")
      throw new Error(
        "Pickolo payment service needs the server key for the current Supabase project. Please contact support.",
      );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
