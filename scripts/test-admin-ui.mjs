import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { create, act } from "react-test-renderer";

// Render real admin components and exercise their controls. Only auth, browser
// APIs and HTTP are mocked. This is not live browser-to-Supabase verification.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = process.cwd(),
  require = createRequire(path.join(root, "package.json"));
const originalError = console.error;
console.error = (...args) => {
  if (String(args[0]).includes("react-test-renderer is deprecated")) return;
  originalError(...args);
};
let renderer,
  authCallback,
  passed = 0,
  state;
const operator = {
  operator: { name: "Test operator", email: "operator@test.invalid" },
  payoutsEnabled: false,
  safetyReady: true,
  readiness: { deliveryReady: true },
};
const metrics = {
  bookings: {
    total: 8,
    paid: 5,
    active: 3,
    completed: 2,
    cancelled: 1,
    completionRate: 0.25,
  },
  money: {
    gmvPaise: 120000,
    platformRevenuePaise: 25000,
    partnerPayoutsPaise: 80000,
    payoutsReleasedPaise: 50000,
  },
  queues: {
    applications: 2,
    documents: 2,
    support: 1,
    searching: 1,
    payoutReady: 1,
  },
  generatedAt: "2026-10-02T16:00:00Z",
};
const id = "11111111-1111-4111-8111-111111111111";
const application = {
  id,
  display_name: "Phone creator",
  status: "pending",
  skills: ["Photography", "Equipment: Phone"],
  payout_upi_id: "creator@upi",
};
const document = {
  id: "22222222-2222-4222-8222-222222222222",
  status: "pending",
  document_type: "identity",
  file_name: "identity.jpg",
};
const booking = {
  id,
  booking_code: "PKL-TEST",
  status: "DATA_SUBMITTED",
  customer_price_paise: 60000,
  partner_payout_paise: 42000,
};
const rows = {
  applications: [application],
  documents: [document],
  bookings: [booking],
  partners: [
    {
      id,
      partner_code: "PKL-TEST",
      verification_status: "approved",
      profile: { full_name: "Phone creator" },
    },
  ],
  support: [
    {
      id,
      status: "open",
      reason_code: "quality",
      description: "Please review delivery",
    },
  ],
  pricing: [
    {
      id,
      amount_paise: 60000,
      platform_fee_bps: 2500,
      duration_minutes: 60,
      updated_at: "2026-10-02T16:00:00Z",
      service_level: { name: "Standard" },
    },
  ],
  activity: [{ id, action: "APPROVE", entity_type: "partner_application" }],
  payouts: [
    {
      id,
      booking_id: id,
      status: "queued",
      amount_paise: 42000,
      provider_payout_id: "pout_Test",
    },
  ],
};
const supabase = {
  auth: {
    async getSession() {
      return {
        data: {
          session: state.hasSession ? { access_token: "test-token" } : null,
        },
        error: null,
      };
    },
    onAuthStateChange(callback) {
      authCallback = callback;
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signOut() {
      state.signOut++;
      return { error: state.signOutError ? new Error("offline") : null };
    },
    async signInWithPassword(input) {
      state.signIns.push(input);
      if (state.signInWait) await state.signInWait;
      return {
        data: { session: { access_token: "test-token" } },
        error: state.signInError ? new Error("invalid") : null,
      };
    },
  },
};
globalThis.document = {
  activeElement: {
    focus() {
      state.focusReturned++;
    },
  },
};
globalThis.window = {
  location: {
    assign(url) {
      state.navigation.push(url);
    },
  },
  open() {
    if (state.popupBlocked) return null;
    const preview = {
      opener: {},
      location: { href: "" },
      close() {
        state.previewClosed++;
      },
    };
    state.previews.push(preview);
    return preview;
  },
};
globalThis.fetch = async (url, options = {}) => {
  const parsed = new URL(url, "https://local.test.invalid");
  state.requests.push({ url: String(url), options });
  if (options.method && options.method !== "GET") {
    state.mutations.push({
      path: parsed.pathname,
      body: options.body ? JSON.parse(options.body) : null,
    });
    if (state.mutationWait) await state.mutationWait;
    return Response.json(
      state.mutationError
        ? { error: "Changed concurrently. Refresh first." }
        : { message: "Saved safely." },
      { status: state.mutationError ? 409 : 200 },
    );
  }
  if (state.revoked)
    return Response.json({ error: "revoked" }, { status: 403 });
  if (parsed.pathname.endsWith("/session"))
    return Response.json(
      { ...operator, ...state.operator },
      { status: state.sessionStatus || 200 },
    );
  if (parsed.pathname.endsWith("/metrics")) {
    if (state.metricsWait) await state.metricsWait;
    return Response.json(
      state.badMetrics ? { ...metrics, money: {} } : metrics,
      { status: state.metricsError ? 503 : 200 },
    );
  }
  if (parsed.pathname.endsWith("/booking"))
    return Response.json({
      booking,
      customer: { full_name: "Test customer", phone: "9000000000" },
      partner: { full_name: "Test creator" },
      history: [
        { id, to_status: "DATA_SUBMITTED", created_at: "2026-10-02T16:00:00Z" },
      ],
      assets: [{ ...document, file_name: "shoot-backup.jpg" }],
      disputes: [],
      payouts: [],
      delivery: [],
      limit: 100,
    });
  if (parsed.pathname.endsWith("/asset-link"))
    return Response.json({
      url: "https://storage.test.invalid/private/backup",
      expiresInSeconds: 300,
    });
  if (parsed.pathname.endsWith("/document-link"))
    return Response.json({
      url: state.invalidPreview
        ? "http://unsafe.test.invalid"
        : "https://storage.test.invalid/private/document",
      expiresInSeconds: 300,
    });
  if (parsed.pathname.endsWith("/review"))
    return Response.json({
      application: state.reviewApplication || application,
      eligibility: state.eligibility,
      documents: state.documents ?? [document],
    });
  if (parsed.pathname.endsWith("/queue")) {
    if (state.queueError) throw new Error("Connection offline");
    const kind = parsed.searchParams.get("kind");
    return Response.json({
      records: state.rows?.[kind] ?? rows[kind] ?? [],
      total: state.total ?? 1,
      pageSize: 20,
    });
  }
  throw new Error("Unexpected test request " + url);
};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const local = (name) =>
    name === "next/link"
      ? {
          __esModule: true,
          default: ({ children, ...props }) =>
            React.createElement("a", props, children),
        }
      : name === "@/lib/supabase"
        ? { supabase }
        : name.startsWith("@/")
          ? load(path.join(root, name.slice(2) + ".ts"))
          : name.startsWith("./")
            ? load(path.join(path.dirname(file), name + ".tsx"))
            : require(name);
  new Function("require", "module", "exports", code)(
    local,
    module,
    module.exports,
  );
  return module.exports;
}
const Page = load("app/admin/page.tsx").default,
  Login = load("app/admin/login/page.tsx").default;
