import { router } from "expo-router";
import { supabase } from "../../shared/supabase";
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL || "https://pickolo-studio.vercel.app";
export async function api(path: string, body?: unknown) {
  const { data } = await supabase!.auth.getSession();
  if (!data.session) {
    router.replace("/auth");
    throw new Error("Please sign in again.");
  }
  const r = await fetch(API_BASE + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Bearer " + data.session.access_token,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(result.error || "Please check your connection and retry.");
  return result;
}
