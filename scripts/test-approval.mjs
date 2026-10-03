import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import React from "react";
import { create, act } from "react-test-renderer";
process.on("uncaughtException", (error) => {
  console.error(error.message);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  console.error(error.message);
  process.exit(1);
});

// Disposable Postgres + actual route/UI code. No production users, tokens or files.
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,phone text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),name text,bucket_id text,owner_id text);
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
grant usage on schema public,auth to authenticated,anon,service_role;`);
for (const name of fs
  .readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .sort())
  try {
    await db.exec(
      fs
        .readFileSync("supabase/migrations/" + name, "utf8")
        .replace("create extension if not exists pgcrypto;", ""),
    );
  } catch (error) {
    console.error("Migration fixture failure:", name, error.message);
    process.exit(1);
  }
await db.exec(`grant usage on schema public,storage to service_role;
grant all on all tables in schema public to service_role;
grant select,update on storage.objects to service_role;`);
const owner = randomUUID(),
  applicant = randomUUID(),
  second = randomUUID();
await db.query("insert into auth.users(id) values($1),($2),($3)", [
  owner,
  applicant,
  second,
]);
await db.query("update public.profiles set role='admin' where id=$1", [owner]);
await db.exec(
  "insert into public.service_levels(name,description,sort_order) values('Basic','Synthetic basic level',0) on conflict(name) do nothing",
);
const app = randomUUID(),
  doc = randomUUID(),
  missing = randomUUID();
await db.query(
  `insert into partner_applications(id,applicant_id,display_name,phone,service_types,payout_upi_id)
values($1,$2,'Synthetic Partner','9999999999',array['Photography','Videography'],'synthetic@upi')`,
  [app, applicant],
);
await db.query(
  `insert into partner_verification_documents(id,applicant_id,document_type,file_name,storage_path,mime_type,size_bytes)
