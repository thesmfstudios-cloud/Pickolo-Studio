import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";
import ts from "typescript";
import React from "react";
import { create, act } from "react-test-renderer";

// Actual handlers/helpers/UI, synthetic provider responses. Zero external IO.
const require = createRequire(import.meta.url);
const cache = new Map();
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://synthetic.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "synthetic";
let role = "admin",
  user = "synthetic-admin",
  roleError = false;
let calls = [],
  reply,
  failure = false,
  tables = [];
const client = {
  auth: {
    getUser: async () => ({
      data: { user: user ? { id: user } : null },
      error: null,
    }),
    getSession: async () => ({
      data: { session: { access_token: "synthetic-token" } },
    }),
  },
  from(name) {
    tables.push(name);
    assert.equal(name, "profiles", "no business table read or write");
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      single: async () => ({ data: { role }, error: roleError }),
    };
  },
};
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
    name === "@supabase/supabase-js"
      ? { createClient: () => client }
      : name === "@/lib/supabase-config"
        ? {
            SUPABASE_URL: "https://synthetic.invalid",
            SUPABASE_PUBLIC_KEY: "synthetic",
          }
        : name === "@/lib/supabase"
          ? { supabase: client }
          : name === "next/script"
            ? { __esModule: true, default: () => null }
            : name === "next/link"
              ? {
                  __esModule: true,
                  default: ({ children, ...props }) =>
                    React.createElement("a", props, children),
                }
              : name.endsWith(".css")
                ? {
                    __esModule: true,
                    default: new Proxy({}, { get: (_, name) => String(name) }),
                  }
                : name.startsWith("@/")
                  ? load(name.slice(2) + ".ts")
                  : require(name);
  new Function("require", "module", "exports", code)(
    local,
    module,
    module.exports,
  );
  return module.exports;
}
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  if (failure) throw new Error("synthetic timeout");
  return Response.json(
    typeof reply === "function" ? reply(url, options) : reply || {},
    { status: 200 },
  );
};
const api = load("app/api/admin/payment-test/route.ts");
const release = load("app/api/admin/payouts/[id]/release/route.ts").POST;
function request(body, auth = true) {
  return new Request("https://synthetic.invalid", {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(auth ? { Authorization: "Bearer synthetic" } : {}),
      "Content-Type": "application/json",
    },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}
async function post(body) {
  const res = await api.POST(request(body));
  return { status: res.status, body: await res.json() };
}
async function prepare(kind) {
  return (await post({ kind, action: "prepare" })).body.ticket;
}
function env() {
  process.env.PAYMENT_TEST_ENABLED = "true";
  process.env.RAZORPAY_TEST_KEY_ID = "rzp_test_synthetic";
  process.env.RAZORPAY_TEST_KEY_SECRET = "synthetic-only";
  process.env.RAZORPAYX_TEST_KEY_ID = "rzp_test_syntheticX";
  process.env.RAZORPAYX_TEST_KEY_SECRET = "synthetic-X-only";
  process.env.RAZORPAYX_TEST_ACCOUNT_NUMBER = "synthetic-dummy-account";
}
env();
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
await check("anonymous GET/POST/release denied before network", async () => {
  const before = calls.length;
  assert.equal((await api.GET(request(undefined, false))).status, 401);
  assert.equal((await api.POST(request({}, false))).status, 401);
  assert.equal((await release(request({}, false))).status, 401);
  assert.equal(calls.length, before);
});
await check("customer and failed role lookup cannot test", async () => {
  role = "customer";
  assert.equal((await post({})).status, 403);
  role = "admin";
  roleError = true;
  assert.equal((await post({})).status, 403);
  roleError = false;
});
await check("expired admin session denied", async () => {
  user = null;
  assert.equal((await post({})).status, 401);
  user = "synthetic-admin";
});
await check(
  "missing Supabase public configuration fails closed before provider IO",
  async () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const before = calls.length;
    assert.equal((await post({})).status, 503);
    assert.equal(calls.length, before);
    process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  },
);
await check("live release paused even with provider enabled", async () => {
  process.env.RAZORPAYX_PAYOUTS_ENABLED = "true";
  const before = calls.length;
  assert.equal((await release(request({}))).status, 503);
  assert.equal(calls.length, before);
});
await check("readiness private/no-store, no secret fields", async () => {
  const res = await api.GET(request());
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
  assert.equal(res.headers.get("Vary"), "Authorization");
  assert.deepEqual(await res.json(), {
    mode: "test",
    paymentReady: true,
    payoutReady: true,
    livePayoutsEnabled: false,
    businessRecordsChanged: false,
  });
});
await check("disabled sandbox rejects requests", async () => {
  process.env.PAYMENT_TEST_ENABLED = "false";
  assert.equal(
    (await post({ kind: "payment", action: "prepare" })).status,
    503,
  );
  env();
});
await check("production credentials never used as fallback", async () => {
  delete process.env.RAZORPAY_TEST_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_live_neveruse";
  process.env.RAZORPAY_KEY_SECRET = "do-not-use";
  assert.equal(
    (await post({ kind: "payment", action: "prepare" })).status,
    503,
  );
  env();
});
for (const kind of ["payment", "payout"])
  await check(kind + " rejects live or malformed test key", async () => {
    const name =
      kind === "payment" ? "RAZORPAY_TEST_KEY_ID" : "RAZORPAYX_TEST_KEY_ID";
    const before = calls.length;
    for (const key of ["rzp_live_neveruse", "unknown", "rzp_test_"]) {
      process.env[name] = key;
      assert.equal((await post({ kind, action: "prepare" })).status, 503);
    }
    assert.equal(calls.length, before);
    env();
  });