const textOf = (node) =>
  typeof node === "string" ? node : node?.children?.map(textOf).join("") || "";
const button = (label) =>
  renderer.root.findAllByType("button").find((n) => textOf(n) === label);
const input = (id) =>
  renderer.root.findAll((n) => n.type === "input" && n.props.id === id)[0];
async function tick(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}
async function click(label) {
  const node = button(label);
  assert(node, "Missing button " + label);
  assert(!node.props.disabled, "Disabled button " + label);
  await act(async () => {
    await node.props.onClick();
  });
  await tick();
}
async function mount(component = Page) {
  await act(async () => {
    renderer = create(React.createElement(component), {
      createNodeMock: (node) =>
        node.type === "dialog"
          ? {
              showModal() {
                state.dialogs++;
              },
              close() {
                state.dialogs--;
              },
            }
          : null,
    });
  });
  await tick();
}
async function navigate(label) {
  await click(label);
}
async function confirm() {
  await act(async () => {
    renderer.root
      .findAllByType("input")
      .find((n) => n.props.type === "checkbox")
      .props.onChange({ target: { checked: true } });
  });
}
async function submit() {
  await act(async () => {
    await renderer.root
      .findByType("form")
      .props.onSubmit({ preventDefault() {} });
  });
  await tick();
}
async function test(name, run) {
  state = {
    hasSession: true,
    requests: [],
    mutations: [],
    signIns: [],
    signOut: 0,
    navigation: [],
    previews: [],
    previewClosed: 0,
    focusReturned: 0,
    dialogs: 0,
  };
  try {
    await run();
    passed++;
    console.log("PASS " + name);
  } finally {
    if (renderer) {
      await act(async () => renderer.unmount());
      renderer = null;
    }
  }
}
await test("server-verified operator sees real overview metrics and every navigation tab", async () => {
  await mount();
  assert(
    renderer.root.findAllByType("nav")[0].props["aria-label"] === "Operations",
  );
  for (const label of [
    "Overview",
    "Bookings",
    "Applications",
    "Partners",
    "Documents",
    "Payouts",
    "Support",
    "Pricing",
    "Activity log",
  ])
    assert(button(label));
  assert(textOf(renderer.toJSON()).includes("Processed payouts"));
  assert(
    state.requests.every(
      (r) => r.options.headers.Authorization === "Bearer test-token",
    ),
  );
});
await test("all eight queues load independently with server pagination parameters", async () => {
  await mount();
  for (const [label, kind] of [
    ["Bookings", "bookings"],
    ["Applications", "applications"],
    ["Partners", "partners"],
    ["Documents", "documents"],
    ["Payouts", "payouts"],
    ["Support", "support"],
    ["Pricing", "pricing"],
    ["Activity log", "activity"],
  ]) {
    await navigate(label);
    assert(state.requests.some((r) => r.url.includes("kind=" + kind)));
    assert(textOf(renderer.toJSON()).includes("Page 1 of"));
  }
});
await test("status filtering and next page request exact server-side page", async () => {
  state.total = 45;
  await mount();
  await navigate("Applications");
  await act(async () =>
    renderer.root
      .findByType("select")
      .props.onChange({ target: { value: "pending" } }),
  );
  await tick();
  await click("Next →");
  assert(state.requests.at(-1).url.includes("page=2"));
  assert(state.requests.at(-1).url.includes("status=pending"));
});
await test("search debounces and resets to page one", async () => {
  state.total = 45;
  await mount();
  await navigate("Applications");
  await click("Next →");
  const search = renderer.root
    .findAllByType("input")
    .find((n) => n.props["aria-label"] === "Search name or phone");
  await act(async () =>
    search.props.onChange({ target: { value: "Test creator" } }),
  );
  await tick(350);
  assert(state.requests.at(-1).url.includes("page=1"));
  assert(state.requests.at(-1).url.includes("Test+creator"));
});
await test("empty filtered queue has helpful empty state, not an error", async () => {
  state.rows = { applications: [] };
  state.total = 0;
  await mount();
  await navigate("Applications");
  assert(textOf(renderer.toJSON()).includes("Your queue is clear"));
  assert(button("Next →").props.disabled);
});
await test("unavailable metrics never become zero-success cards and can retry", async () => {
  state.badMetrics = true;
  await mount();
  assert(textOf(renderer.toJSON()).includes("Metrics are unavailable"));
  assert(!textOf(renderer.toJSON()).includes("Completion rate: 0%"));
  state.badMetrics = false;
  await click("Retry this screen");
  assert(textOf(renderer.toJSON()).includes("Completion rate: 25%"));
});
await test("queue network error is actionable and retry restores rows", async () => {
  await mount();
  state.queueError = true;
  await navigate("Applications");
  assert(textOf(renderer.toJSON()).includes("Connection offline"));
  assert(!button("Review application"));
  state.queueError = false;
  await click("Retry this screen");
  assert(button("Review application"));
});
await test("missing database rollout disables mutations without hiding read-only queues", async () => {
  state.operator = { safetyReady: false };
  await mount();
  await navigate("Documents");
  assert(textOf(renderer.toJSON()).includes("Database setup pending"));
  assert(button("Approve").props.disabled);
  assert(!button("View file").props.disabled);
});
await test("disabled payout provider cannot initiate money transfers", async () => {
  await mount();
  await navigate("Bookings");
  assert(button("Request payout").props.disabled);
  assert.equal(state.mutations.length, 0);
});
await test("stale provider-enabled session cannot bypass the test-only policy", async () => {
  state.operator = { payoutsEnabled: true };
  await mount();
  await navigate("Bookings");
  assert(button("Request payout").props.disabled);
  assert(textOf(renderer.toJSON()).includes("Live payouts are paused"));
  const testLink = renderer.root
    .findAllByType("a")
    .find((a) => a.props.href === "/admin/payment-test");
  assert(
    testLink,
    "sandbox remains accessible independently of payout readiness",
  );
  assert.equal(state.mutations.length, 0);
});
await test("identity not approved keeps partner approval disabled, without extra equipment demand", async () => {
  await mount();
  await navigate("Applications");
  await click("Review application");
  assert(button("Approve partner").props.disabled);
  assert(textOf(renderer.toJSON()).includes("manual identity check"));
});
await test("approved identity unlocks deliberate partner decision", async () => {
  state.documents = [{ ...document, status: "approved" }];
  await mount();
  await navigate("Applications");
  await click("Review application");
  await click("Approve partner");
  assert(button("Confirm action").props.disabled);
  await confirm();
  await submit();
  assert.equal(state.mutations[0].body.expected_status, "pending");
  assert.equal(state.mutations[0].body.action, "approve");
});
await test("failed correction keeps reason text and expected status for a useful retry", async () => {
  state.mutationError = true;
  await mount();
  await navigate("Applications");
  await click("Review application");
  await click("Request corrections");
  await confirm();
  assert(button("Confirm action").props.disabled);
  await act(async () =>
    renderer.root.findByType("textarea").props.onChange({
      target: { value: "Please send a readable identity photo." },
    }),
  );
  await submit();
  assert.equal(
    renderer.root.findByType("textarea").props.value,
    "Please send a readable identity photo.",
  );
  assert(textOf(renderer.toJSON()).includes("Changed concurrently"));
  assert.equal(state.mutations[0].body.expected_status, "pending");
});
await test("double submission creates one mutation and blocks modal closing while pending", async () => {
  let release;
  state.mutationWait = new Promise((resolve) => (release = resolve));
  await mount();
  await navigate("Documents");
  await click("Approve");
  await confirm();
  let first;
  await act(async () => {
    const handler = renderer.root.findByType("form").props.onSubmit;
    first = handler({ preventDefault() {} });
    await handler({ preventDefault() {} });
  });
  await tick();
  assert.equal(state.mutations.length, 1);
  assert(
    renderer.root
      .findAllByType("button")
      .find((n) => n.props["aria-label"] === "Close dialog").props.disabled,
  );
  await act(async () => {
    release();
    await first;
  });
});
await test("pricing edit is controlled and zero platform fee remains valid", async () => {
  await mount();
  await navigate("Pricing");
  await click("Edit pricing");
  await act(async () =>
    input("fee").props.onChange({ target: { value: "0" } }),
  );
  assert.equal(state.mutations.length, 0);
  await confirm();
  await submit();
  assert.equal(state.mutations[0].body.platform_fee_bps, 0);
  assert.equal(state.mutations[0].body.amount_paise, 60000);
  assert.equal(
    state.mutations[0].body.expected_updated_at,
    "2026-10-02T16:00:00Z",
  );
});
await test("private preview uses isolated opener and a fresh HTTPS link", async () => {
  await mount();
  await navigate("Documents");
  await click("View file");
  assert.equal(state.previews[0].opener, null);
  assert.equal(
    state.previews[0].location.href,
    "https://storage.test.invalid/private/document",
  );
});
await test("blocked popup and unsafe preview link show a clear warning", async () => {
  state.popupBlocked = true;
  await mount();
  await navigate("Documents");
  await click("View file");
  assert(textOf(renderer.toJSON()).includes("Allow popups"));
  state.popupBlocked = false;
  state.invalidPreview = true;
  await click("View file");
  assert.equal(state.previewClosed, 1);
  assert(textOf(renderer.toJSON()).includes("Invalid preview link"));
});
await test("revoked operator access clears sensitive queues and decisions", async () => {
  await mount();
  await navigate("Applications");
  state.revoked = true;
  await click("Refresh");
  assert(!button("Review application"));
  assert(textOf(renderer.toJSON()).includes("Operator access"));
});
await test("signed-out event clears workspace and returns to operator login", async () => {
  await mount();
  await navigate("Applications");
  await act(async () => authCallback("SIGNED_OUT"));
  assert(!button("Review application"));
  assert(state.navigation.includes("/admin/login"));
});
await test("non-admin login signs out instead of navigating into the workspace", async () => {
  state.sessionStatus = 403;
  await mount(Login);
  await act(async () => {
    input("admin-email").props.onChange({
      target: { value: "test@test.invalid" },
    });
    input("admin-password").props.onChange({
      target: { value: "test-only-password" },
    });
  });
  await submit();
  assert.equal(state.signOut, 1);
  assert.equal(input("admin-password").props.value, "");
  assert.equal(state.navigation.length, 0);
  assert(textOf(renderer.toJSON()).includes("not an authorized operator"));
});
await test("login blocks duplicate sign-in and clears password on success", async () => {
  let release;
  state.signInWait = new Promise((resolve) => (release = resolve));
  await mount(Login);
  await act(async () => {
    input("admin-email").props.onChange({
      target: { value: "test@test.invalid" },
    });
    input("admin-password").props.onChange({
      target: { value: "test-only-password" },
    });
  });
  let first;
  await act(async () => {
    const handler = renderer.root.findByType("form").props.onSubmit;
    first = handler({ preventDefault() {} });
    await handler({ preventDefault() {} });
  });
  assert.equal(state.signIns.length, 1);
  await act(async () => {
    release();
    await first;
  });
  assert(state.navigation.includes("/admin"));
  assert.equal(input("admin-password").props.value, "");
});
await test("booking dossier exposes recorded timeline and opens backup only on demand", async () => {
  await mount();
  await navigate("Bookings");
  await click("Details");
  assert(textOf(renderer.toJSON()).includes("Lifecycle timeline"));
  assert(textOf(renderer.toJSON()).includes("Test customer"));
  assert.equal(state.previews.length, 0);
  await click("Open private backup");
  assert(state.requests.at(-1).url.includes("/asset-link?id="));
  assert.equal(
    state.previews[0].location.href,
    "https://storage.test.invalid/private/backup",
  );
});
await test("approved partner job services need explicit operator confirmation", async () => {
  state.reviewApplication = { ...application, status: "approved" };
  state.eligibility = {
    partner: { id, service_level_id: id, verification_status: "approved" },
    services: [
      { id: "photo", name: "Photography" },
      { id: "video", name: "Videography" },
    ],
    levels: [{ id, name: "Standard" }],
    selected: [],
  };
  await mount();
  await navigate("Applications");
  await click("Review application");
  assert(button("Save job eligibility").props.disabled);
  const checks = renderer.root
    .findAllByType("input")
    .filter((n) => n.props.type === "checkbox");
  assert(checks[0].props.checked && checks[0].props.disabled);
  await act(async () => {
    checks[1].props.onChange({ target: { checked: true } });
    checks[2].props.onChange({ target: { checked: true } });
  });
  await submit();
  assert.equal(state.mutations[0].path, "/api/admin/partner-eligibility");
  assert.deepEqual(state.mutations[0].body.service_ids, ["photo", "video"]);
  assert.deepEqual(state.mutations[0].body.expected_service_ids, []);
});
console.error = originalError;
console.log(
  "\n" +
    passed +
    " admin component interaction scenarios passed. HTTP/auth/browser APIs mocked.",
);
