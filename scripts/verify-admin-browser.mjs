import { spawnSync } from "node:child_process";
const cli = process.argv[2];
if (!cli) throw new Error("Pass the installed agent-browser CLI path.");
const session = "pickolo-admin-local";
function command(...args) {
  const r = spawnSync(process.execPath, [cli, "--session", session, ...args], {
    encoding: "utf8",
    timeout: 30000,
    windowsHide: true,
  });
  if (r.status !== 0)
    throw new Error(r.stderr || r.stdout || "Browser command failed");
  console.log(r.stdout.trim());
  return r.stdout.trim();
}
// Only response interception in an isolated local browser. No production bypass,
// no real credentials, and no real Supabase requests.
command("open", "http://localhost:3100/admin/login");
command(
  "eval",
  "-b",
  Buffer.from(
    "localStorage.setItem('sb-admin-test-auth-token',JSON.stringify({access_token:'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJleHAiOjQxMDI0NDQ4MDB9.test',refresh_token:'test-refresh',expires_in:3600,expires_at:4102444800,token_type:'bearer',user:{id:'11111111-1111-4111-8111-111111111111',email:'operator@test.invalid',app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated'}})); 'Demo-only session ready'",
  ).toString("base64"),
);
command("network", "unroute");
const operator = {
  operator: { name: "Demo operator", email: "operator@test.invalid" },
  payoutsEnabled: false,
  safetyReady: true,
  readiness: { deliveryReady: true },
};
const metrics = {
  bookings: {
    total: 24,
    paid: 18,
    active: 7,
    completed: 11,
    cancelled: 2,
    completionRate: 11 / 24,
  },
  money: {
    gmvPaise: 4360000,
    platformRevenuePaise: 520000,
    partnerPayoutsPaise: 3060000,
    payoutsReleasedPaise: 1860000,
  },
  queues: {
    applications: 3,
    documents: 4,
    support: 2,
    searching: 1,
    payoutReady: 2,
  },
  generatedAt: "2026-10-02T17:30:00Z",
};
const records = {
  records: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      display_name: "Demo phone creator",
      phone: "9000000000",
      status: "pending",
      skills: ["Photography", "Videography", "Equipment: Phone"],
      created_at: "2026-10-02T17:00:00Z",
      payout_upi_id: "demo@upi",
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};
for (const [pattern, body] of [
  ["**/api/admin/session", operator],
  ["**/api/admin/metrics", metrics],
  ["**/api/admin/queue?*", records],
])
  command("network", "route", pattern, "--body", JSON.stringify(body));
const script =
  "fetch('/api/admin/session').then(async r=>{const data=await r.json();if(!data.operator)throw new Error('Mock missing');return {mockOperator:data.operator.name};})";
command("eval", "-b", Buffer.from(script).toString("base64"));
command("open", "http://localhost:3100/admin");
command("wait", "--text", "Good operations. Great moments.");
command("snapshot", "-i");

const path = await import("node:path");
const output = path.resolve(process.cwd(), "../../outputs");
command("set", "viewport", "1440", "1000");
command(
  "screenshot",
  path.join(output, "Pickolo-Admin-Dashboard.png"),
  "--full",
);
command("a11y", "--tags", "wcag2a,wcag2aa");
const review = {
  application: records.records[0],
  documents: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      document_type: "identity",
      file_name: "demo-id.jpg",
      mime_type: "image/jpeg",
      size_bytes: 1024,
      status: "pending",
    },
  ],
};
command(
  "network",
  "route",
  "**/api/admin/review?*",
  "--body",
  JSON.stringify(review),
);
function clickRef(label) {
  const snapshot = command("snapshot", "-i");
  const line = snapshot
    .split("\n")
    .find((row) => row.includes('button "' + label + '"'));
  const ref = line?.match(/\[ref=(e\d+)\]/)?.[1];
  if (!ref) throw new Error("Control missing: " + label);
  command("click", "@" + ref);
}
clickRef("Applications");
command("wait", "--text", "Applications queue");
command(
  "screenshot",
  path.join(output, "Pickolo-Admin-Applications.png"),
  "--full",
);
command("a11y", "--tags", "wcag2a,wcag2aa");
clickRef("Review application");
command("wait", "--text", "Partner review");
command(
  "screenshot",
  path.join(output, "Pickolo-Admin-Partner-Review.png"),
  "--full",
);
command("a11y", "--tags", "wcag2a,wcag2aa");
const modal = command("snapshot", "-i");
const close = modal
  .split("\n")
  .find((row) => row.includes('button "Close dialog"'))
  ?.match(/\[ref=(e\d+)\]/)?.[1];
if (!close) throw new Error("Dialog close missing");
command("click", "@" + close);
command("set", "viewport", "390", "844");
command("screenshot", path.join(output, "Pickolo-Admin-Mobile.png"), "--full");
command("a11y", "--tags", "wcag2a,wcag2aa");
command("errors");