await check("missing payout account disables payout only", async () => {
  delete process.env.RAZORPAYX_TEST_ACCOUNT_NUMBER;
  const res = await api.GET(request());
  assert.equal((await res.json()).payoutReady, false);
  assert.equal((await post({ kind: "payout", action: "prepare" })).status, 503);
  env();
});
await check("invalid body/large payload/actions rejected", async () => {
  for (const body of ["{", [], null, {}, { kind: "live", action: "prepare" }])
    assert.equal((await post(body)).status, 400);
  assert.equal((await post("a".repeat(4097))).status, 413);
});
await check(
  "tampered/foreign/Unicode/malformed tickets rejected before provider",
  async () => {
    const raw = await prepare("payment");
    const before = calls.length;
    for (const bad of [
      raw + "x",
      raw.split(".")[0] + "." + "é".repeat(64),
      {},
      "",
      raw + ".extra",
    ])
      assert.equal(
        (await post({ kind: "payment", action: "create", ticket: bad })).status,
        400,
      );
    user = "second-admin";
    assert.equal(
      (await post({ kind: "payment", action: "create", ticket: raw })).status,
      409,
    );
    user = "synthetic-admin";
    assert.equal(calls.length, before);
  },
);
await check("expired signed session is rejected", async () => {
  const raw = await prepare("payment");
  const data = JSON.parse(Buffer.from(raw.split(".")[0], "base64url"));
  data.expires = Date.now() - 1;
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const ticket =
    payload +
    "." +
    createHmac("sha256", "synthetic-only").update(payload).digest("hex");
  assert.equal(
    (await post({ kind: "payment", action: "create", ticket })).status,
    409,
  );
});
let order;
await check("fixed ₹1 order uses only dedicated test credentials", async () => {
  reply = (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.amount, 100);
    assert.equal(body.currency, "INR");
    assert.ok(body.receipt.startsWith("pickolo_test_"));
    assert.ok(!("booking_id" in body.notes));
    return { ...body, id: "order_synthetic", status: "created" };
  };
  order = (
    await post({
      kind: "payment",
      action: "create",
      ticket: await prepare("payment"),
      amount: 500000,
      booking_id: "real-booking",
    })
  ).body;
  assert.equal(order.orderId, "order_synthetic");
  assert.equal(order.keyId, "rzp_test_synthetic");
  assert.equal(
    Buffer.from(
      calls.at(-1).options.headers.Authorization.slice(6),
      "base64",
    ).toString(),
    "rzp_test_synthetic:synthetic-only",
  );
});
await check("order response mismatch rejected", async () => {
  reply = { id: "order_bad", amount: 101, currency: "USD" };
  assert.equal(
    (
      await post({
        kind: "payment",
        action: "create",
        ticket: await prepare("payment"),
      })
    ).status,
    502,
  );
});
const signature = createHmac("sha256", "synthetic-only")
  .update("order_synthetic|pay_synthetic")
  .digest("hex");
