export function recoveryRedirect(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  // Keep credentials in the fragment, never in requests to the Next.js server.
  if (
    params.get("type") === "recovery" ||
    params.get("error_code") === "otp_expired"
  ) {
    return "/reset-password" + hash;
  }
  return null;
}