values($1,$2,'identity','synthetic.jpg','test/identity.jpg','image/jpeg',100),($3,$2,'identity','missing.jpg','test/missing.jpg','image/jpeg',100)`,
  [doc, applicant, missing],
);
await db.exec(
  "insert into storage.objects(name,bucket_id) values('test/identity.jpg','partner-documents')",
);
const require = createRequire(import.meta.url);
let currentUser = owner,
  rpcOverride,
  rpcCount = 0,
  uiMode = false;
const profileQuery = {
  select() {
    return this;
  },
  eq() {
    return this;
  },
  async single() {
    return {
      data: { role: currentUser === owner ? "admin" : "customer" },
      error: null,
    };
  },
};
const client = {
  auth: {
    async getUser() {
      return {
        data: { user: currentUser ? { id: currentUser } : null },
        error: null,
      };
    },
    async getSession() {
      return { data: { session: { access_token: "synthetic" } } };
    },
  },
  from() {
    return profileQuery;
  },
};
const service = {
  async rpc(name, args) {
    rpcCount++;
    if (rpcOverride) return rpcOverride;
    try {
      await db.exec("begin; set local role service_role;");
      const data = (
        await db.query(`select public.${name}($1,$2,$3,$4,$5) as result`, [
          args.p_actor,
          args.p_id,
          args.p_action ?? args.p_status,
          args.p_expected,
          args.p_reason,
        ])
      ).rows[0].result;
      await db.exec("commit");
      return { data, error: null };
    } catch (error) {
      await db.exec("rollback");
      return {
        data: null,
        error: { code: error.code, message: error.message },
      };
    }
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
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const local = (name) =>
    name === "@supabase/supabase-js"
      ? { createClient: () => client }
      : name === "@/lib/supabase-admin"
        ? { getServiceClient: () => service }
        : name === "@/lib/supabase-config"
          ? {
              SUPABASE_URL: "https://synthetic.invalid",
              SUPABASE_PUBLIC_KEY: "synthetic",
            }
          : name === "@/lib/supabase"
            ? { supabase: client }
            : name.startsWith("@/")
              ? load(name.slice(2) + ".ts")
              : require(name === "next/server" ? "next/server.js" : name);
  new Function("require", "module", "exports", code)(
    local,
    module,
    module.exports,
  );
  return module.exports;
}
const appPost = load("app/api/admin/partners/[id]/verify/route.ts").POST;
const docPost = load("app/api/admin/partner-documents/route.ts").POST;
async function call(kind, id, body, auth = true) {
  const req = new Request("https://synthetic.invalid/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: "Bearer synthetic" } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return kind === "application"
    ? appPost(req, { params: Promise.resolve({ id }) })
    : docPost(req);
}
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
await check("missing token never invokes privileged RPC", async () => {
  const before = rpcCount;
  assert.equal(
    (await call("application", app, { action: "approve" }, false)).status,
    401,
  );
  assert.equal(rpcCount, before);
});
await check("non-admin cannot review", async () => {
  currentUser = applicant;
  assert.equal(
    (await call("application", app, { action: "approve" })).status,
    403,
  );
  currentUser = owner;
});
await check("expired authenticated session cannot review", async () => {
  currentUser = null;
  assert.equal(
    (await call("application", app, { action: "approve" })).status,
    401,
  );
  currentUser = owner;
});
await check("malformed JSON and invalid UUID return 400", async () => {
  assert.equal((await call("application", app, "{")).status, 400);
  assert.equal(
    (await call("application", "invalid", { action: "approve" })).status,
    400,
  );
});
await check("identity gate prevents premature partner creation", async () => {
  const res = await call("application", app, { action: "approve" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /identity document/);
  assert.equal(
    (await db.query("select count(*)::int n from partners")).rows[0].n,
    0,
  );
});
await check("missing real file cannot be approved", async () => {
  const res = await call("document", missing, {
    id: missing,
    status: "approved",
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /upload again/);
});
await check(
  "document review writes status, audit and notification",
  async () => {
    const res = await call("document", doc, { id: doc, status: "approved" });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("cache-control"), /no-store/);
    assert.equal(
      (
        await db.query(
          "select status from partner_verification_documents where id=$1",
          [doc],
        )
      ).rows[0].status,
      "approved",
    );
  },
);
await check(
  "approval inserts partner and both services atomically, preserving Basic",
  async () => {
    const res = await call("application", app, {
      action: "approve",
      expected_status: "pending",
    });
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    assert.equal(
      (await db.query("select role from profiles where id=$1", [applicant]))
        .rows[0].role,
      "partner",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from partner_services where partner_id=$1",
          [applicant],
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query(
          "select l.name from partners p join service_levels l on l.id=p.service_level_id where p.id=$1",
          [applicant],
        )
      ).rows[0].name,
      "Basic",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from notifications where user_id=$1",
          [applicant],
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from admin_audit_log where actor_id=$1",
          [owner],
        )
      ).rows[0].n,
      2,
    );
  },
);
await check(
  "double submit is rejected without duplicate audit/notification",
  async () => {
    assert.equal(
      (await call("application", app, { action: "approve" })).status,
      409,
    );
    assert.equal(
      (await call("document", doc, { id: doc, status: "approved" })).status,
      409,
    );
    assert.equal(
      (await db.query("select count(*)::int n from admin_audit_log")).rows[0].n,
      2,
    );
  },
);
await check("RPC rejects forged non-admin actor", async () => {
  const res = await service.rpc("partner_review_application_v1", {
    p_actor: applicant,
    p_id: app,
    p_action: "approve",
    p_expected: "approved",
    p_reason: "",
  });
  assert.equal(res.error.code, "42501");
});
await check(
  "RPC execute privileges are server-only; RLS stays enabled",
  async () => {
    for (const role of ["anon", "authenticated"])
      assert.equal(
        (
          await db.query(
            "select has_function_privilege($1,'public.partner_review_application_v1(uuid,uuid,text,text,text)','execute') allowed",
            [role],
          )
        ).rows[0].allowed,
        false,
      );
    assert.equal(
      (
        await db.query(
          "select relrowsecurity from pg_class where oid='public.partners'::regclass",
        )
      ).rows[0].relrowsecurity,
      true,
    );
  },
);
await check("admin applicant cannot lose owner role", async () => {
  const adminApp = randomUUID();
  await db.query(
    "insert into partner_applications(id,applicant_id,display_name) values($1,$2,'Synthetic Owner')",
    [adminApp, owner],
  );
  assert.equal(
    (await call("application", adminApp, { action: "approve" })).status,
    403,
  );
});
await check(
  "late audit failure rolls back document status and notification",
  async () => {
    await db.exec(
      "create function public.synthetic_fail_audit() returns trigger language plpgsql as $$begin raise exception 'synthetic failure'; end;$$; create trigger synthetic_fail before insert on admin_audit_log for each row execute function synthetic_fail_audit()",
    );
    const res = await call("document", missing, {
      id: missing,
      status: "rejected",
    });
    assert.equal(res.status, 500);
    assert.equal(
      (
        await db.query(
          "select status from partner_verification_documents where id=$1",
          [missing],
        )
      ).rows[0].status,
      "pending",
    );
    await db.exec(
      "drop trigger synthetic_fail on admin_audit_log; drop function synthetic_fail_audit()",
    );
  },
);
await check("missing migration surfaces actionable 503", async () => {
  rpcOverride = { data: null, error: { code: "PGRST202" } };
  assert.equal(
    (await call("application", app, { action: "approve" })).status,
    503,
  );
  rpcOverride = null;
});
await check(
  "invalid document review and missing application are not success",
  async () => {
    assert.equal(
      (await call("document", doc, { id: doc, status: "suspended" })).status,
      400,
    );
    assert.equal(
      (await call("application", randomUUID(), { action: "approve" })).status,
      404,
    );
  },
);
await check(
  "rejection of missing file records correction without approving it",
  async () => {
    assert.equal(
      (await call("document", missing, { id: missing, status: "rejected" }))
        .status,
      200,
    );
    assert.equal(
      (
        await db.query(
          "select status from partner_verification_documents where id=$1",
          [missing],
        )
      ).rows[0].status,
      "rejected",
    );
  },
);
// Actual admin page interactions with synthetic fetches.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalError = console.error;
console.error = (...args) => {
  if (!String(args[0]).includes("react-test-renderer is deprecated"))
    originalError(...args);
};
globalThis.window = { location: { href: "" } };
let postFailure = true,
  waitPost,
  resolvePost,
  posts = 0,
  renderer;
globalThis.fetch = async (url, opts = {}) => {
  if (opts.method === "POST") {
    posts++;
    if (waitPost) await waitPost;
    return new Response(
      JSON.stringify(
        postFailure
          ? { error: "Synthetic approval failure near button" }
          : { application: { id: app, status: "approved" } },
      ),
      { status: postFailure ? 400 : 200 },
    );
  }
  const data = url.includes("partner-documents")
    ? {
        documents: [
          {
            id: doc,
            applicant_id: applicant,
            status: "approved",
            file_name: "synthetic.jpg",
            document_type: "identity",
            created_at: "2026-01-01",
          },
        ],
      }
    : url.includes("partners?")
      ? {
          applications: [
            {
              id: app,
              applicant_id: applicant,
              display_name: "Synthetic Partner",
              status: "pending",
              created_at: "2026-01-01",
            },
          ],
        }
      : url.includes("metrics")
        ? { error: "unavailable" }
        : url.includes("partner-directory")
          ? { partners: [] }
          : url.includes("pricing")
            ? { pricing: [] }
            : url.includes("disputes")
              ? { disputes: [] }
              : { bookings: [] };
  return new Response(JSON.stringify(data), {
    status: url.includes("metrics") ? 500 : 200,
  });
};
const Page = load("app/admin/page.tsx").default;
const screen = () => JSON.stringify(renderer.toJSON());
const approve = () =>
  renderer.root
    .findAllByType("button")
    .find((b) => b.children.join("") === "Approve");
await check(
  "page tolerates metrics failure and displays approved document history",
  async () => {
    await act(async () => {
      renderer = create(React.createElement(Page));
    });
    assert.match(screen(), /APPROVED/);
    assert.match(screen(), /Synthetic Partner/);
  },
);
await check(
  "local button feedback shows server errors and allows retry",
  async () => {
    await act(async () => {
      await approve().props.onClick();
    });
    assert.match(screen(), /Synthetic approval failure near button/);
    assert.equal(approve().props.disabled, false);
  },
);
await check("in-flight duplicate click sends only one request", async () => {
  waitPost = new Promise((r) => (resolvePost = r));
  let action;
  const before = posts;
  const handler = approve().props.onClick;
  await act(async () => {
    action = handler();
    await Promise.resolve();
    await handler();
  });
  assert.equal(posts, before + 1);
  assert.match(screen(), /Saving/);
  await act(async () => {
    resolvePost();
    await action;
  });
  waitPost = null;
});
await check(
  "successful approval displays persistent section notice",
  async () => {
    postFailure = false;
    await act(async () => {
      await approve().props.onClick();
    });
    assert.match(screen(), /Saved successfully/);
  },
);
await act(async () => renderer.unmount());
console.error = originalError;
await db.close();
console.log(`${passed} approval checks passed.`);