const verify = {
  kind: "payment",
  action: "verify",
  ticket: order.ticket,
  paymentId: "pay_synthetic",
  signature,
};
await check("invalid checkout signature never fetches provider", async () => {
  const before = calls.length;
  for (const bad of ["0".repeat(64), "é".repeat(64), ""])
    assert.equal((await post({ ...verify, signature: bad })).status, 400);
  assert.equal(calls.length, before);
});
await check(
  "captured payment checked against provider order amount currency",
  async () => {
    reply = {
      id: "pay_synthetic",
      order_id: "order_synthetic",
      amount: 100,
      currency: "INR",
      status: "captured",
    };
    assert.equal((await post(verify)).body.paid, true);
    for (const change of [
      { amount: 200 },
      { currency: "USD" },
      { order_id: "order_other" },
      { id: "pay_other" },
    ]) {
      const previous = reply;
      reply = { ...previous, ...change };
      assert.equal((await post(verify)).status, 409);
      reply = previous;
    }
  },
);
await check("authorized/failed checkout is not captured", async () => {
  for (const status of ["authorized", "failed", "refunded"]) {
    reply = {
      id: "pay_synthetic",
      order_id: "order_synthetic",
      amount: 100,
      currency: "INR",
      status,
    };
    assert.equal((await post(verify)).body.paid, false);
  }
});
let payoutTicket = await prepare("payout"),
  payoutReply;
await check("payout fixed dummy details and repeat-safe request", async () => {
  reply = (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.amount, 100);
    assert.equal(body.fund_account.vpa.address, "pickolo-test@upi");
    assert.equal(body.fund_account.contact.name, "Pickolo Sandbox Partner");
    return { ...body, id: "pout_synthetic", status: "processing" };
  };
  const body = {
    kind: "payout",
    action: "create",
    ticket: payoutTicket,
    destination: "real@upi",
    amount: 900000,
  };
  const a = await post(body);
  const callA = calls.at(-1);
  const b = await post(body);
  const callB = calls.at(-1);
  assert.equal(a.body.paid, false);
  assert.equal(b.body.paid, false);
  assert.equal(
    callA.options.headers["X-Payout-Idempotency"],
    callB.options.headers["X-Payout-Idempotency"],
  );
  assert.equal(callA.options.body, callB.options.body);
  payoutReply = JSON.parse(callA.options.body);
  payoutTicket = a.body.ticket;
});
await check("reconciliation GET never sends second payout", async () => {
  for (const status of [
    "queued",
    "processing",
    "processed",
    "failed",
    "reversed",
  ]) {
    reply = {
      id: "pout_synthetic",
      amount: 100,
      currency: "INR",
      reference_id: payoutReply.reference_id,
      status,
    };
    const res = await post({
      kind: "payout",
      action: "reconcile",
      ticket: payoutTicket,
    });
    assert.equal(res.body.paid, status === "processed");
    assert.equal(calls.at(-1).options.method, "GET");
    assert.equal(
      calls.at(-1).url,
      "https://api.razorpay.com/v1/payouts/pout_synthetic",
    );
  }
});
await check("payout mismatch and unknown reference fail safely", async () => {
  reply = {
    id: "pout_wrong",
    amount: 100,
    currency: "INR",
    reference_id: payoutReply.reference_id,
    status: "processed",
  };
  assert.equal(
    (await post({ kind: "payout", action: "create", ticket: payoutTicket }))
      .status,
    502,
  );
  assert.equal(
    (
      await post({
        kind: "payout",
        action: "reconcile",
        ticket: await prepare("payout"),
      })
    ).status,
    409,
  );
});
await check(
  "timeout reports ambiguous request without marking paid",
  async () => {
    failure = true;
    const res = await post({
      kind: "payout",
      action: "create",
      ticket: payoutTicket,
    });
    failure = false;
    assert.equal(res.status, 502);
    assert.match(res.body.error, /same test session/);
    assert.equal(res.body.paid, undefined);
  },
);
await check("no business tables or privileged clients used", async () => {
  assert.ok(tables.every((t) => t === "profiles"));
  assert.ok(
    !fs
      .readFileSync("lib/payment-test.ts", "utf8")
      .includes("getServiceClient"),
  );
});

