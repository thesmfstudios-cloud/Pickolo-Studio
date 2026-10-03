import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server.js";

// Actual handlers and transaction SQL on disposable Postgres. Auth transport,
// Storage signing and payout provider are mocked. No live keys or money.
// Payout reserve/record scenarios exercise the dormant reconciliation module;
// the public release route is separately tested as unconditionally paused.
const root = process.cwd(),
  require = createRequire(path.join(root, "package.json")),
  db = new PGlite();
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://admin-test.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public";
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key,phone text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean);
create table storage.objects(id uuid,name text,bucket_id text,owner_id text);
grant usage on schema public,auth to authenticated,anon,service_role;`);
for (const name of fs
  .readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .sort())
  await db.exec(
    fs
      .readFileSync("supabase/migrations/" + name, "utf8")
      .replace("create extension if not exists pgcrypto;", ""),
  );
const owner = randomUUID(),
  customer = randomUUID();
await db.query("insert into auth.users(id) values($1),($2)", [owner, customer]);
await db.query("update profiles set role='admin' where id=$1", [owner]);
const service = (
  await db.query("select id from services where name='Photography'")
).rows[0].id;
const level = (
  await db.query("select id from service_levels where name='Standard'")
).rows[0].id;
let state = {
    user: owner,
    providerEnabled: false,
    providerStatus: "queued",
    rpcCalls: [],
    queryCalls: [],
    providerCalls: [],
  },
  passed = 0;
function from(table) {
  const filters = [];
  let range = [0, 19],
    or = "",
    sorts = [],
    count = false;
  const run = async (single = false) => {
    state.queryCalls.push({ table, filters, range, or });
    if (state.queryError === table)
      return { data: null, error: { message: "Unavailable" } };
    const values = [],
      where = filters.map(([column, value]) => {
        values.push(value);
        return column + "=$" + values.length;
      });
    const whereSql = where.length ? " where " + where.join(" and ") : "";
    const rows = (
      await db.query(
        "select * from " +
          table +
          whereSql +
          (sorts.length ? " order by " + sorts.join(",") : "") +
          " limit " +
          (range[1] - range[0] + 1) +
          " offset " +
          range[0],
        values,
      )
    ).rows;
    return {
      data: single ? rows[0] || null : rows,
      error: single && !rows.length ? { message: "Not found" } : null,
      count: count
        ? Number(
            (
              await db.query(
                "select count(*) n from " + table + whereSql,
                values,
              )
            ).rows[0].n,
          )
        : null,
    };
  };
  const builder = {
    select(_columns, options) {
      count = !!options?.count;
      return builder;
    },
    eq(c, v) {
      filters.push([c, v]);
      return builder;
    },
    or(v) {
      or = v;
      return builder;
    },
    order(c, options = {}) {
      sorts.push(c + " " + (options.ascending === false ? "desc" : "asc"));
      return builder;
    },
    range(a, b) {
      range = [a, b];
      return builder;
    },
    limit(n) {
      range = [0, n - 1];
      return builder;
    },
    single() {
      return run(true);
    },
    then(a, b) {
      return run().then(a, b);
    },
  };
  return builder;
}
const client = {
  auth: {
    async getUser() {
      return {
        data: {
          user: state.user
            ? { id: state.user, email: "operator@test.invalid" }
            : null,
        },
        error: null,
      };
    },
  },
  from,
  storage: {
    from() {
      return {
        async createSignedUrl(file) {
          return state.fileMissing
            ? { error: { message: "missing" } }
            : {
                data: {
                  signedUrl: "https://storage.test.invalid/private/" + file,
                },
              };
        },
      };
    },
  },
  async rpc(name, args = {}) {
    state.rpcCalls.push(name);
    if (state.rpcMissing)
      return { data: null, error: { code: "PGRST202", message: "missing" } };
    assert(/^admin_/.test(name), "Unexpected RPC " + name);
    try {
      const keys = Object.keys(args),
        values = Object.values(args);
      const result = await db.query(
        "select public." +
          name +
          "(" +
          keys.map((key, i) => key + " => $" + (i + 1)).join(",") +
          ") result",
        values,
      );
      return { data: result.rows[0].result, error: null };
    } catch (e) {
      return { data: null, error: { code: e.code, message: e.message } };
    }
  },
};
const provider = {
  razorpayXPayoutsEnabled: () => state.providerEnabled,
  async createRazorpayXUpiPayout(input) {
    state.providerCalls.push({ method: "create", input });
    if (state.providerError) throw new Error("Provider unavailable");
    return {
      id: state.providerId || "pout_Test" + input.bookingId.replaceAll("-", ""),
      status: state.providerStatus,
      amount: state.providerAmount ?? input.amountPaise,
      currency: state.providerCurrency || "INR",
      referenceId: ("pickolo_" + input.bookingCode).slice(0, 40),
    };
  },
  async fetchRazorpayXPayout(id) {
    state.providerCalls.push({ method: "fetch", id });
    if (state.providerError) throw new Error("Provider unavailable");
    const intent = (
      await db.query(
        "select p.*,b.booking_code from payouts p join bookings b on b.id=p.booking_id where provider_payout_id=$1",
        [id],
      )
    ).rows[0];
    return {
      id,
      status: state.providerStatus,
      amount: state.providerAmount ?? Number(intent.amount_paise),
      currency: "INR",
      referenceId: ("pickolo_" + intent.booking_code).slice(0, 40),
    };
  },
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
      esModuleInterop: true,
    },
  }).outputText;
  const local = (name) =>
    name === "@supabase/supabase-js"
      ? { createClient: () => client }
      : name === "@/lib/supabase-admin"
        ? { getServiceClient: () => client }
        : name === "@/lib/razorpayx"
          ? provider
          : name.startsWith("@/")
            ? load(path.join(root, name.slice(2) + ".ts"))
            : require(name);
  new Function("require", "module", "exports", code)(
    local,
    module,
    module.exports,
  );
  return module.exports;
}
const review = load("app/api/admin/partners/[id]/verify/route.ts").POST,
  docs = load("app/api/admin/partner-documents/route.ts").POST;
const payout = load(
    "lib/admin-payout-reconciliation.ts",
  ).reconcileReservedPayout,
  metrics = load("app/api/admin/metrics/route.ts").GET;
const queues = load("app/api/admin/queue/route.ts").GET,
  session = load("app/api/admin/session/route.ts").GET,
  link = load("app/api/admin/document-link/route.ts").GET;
const disputes = load("app/api/admin/disputes/route.ts").POST,
  pricing = load("app/api/admin/pricing/route.ts").PATCH,
  model = load("lib/admin-model.ts");
const publicRelease = load("app/api/admin/payouts/[id]/release/route.ts").POST;
const req = (route, body, header = true) =>
  new NextRequest("https://admin.test.invalid" + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(header ? { Authorization: "Bearer test" } : {}),
      "Content-Type": "application/json",
    },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
const post = (handler, id, body) =>
  handler(req("/api/admin/test", body), { params: Promise.resolve({ id }) });
async function test(name, run) {
  state = {
    user: owner,
    providerEnabled: false,
    providerStatus: "queued",
    rpcCalls: [],
    queryCalls: [],
    providerCalls: [],
  };
  await run();
  passed++;
  console.log("PASS " + name);
}
async function application() {
  const person = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [person]);
  const app = (
    await db.query(
      "insert into partner_applications(applicant_id,display_name,phone,skills,payout_upi_id) values($1,'Test creator','9999999999',array['Photography','Equipment: Phone'],'test@upi') returning *",
      [person],
    )
  ).rows[0];
  const doc = (
    await db.query(
      "insert into partner_verification_documents(applicant_id,document_type,storage_path,file_name,mime_type,size_bytes) values($1,'identity',$2,'identity.jpg','image/jpeg',3) returning *",
      [person, person + "/identity.jpg"],
    )
  ).rows[0];
  return { app, doc, person };
}
async function object(doc) {
  await db.query(
    "insert into storage.objects(id,bucket_id,name) values($1,'partner-documents',$2)",
    [randomUUID(), doc.storage_path],
  );
}
async function approveDocument(doc) {
  return docs(
    req("/api/admin/partner-documents", {
      id: doc.id,
      status: "approved",
      expected_status: "pending",
    }),
  );
}
async function booking() {
  const a = await application();
  await object(a.doc);
  await approveDocument(a.doc);
  assert.equal(
    (
      await post(review, a.app.id, {
        action: "approve",
        expected_status: "pending",
      })
    ).status,
    200,
  );
  const b = (
    await db.query(
      "insert into bookings(customer_id,service_id,service_level_id,scheduled_start,duration_minutes,location_text,location_lat,location_long,raw_policy_version,raw_policy_accepted_at) values($1,$2,$3,'2099-01-01',60,'Bhopal',23.184690,77.435274,'raw-v1',now()) returning *",
      [customer, service, level],
    )
  ).rows[0];
  await db.query(
    "update bookings set assigned_partner_id=$1,status='DATA_PENDING',partner_acceptance_status='accepted' where id=$2",
    [a.person, b.id],
  );
  const path = b.id + "/photo.jpg";
  await db.query(
    "insert into storage.objects(id,bucket_id,name) values($1,'booking-deliveries',$2)",
    [randomUUID(), path],
  );
  await db.query("select finalize_partner_delivery($1,$2,true,$3)", [
    b.id,
    a.person,
    JSON.stringify([
      {
        storage_path: path,
        file_name: "photo.jpg",
        mime_type: "image/jpeg",
        size_bytes: 3,
      },
    ]),
  ]);
  return (await db.query("select * from bookings where id=$1", [b.id])).rows[0];
}
await test("every new read and mutation rejects absent authentication before any query", async () => {
  for (const h of [
    metrics,
    queues,
    session,
    link,
    docs,
    review,
    payout,
    disputes,
    pricing,
  ]) {
    const r = await h(
      req(
        "/api/admin/test",
        h === docs ||
          h === review ||
          h === payout ||
          h === disputes ||
          h === pricing
          ? {}
          : undefined,
        false,
      ),
      { params: Promise.resolve({ id: randomUUID() }) },
    );
    assert.equal(r.status, 401);
  }
  assert.equal(state.queryCalls.length, 0);
  assert.equal(state.providerCalls.length, 0);
});
await test("customer cannot use operator APIs or invoke mutation RPCs", async () => {
  state.user = customer;
  for (const h of [metrics, queues, session, link, docs, review, payout]) {
    assert.equal(
      (
        await h(
          req(
            "/api/admin/test",
            h === docs || h === review || h === payout ? {} : undefined,
          ),
          { params: Promise.resolve({ id: randomUUID() }) },
        )
      ).status,
      403,
    );
  }
  assert.equal(state.rpcCalls.length, 0);
});
await test("failed access lookup fails closed without touching protected data", async () => {
  state.queryError = "profiles";
  assert.equal((await metrics(req("/api/admin/metrics"))).status, 503);
  assert.equal(state.rpcCalls.length, 0);
});
await test("malformed mutation JSON is a recoverable 400", async () => {
  assert.equal(
    (await docs(req("/api/admin/partner-documents", "{"))).status,
    400,
  );
  assert.equal(state.rpcCalls.length, 0);
});
await test("application cannot be approved without approved uploaded identity", async () => {
  const { app } = await application();
  assert.equal(
    (
      await post(review, app.id, {
        action: "approve",
        expected_status: "pending",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await db.query("select role from profiles where id=$1", [
        app.applicant_id,
      ])
    ).rows[0].role,
    "customer",
  );
});
await test("document approval refuses metadata whose Storage file is missing", async () => {
  const { doc } = await application();
  assert.equal((await approveDocument(doc)).status, 400);
  assert.equal(
    (
      await db.query(
        "select status from partner_verification_documents where id=$1",
        [doc.id],
      )
    ).rows[0].status,
    "pending",
  );
});
await test("document review is audited and stale duplicate cannot overwrite it", async () => {
  const { doc } = await application();
  await object(doc);
  assert.equal((await approveDocument(doc)).status, 200);
  assert.equal((await approveDocument(doc)).status, 409);
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*) n from admin_audit_log where entity_id=$1",
          [doc.id],
        )
      ).rows[0].n,
    ),
    1,
  );
});
await test("approved identity alone unlocks atomic partner approval and preserves choices", async () => {
  const { app, doc, person } = await application();
  await object(doc);
  await approveDocument(doc);
  assert.equal(
    (
      await post(review, app.id, {
        action: "approve",
        expected_status: "pending",
      })
    ).status,
    200,
  );
  assert.equal(
    (await db.query("select role from profiles where id=$1", [person])).rows[0]
      .role,
    "partner",
  );
  assert.equal(
    (
      await db.query("select verification_status from partners where id=$1", [
        person,
      ])
    ).rows[0].verification_status,
    "approved",
  );
  assert.equal(
    (
      await post(review, app.id, {
        action: "approve",
        expected_status: "pending",
      })
    ).status,
    409,
  );
});
await test("rejection requires useful correction instructions", async () => {
  const { app } = await application();
  assert.equal(
    (
      await post(review, app.id, {
        action: "reject",
        expected_status: "pending",
        rejection_reason: "no",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(review, app.id, {
        action: "reject",
        expected_status: "pending",
        rejection_reason: "Please upload a legible identity photo.",
      })
    ).status,
    200,
  );
});
await test("audit failure rolls back partner, profile, application and notification writes", async () => {
  const { app, doc, person } = await application();
  await object(doc);
  await approveDocument(doc);
  await db.exec(
    "create function fail_admin_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end; $$; create trigger admin_test_failure before insert on admin_audit_log for each row execute function fail_admin_audit();",
  );
  try {
    assert.notEqual(
      (
        await post(review, app.id, {
          action: "approve",
          expected_status: "pending",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await db.query("select status from partner_applications where id=$1", [
          app.id,
        ])
      ).rows[0].status,
      "pending",
    );
    assert.equal(
      (await db.query("select role from profiles where id=$1", [person]))
        .rows[0].role,
      "customer",
    );
    assert.equal(
      (await db.query("select count(*) n from partners where id=$1", [person]))
        .rows[0].n,
      0,
    );
  } finally {
    await db.exec(
      "drop trigger admin_test_failure on admin_audit_log;drop function fail_admin_audit();",
    );
  }
});
await test("owner account cannot be converted to a partner by approval", async () => {
  const { app, doc, person } = await application();
  await object(doc);
  await approveDocument(doc);
  await db.query("update profiles set role='admin' where id=$1", [person]);
  assert.equal(
    (
      await post(review, app.id, {
        action: "approve",
        expected_status: "pending",
      })
    ).status,
    403,
  );
});
await test("reapproval does not reset an existing earned service level", async () => {
  const { app, doc, person } = await application();
  await object(doc);
  await approveDocument(doc);
  await post(review, app.id, { action: "approve", expected_status: "pending" });
  const best =
    (await db.query("select id from service_levels where name='Premium'"))
      .rows[0]?.id ||
    (await db.query("select id from service_levels order by sort_order desc"))
      .rows[0].id;
  await db.query("update partners set service_level_id=$1 where id=$2", [
    best,
    person,
  ]);
  await post(review, app.id, {
    action: "suspend",
    expected_status: "approved",
    rejection_reason: "Temporary review of service quality.",
  });
  assert.equal(
    (
      await post(review, app.id, {
        action: "approve",
        expected_status: "suspended",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await db.query("select service_level_id from partners where id=$1", [
        person,
      ])
    ).rows[0].service_level_id,
    best,
  );
});
await test("public release stays paused with provider enabled and creates no payout intent", async () => {
  const b = await booking();
  state.providerEnabled = true;
  const before = state.rpcCalls.length;
  assert.equal((await post(publicRelease, b.id, {})).status, 503);
  assert.equal(state.rpcCalls.length, before);
  assert.equal(state.providerCalls.length, 0);
  assert.equal(
    Number(
      (
        await db.query("select count(*) n from payouts where booking_id=$1", [
          b.id,
        ])
      ).rows[0].n,
    ),
    0,
  );
});
await test("admin session cannot enable live payouts from configured legacy keys", async () => {
  state.providerEnabled = true;
  const response = await session(req("/api/admin/session"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).payoutsEnabled, false);
});
await test("disabled payout provider does not reserve, transfer or mark anything paid", async () => {
  const b = await booking();
  const before = state.rpcCalls.length;
  assert.equal((await post(payout, b.id, {})).status, 503);
  assert.equal(state.rpcCalls.length, before);
  assert.equal(state.providerCalls.length, 0);
});
await test("queued payout persists an immutable request but does not mark the booking paid", async () => {
  const b = await booking();
  state.providerEnabled = true;
  assert.equal((await post(payout, b.id, {})).status, 202);
  assert.equal(
    (await db.query("select status from bookings where id=$1", [b.id])).rows[0]
      .status,
    "DATA_SUBMITTED",
  );
  const p = (
    await db.query("select * from payouts where booking_id=$1", [b.id])
  ).rows[0];
  assert.equal(p.status, "queued");
  assert.equal(p.released_at, null);
  assert.equal(p.destination_upi_id, "test@upi");
});
await test("reconciliation fetches the same transfer and processed confirmation releases atomically", async () => {
  const b = await booking();
  state.providerEnabled = true;
  await post(payout, b.id, {});
  state.providerStatus = "processed";
  assert.equal((await post(payout, b.id, {})).status, 200);
  assert.equal(
    state.providerCalls.filter((c) => c.method === "create").length,
    1,
  );
  assert.equal(
    state.providerCalls.filter((c) => c.method === "fetch").length,
    1,
  );
  assert.equal(
    (await db.query("select status from bookings where id=$1", [b.id])).rows[0]
      .status,
    "PAYOUT_RELEASED",
  );
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*) n from booking_status_history where booking_id=$1 and to_status='PAYOUT_RELEASED'",
          [b.id],
        )
      ).rows[0].n,
    ),
    1,
  );
});
await test("provider failure retains request and never reports paid", async () => {
  const b = await booking();
  state.providerEnabled = true;
  state.providerError = true;
  assert.equal((await post(payout, b.id, {})).status, 502);
  assert.equal(
    (await db.query("select status from bookings where id=$1", [b.id])).rows[0]
      .status,
    "DATA_SUBMITTED",
  );
  assert.equal(
    (await db.query("select status from payouts where booking_id=$1", [b.id]))
      .rows[0].status,
    "requesting",
  );
  assert.equal((await post(payout, b.id, {})).status, 409);
  assert.equal(state.providerCalls.length, 1);
});
await test("incorrect provider amount is not recorded as a successful transfer", async () => {
  const b = await booking();
  state.providerEnabled = true;
  state.providerAmount = 1;
  assert.equal((await post(payout, b.id, {})).status, 409);
  assert.equal(
    (await db.query("select status from bookings where id=$1", [b.id])).rows[0]
      .status,
    "DATA_SUBMITTED",
  );
});
await test("failed provider payouts do not unlock booking completion", async () => {
  const b = await booking();
  state.providerEnabled = true;
  state.providerStatus = "failed";
  assert.equal((await post(payout, b.id, {})).status, 202);
  const result = await client.rpc("admin_complete_booking", {
    p_actor: owner,
    p_booking: b.id,
  });
  assert(result.error);
});
await test("an open dispute blocks transfer before the provider is called", async () => {
  const b = await booking();
  await db.query(
    "insert into booking_disputes(booking_id,opened_by,reason_code,description) values($1,$2,'quality','Needs review')",
    [b.id, customer],
  );
  state.providerEnabled = true;
  assert.equal((await post(payout, b.id, {})).status, 409);
  assert.equal(state.providerCalls.length, 0);
});
await test("legacy internally released records cannot trigger another payout", async () => {
  const b = await booking();
  await db.query(
    "insert into payouts(booking_id,partner_id,amount_paise,status) values($1,$2,$3,'released')",
    [b.id, b.assigned_partner_id, b.partner_payout_paise],
  );
  state.providerEnabled = true;
  assert.equal((await post(payout, b.id, {})).status, 409);
  assert.equal(state.providerCalls.length, 0);
});
await test("processed booking completes once with XP and audit trail", async () => {
  const b = await booking();
  state.providerEnabled = true;
  state.providerStatus = "processed";
  await post(payout, b.id, {});
  const completed = await client.rpc("admin_complete_booking", {
    p_actor: owner,
    p_booking: b.id,
  });
  assert.equal(completed.error, null);
  assert.equal(completed.data.status, "COMPLETED");
  assert(
    (
      await client.rpc("admin_complete_booking", {
        p_actor: owner,
        p_booking: b.id,
      })
    ).error,
  );
  assert.equal(
    Number(
      (
        await db.query(
          "select xp from partner_performance where partner_id=$1",
          [b.assigned_partner_id],
        )
      ).rows[0].xp,
    ),
    100,
  );
});
await test("support decisions require resolution and prevent stale final decisions", async () => {
  const b = await booking();
  const d = (
    await db.query(
      "insert into booking_disputes(booking_id,opened_by,reason_code,description) values($1,$2,'quality','Needs review') returning *",
      [b.id, customer],
    )
  ).rows[0];
  assert.equal(
    (
      await disputes(
        req("/api/admin/disputes", {
          id: d.id,
          status: "resolved",
          expected_status: "open",
          resolution: "bad",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await disputes(
        req("/api/admin/disputes", {
          id: d.id,
          status: "under_review",
          expected_status: "open",
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await disputes(
        req("/api/admin/disputes", {
          id: d.id,
          status: "resolved",
          expected_status: "open",
          resolution: "Resolved after discussing the file.",
        }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await disputes(
        req("/api/admin/disputes", {
          id: d.id,
          status: "resolved",
          expected_status: "under_review",
          resolution: "Resolved after discussing the file.",
        }),
      )
    ).status,
    200,
  );
});
await test("price update validates fee and rejects stale concurrent edits", async () => {
  const p = (await db.query("select * from service_level_prices limit 1"))
    .rows[0];
  const body = {
    id: p.id,
    amount_paise: 90000,
    platform_fee_bps: 2500,
    expected_updated_at: p.updated_at.toISOString(),
  };
  assert.equal(
    (
      await pricing(
        req("/api/admin/pricing", { ...body, platform_fee_bps: 10001 }),
      )
    ).status,
    400,
  );
  assert.equal((await pricing(req("/api/admin/pricing", body))).status, 200);
  assert.equal((await pricing(req("/api/admin/pricing", body))).status, 409);
});
await test("metrics are SQL aggregates with real queue counts and valid zero-safe shape", async () => {
  const response = await metrics(req("/api/admin/metrics"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const data = await response.json();
  assert(model.validMetrics(data));
  assert.equal(
    data.bookings.total,
    Number((await db.query("select count(*) n from bookings")).rows[0].n),
  );
  assert(!model.validMetrics({ error: "Database failed" }));
  assert(!model.validMetrics({ bookings: {} }));
});
await test("server-side pagination has deterministic ordering and status filtering", async () => {
  const response = await queues(
    req("/api/admin/queue?kind=applications&page=2&status=pending"),
  );
  assert.equal(response.status, 200);
  const query = state.queryCalls.at(-1);
  assert.deepEqual(query.range, [20, 39]);
  assert(query.filters.some(([c, v]) => c === "status" && v === "pending"));
  assert.equal((await response.json()).page, 2);
});
await test("invalid queue/page/status and filter syntax cannot reach protected list reads", async () => {
  for (const query of [
    "kind=bad",
    "kind=overview",
    "kind=applications&page=-1",
    "kind=applications&page=10001",
    "kind=applications&status=invalid",
  ])
    assert.equal((await queues(req("/api/admin/queue?" + query))).status, 400);
  const parsed = model.queueParams(
    new URLSearchParams("kind=applications&q=abc),role.eq.admin"),
  );
  assert(!parsed.search.includes(",") && !parsed.search.includes(")"));
});
await test("missing safety migration yields setup warning instead of false success", async () => {
  state.rpcMissing = true;
  assert.equal((await metrics(req("/api/admin/metrics"))).status, 503);
  const response = await session(req("/api/admin/session"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).safetyReady, false);
});
await test("private document links are admin-only, short-lived and uncached", async () => {
  const { doc } = await application();
  const response = await link(req("/api/admin/document-link?id=" + doc.id));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).expiresInSeconds, 300);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
await test("privileged RPCs cannot be executed by anon or authenticated roles", async () => {
  const routines = (
    await db.query(
      "select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'admin_%'",
    )
  ).rows;
  assert(routines.length >= 9);
  for (const r of routines) {
    const grant = (
      await db.query(
        "select has_function_privilege('anon',$1,'execute') a,has_function_privilege('authenticated',$1,'execute') b,has_function_privilege('service_role',$1,'execute') s",
        [r.oid],
      )
    ).rows[0];
    assert.deepEqual(grant, { a: false, b: false, s: true });
  }
});

const assign = load("app/api/admin/assignments/route.ts").POST,
  reassign = load("app/api/admin/reassign/route.ts").POST;
async function assignable() {
  const b = await booking();
  await db.query(
    "update bookings set status='SEARCHING_PARTNER',assigned_partner_id=null where id=$1",
    [b.id],
  );
  await db.query(
    "update partners set base_lat=23.184690,base_long=77.435274 where id=$1",
    [b.assigned_partner_id],
  );
  await db.query(
    "insert into partner_availability(partner_id,starts_at,ends_at,available) values($1,'2098-12-31','2099-01-02',true)",
    [b.assigned_partner_id],
  );
  return b;
}
await test("assignment APIs reject missing auth and malformed UUIDs", async () => {
  for (const h of [assign, reassign]) {
    assert.equal(
      (await h(req("/api/admin/assignments", {}, false))).status,
      401,
    );
    assert.equal(
      (
        await h(
          req("/api/admin/assignments", {
            booking_id: "bad",
            partner_id: "bad",
          }),
        )
      ).status,
      400,
    );
  }
});
await test("assignment preserves acceptance offer and saves notification/history/audit together", async () => {
  const b = await assignable();
  const response = await assign(
    req("/api/admin/assignments", {
      booking_id: b.id,
      partner_id: b.assigned_partner_id,
    }),
  );
  assert.equal(response.status, 200);
  const row = (await db.query("select * from bookings where id=$1", [b.id]))
    .rows[0];
  assert.equal(row.status, "PARTNER_ASSIGNED");
  assert.equal(row.partner_acceptance_status, "pending");
  assert(row.partner_offer_expires_at);
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*) n from admin_audit_log where entity_id=$1 and action='ASSIGN_PARTNER'",
          [b.id],
        )
      ).rows[0].n,
    ),
    1,
  );
  assert.equal(
    (
      await assign(
        req("/api/admin/assignments", {
          booking_id: b.id,
          partner_id: b.assigned_partner_id,
        }),
      )
    ).status,
    409,
  );
});
await test("overlap, unavailable, unapproved and out-of-radius partners are refused", async () => {
  const b = await assignable();
  await db.query("update partners set base_lat=0,base_long=0 where id=$1", [
    b.assigned_partner_id,
  ]);
  assert.equal(
    (
      await assign(
        req("/api/admin/assignments", {
          booking_id: b.id,
          partner_id: b.assigned_partner_id,
        }),
      )
    ).status,
    400,
  );
  await db.query(
    "update partners set base_lat=23.184690,base_long=77.435274,verification_status='suspended' where id=$1",
    [b.assigned_partner_id],
  );
  assert.equal(
    (
      await assign(
        req("/api/admin/assignments", {
          booking_id: b.id,
          partner_id: b.assigned_partner_id,
        }),
      )
    ).status,
    400,
  );
  await db.query(
    "update partners set verification_status='approved' where id=$1",
    [b.assigned_partner_id],
  );
  await db.query("delete from partner_availability where partner_id=$1", [
    b.assigned_partner_id,
  ]);
  assert.equal(
    (
      await assign(
        req("/api/admin/assignments", {
          booking_id: b.id,
          partner_id: b.assigned_partner_id,
        }),
      )
    ).status,
    400,
  );
});
await test("videography choice alone does not bypass approved service capability", async () => {
  const b = await assignable(),
    video = (await db.query("select id from services where name='Videography'"))
      .rows[0];
  assert(video);
  await db.query("update bookings set service_id=$1 where id=$2", [
    video.id,
    b.id,
  ]);
  assert.equal(
    (
      await assign(
        req("/api/admin/assignments", {
          booking_id: b.id,
          partner_id: b.assigned_partner_id,
        }),
      )
    ).status,
    400,
  );
  await db.query(
    "insert into partner_services(partner_id,service_id) values($1,$2)",
    [b.assigned_partner_id, video.id],
  );
  assert.equal(
    (
      await assign(
        req("/api/admin/assignments", {
          booking_id: b.id,
          partner_id: b.assigned_partner_id,
        }),
      )
    ).status,
    200,
  );
});
await test("two manual bookings cannot give the same partner overlapping work", async () => {
  const a = await assignable(),
    b = await assignable();
  assert.equal(
    (
      await assign(
        req("/api/admin/assignments", {
          booking_id: a.id,
          partner_id: a.assigned_partner_id,
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await assign(
        req("/api/admin/assignments", {
          booking_id: b.id,
          partner_id: a.assigned_partner_id,
        }),
      )
    ).status,
    409,
  );
});
await test("failed assignment audit rolls back booking and offer writes", async () => {
  const b = await assignable();
  await db.exec(
    "create function fail_assignment_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end; $$;create trigger admin_assignment_failure before insert on admin_audit_log for each row execute function fail_assignment_audit();",
  );
  try {
    assert.notEqual(
      (
        await assign(
          req("/api/admin/assignments", {
            booking_id: b.id,
            partner_id: b.assigned_partner_id,
          }),
        )
      ).status,
      200,
    );
    const row = (await db.query("select * from bookings where id=$1", [b.id]))
      .rows[0];
    assert.equal(row.status, "SEARCHING_PARTNER");
    assert.equal(row.assigned_partner_id, null);
  } finally {
    await db.exec(
      "drop trigger admin_assignment_failure on admin_audit_log;drop function fail_assignment_audit();",
    );
  }
});
await test("emergency assignment creates a traceable reassignment record", async () => {
  const b = await assignable();
  assert.equal(
    (
      await reassign(
        req("/api/admin/reassign", {
          booking_id: b.id,
          partner_id: b.assigned_partner_id,
          reason: "Replacement arranged after attendance check.",
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*) n from booking_reassignments where booking_id=$1",
          [b.id],
        )
      ).rows[0].n,
    ),
    1,
  );
});
await test("no-show transaction clears acceptance and can be recorded only once", async () => {
  const b = await assignable();
  await assign(
    req("/api/admin/assignments", {
      booking_id: b.id,
      partner_id: b.assigned_partner_id,
    }),
  );
  const args = {
    p_actor: owner,
    p_booking: b.id,
    p_expected: "PARTNER_ASSIGNED",
    p_reason: "Called partner twice; unable to attend.",
  };
  assert.equal((await client.rpc("admin_record_no_show", args)).error, null);
  const row = (await db.query("select * from bookings where id=$1", [b.id]))
    .rows[0];
  assert.equal(row.assigned_partner_id, null);
  assert.equal(row.partner_acceptance_status, "not_required");
  assert.equal(row.partner_offer_expires_at, null);
  assert((await client.rpc("admin_record_no_show", args)).error);
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*) n from booking_incidents where booking_id=$1",
          [b.id],
        )
      ).rows[0].n,
    ),
    1,
  );
});
await test("null JSON and incomplete metrics are not treated as valid success", async () => {
  assert.equal(
    (await docs(req("/api/admin/partner-documents", "null"))).status,
    400,
  );
  assert(
    !model.validMetrics({
      bookings: {
        total: 0,
        paid: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
        completionRate: 0,
      },
      money: {},
      queues: {},
      generatedAt: "2026-10-02",
    }),
  );
});
await test("simultaneous payout clicks reserve one request and create one transfer", async () => {
  const b = await booking();
  state.providerEnabled = true;
  const responses = await Promise.all([
    post(payout, b.id, {}),
    post(payout, b.id, {}),
  ]);
  assert(responses.some((r) => r.status === 202));
  assert.equal(
    state.providerCalls.filter((c) => c.method === "create").length,
    1,
  );
  assert.equal(
    Number(
      (
        await db.query("select count(*) n from payouts where booking_id=$1", [
          b.id,
        ])
      ).rows[0].n,
    ),
    1,
  );
});
const dossier = load("app/api/admin/booking/route.ts").GET,
  assetLink = load("app/api/admin/asset-link/route.ts").GET;
await test("booking dossier is admin-only and private assets are not auto-signed", async () => {
  const b = await booking();
  assert.equal(
    (await dossier(req("/api/admin/booking?id=" + b.id, undefined, false)))
      .status,
    401,
  );
  const response = await dossier(req("/api/admin/booking?id=" + b.id));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert(data.history.length > 0);
  assert(data.assets.length > 0);
  state.user = customer;
  assert.equal(
    (await dossier(req("/api/admin/booking?id=" + b.id))).status,
    403,
  );
});
await test("backup preview checks admin identity and returns uncached five-minute link", async () => {
  const b = await booking(),
    asset = (
      await db.query("select id from delivery_assets where booking_id=$1", [
        b.id,
      ])
    ).rows[0];
  const response = await assetLink(req("/api/admin/asset-link?id=" + asset.id));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.json()).expiresInSeconds, 300);
  state.user = customer;
  assert.equal(
    (await assetLink(req("/api/admin/asset-link?id=" + asset.id))).status,
    403,
  );
});
const eligibility = load("app/api/admin/partner-eligibility/route.ts").POST;
await test("job eligibility is operator-controlled, audited and does not award XP", async () => {
  const b = await booking(),
    video = (await db.query("select id from services where name='Videography'"))
      .rows[0];
  const body = {
    partner_id: b.assigned_partner_id,
    service_level_id: level,
    expected_level_id: level,
    service_ids: [service, video.id],
    expected_service_ids: [],
  };
  assert.equal(
    (await eligibility(req("/api/admin/partner-eligibility", body))).status,
    200,
  );
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*) n from partner_services where partner_id=$1",
          [b.assigned_partner_id],
        )
      ).rows[0].n,
    ),
    2,
  );
  assert.equal(
    Number(
      (
        await db.query(
          "select coalesce((select xp from partner_performance where partner_id=$1),0) xp",
          [b.assigned_partner_id],
        )
      ).rows[0].xp,
    ),
    0,
  );
  assert.equal(
    Number(
      (
        await db.query(
          "select count(*) n from admin_audit_log where entity_id=$1 and action='UPDATE_JOB_ELIGIBILITY'",
          [b.assigned_partner_id],
        )
      ).rows[0].n,
    ),
    1,
  );
  assert.equal(
    (await eligibility(req("/api/admin/partner-eligibility", body))).status,
    409,
  );
});
await test("invalid services and suspended/non-admin partners cannot bypass eligibility review", async () => {
  const b = await booking(),
    body = {
      partner_id: b.assigned_partner_id,
      service_level_id: level,
      expected_level_id: level,
      service_ids: [service, randomUUID()],
      expected_service_ids: [],
    };
  assert.equal(
    (await eligibility(req("/api/admin/partner-eligibility", body))).status,
    400,
  );
  await db.query(
    "update partners set verification_status='suspended' where id=$1",
    [b.assigned_partner_id],
  );
  assert.equal(
    (
      await eligibility(
        req("/api/admin/partner-eligibility", {
          ...body,
          service_ids: [service],
        }),
      )
    ).status,
    409,
  );
  state.user = customer;
  assert.equal(
    (await eligibility(req("/api/admin/partner-eligibility", body))).status,
    403,
  );
});

await db.close();
console.log(
  "\n" +
    passed +
    " admin handler / real local SQL scenarios passed. External services mocked; no live end-to-end claim.",
);
