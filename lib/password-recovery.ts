import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from "@/lib/supabase-config";

export function createRecoveryClient() {
  // Use the same public project configuration as this release's sign-in.
  const url = SUPABASE_URL;
  const key = SUPABASE_PUBLIC_KEY;
  return url && key
    ? createClient(url, key, {
        global: {
          fetch: (input, init) =>
            fetch(input, {
              ...init,
              signal: init?.signal
                ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)])
                : AbortSignal.timeout(20000),
            }),
        },
        auth: {
          storageKey: "pickolo-password-recovery",
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: "implicit",
        },
      })
    : null;
}
