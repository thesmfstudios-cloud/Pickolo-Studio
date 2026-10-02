import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
const cli = process.argv[2];
const output = process.argv[3];
if (!cli || !output)
  throw Error("Pass the installed browser CLI and existing output directory.");
const session = "pickolo-recovery-local";
function command(...args) {
  const r = spawnSync(
    process.execPath,
    [
      cli,
      "--session",
      session,
      "--init-script",
      path.resolve("scripts/recovery-browser-fixture.js"),
      ...args,
    ],
    { encoding: "utf8", timeout: 30000, windowsHide: true },
  );
  if (r.status !== 0) throw Error(r.stderr || r.stdout || "Browser failed");
  return r.stdout.trim();
}
// Run only with dummy NEXT_PUBLIC_SUPABASE_URL=https://recovery-test.invalid.
// No actual users, email, credentials or remote Auth mutations.
try {
  command("open", "http://localhost:3101/reset-password");
  assert.match(command("snapshot", "-i"), /Account email/);
  console.log("PASS recovery request form loads");
  console.log(command("a11y", "--tags", "wcag2a,wcag2aa,wcag21a,wcag21aa"));
  command("set", "viewport", "390", "844");
  command(
    "screenshot",
    path.join(output, "Pickolo-Password-Recovery-Mobile.png"),
    "--full",
  );
  const payload = Buffer.from(
    JSON.stringify({
      sub: "11111111-1111-4111-8111-111111111111",
      exp: 4102444800,
    }),
  ).toString("base64url");
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.${Buffer.from("demo").toString("base64url")}`;
  command(
    "open",
    "http://localhost:3101/#type=recovery&access_token=" +
      token +
      "&refresh_token=demo-only-refresh",
  );
  command("wait", "#recovery-password");
  assert.match(command("get", "url"), /\/reset-password$/);
  assert.match(command("snapshot", "-i"), /Confirm new password/);
  const reads = command(
    "eval",
    "JSON.stringify(window.__recoveryDemoRequests)",
  );
  assert.match(reads, /auth\/v1\/user/);
  console.log(
    "PASS homepage recovery bridge, isolated mocked Auth verification and URL credential scrubbing",
  );
  console.log(command("a11y", "--tags", "wcag2a,wcag2aa,wcag21a,wcag21aa"));
  command(
    "screenshot",
    path.join(output, "Pickolo-New-Password-Mobile.png"),
    "--full",
  );
  command(
    "open",
    "http://localhost:3101/#error=access_denied&error_code=otp_expired",
  );
  command("wait", "#recovery-email");
  assert.match(command("get", "text", "body"), /expired or incomplete/);
  console.log("PASS expired link returns to actionable email recovery form");
  const errors = command("errors");
  assert.equal(errors, "", errors);
  console.log(
    "PASS no uncaught browser errors; only dummy transport used, password entry not automated",
  );
} catch (error) {
  console.log(command("snapshot"));
  console.log(command("errors"));
  console.log(command("network", "requests"));
  throw error;
} finally {
  command("close");
}