// Render actual page and exercise missing-config/duplicate-click/recovery paths.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = {};
const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, v),
};
let uiCalls = [],
  uiReady = { paymentReady: false, payoutReady: false },
  pendingResolve;
globalThis.fetch = async (url, options) => {
  const body = options.body ? JSON.parse(options.body) : null;
  uiCalls.push(body);
  if (!body) return Response.json(uiReady);
  if (body.action === "prepare")
    return Response.json({ ticket: "synthetic-ticket" });
  if (body.action === "create")
    return new Promise((resolve) => {
      pendingResolve = () =>
        resolve(
          Response.json({
            ticket: "provider-ticket",
            status: "processing",
            paid: false,
            message: "Sandbox processing",
          }),
        );
    });
  throw new Error("Unexpected UI request");
};
const Page = load("app/admin/payment-test/page.tsx").default;
let tree;
await check(
  "missing credentials disable both buttons and do not load checkout",
  async () => {
    await act(async () => {
      tree = create(React.createElement(Page));
    });
    const buttons = tree.root.findAllByType("button");
    assert.equal(buttons[1].props.disabled, true);
    assert.equal(buttons[2].props.disabled, true);
    assert.match(JSON.stringify(tree.toJSON()), /Test keys needed/);
  },
);
await check(
  "duplicate payout clicks create just one request and preserve session before IO",
  async () => {
    uiReady = { paymentReady: false, payoutReady: true };
    await act(async () => {
      await tree.root.findAllByType("button")[0].props.onClick();
    });
    const button = tree.root.findAllByType("button")[2];
    await act(async () => {
      button.props.onClick();
      button.props.onClick();
      await new Promise((resolve) => setImmediate(resolve));
    });
    assert.equal(uiCalls.filter((x) => x?.action === "create").length, 1);
    assert.equal(
      store.get("pickolo.admin.sandbox.payout.v1"),
      "synthetic-ticket",
    );
    await act(async () => {
      pendingResolve();
      await new Promise((resolve) => setImmediate(resolve));
    });
    assert.equal(
      store.get("pickolo.admin.sandbox.payout.v1"),
      "provider-ticket",
    );
    assert.match(JSON.stringify(tree.toJSON()), /Sandbox processing/);
    await act(async () => {
      tree.unmount();
    });
  },
);
await check(
  "reload restores existing payout instead of starting fresh",
  async () => {
    uiCalls = [];
    await act(async () => {
      tree = create(React.createElement(Page));
    });
    assert.match(
      JSON.stringify(tree.toJSON()),
      /Previous payout test restored/,
    );
    await act(async () => {
      tree.root.findAllByType("button")[2].props.onClick();
      await new Promise((resolve) => setImmediate(resolve));
    });
    assert.equal(uiCalls.filter((x) => x?.action === "prepare").length, 0);
    assert.equal(
      uiCalls.find((x) => x?.action === "create").ticket,
      "provider-ticket",
    );
    await act(async () => {
      pendingResolve();
      await new Promise((resolve) => setImmediate(resolve));
      tree.unmount();
    });
  },
);
console.log(
  `${passed} sandbox checks passed. All provider responses synthetic; no live or sandbox-provider transaction was made.`,
);
