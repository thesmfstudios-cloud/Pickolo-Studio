import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// Execute the actual inspection SQL against disposable PostgreSQL only.
// No connection-string reader, remote client, user credentials or provider IO.
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key,phone text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean);
create table storage.objects(id uuid,name text,bucket_id text,owner_id text);
grant usage on schema public,auth to authenticated,anon,service_role;`);
const migrations = fs
  .readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .sort();
const sql = fs.readFileSync("scripts/admin-rollout-preflight.sql", "utf8");
let passed = 0;
async function report() {
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows);
    assert.equal(rows.length, 12);
    assert(
      rows.every(
        (row) =>
          Object.keys(row).sort().join() ===
          "check_name,failures,result,severity",
      ),
    );
    return Object.fromEntries(rows.map((row) => [row.check_name, row]));
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}
async function test(name, run) {
  await run();
  passed++;
  console.log("PASS " + name);
}
async function migration(name) {
  await db.exec(
    fs
      .readFileSync("supabase/migrations/" + name, "utf8")
      .replace("create extension if not exists pgcrypto;", ""),
  );
}
try {
  await test("missing base schema fails closed rather than returning healthy", async () => {
    await assert.rejects(report(), /does not exist/);
  });
  for (const name of migrations.filter(
    (n) => /^\d{4}_/.test(n) && !n.startsWith("0030_"),
  ))
    await migration(name);
  await test("historical baseline reports missing rollout RPCs without mutation", async () => {
    const r = await report();
    assert.equal(r.required_rpc_missing.result, "blocker");
    assert.equal(Number(r.required_rpc_missing.failures), 13);
    assert.equal(
      (await db.query("select count(*) n from partners")).rows[0].n,
      0,
    );
  });
  for (const name of migrations.filter(
    (n) => n.startsWith("0030_") || /^\d{14}_/.test(n),
  ))
    await migration(name);
  await test("complete clean fixture passes all checks and ends its read-only transaction", async () => {
    const r = await report();
    assert(Object.values(r).every((check) => check.result === "pass"));
    const id = randomUUID();
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query("delete from auth.users where id=$1", [id]);
  });
  await test("inspection transaction refuses accidental writes", async () => {
    const attempt = sql.replace(
      /rollback;\s*$/,
      "insert into public.profiles(id) values(gen_random_uuid()); rollback;",
    );
    try {
      await assert.rejects(db.exec(attempt), /read-only transaction/);
    } finally {
      await db.exec("rollback");
    }
    assert.equal(
      (await db.query("select count(*) n from profiles")).rows[0].n,
      0,
    );
  });
  await test("inactive Basic is an explicit blocker", async () => {
    await db.exec("update service_levels set active=false where name='Basic'");
    assert.equal((await report()).basic_level_unavailable.result, "blocker");
    await db.exec("update service_levels set active=true where name='Basic'");
  });
  await test("public or missing private bucket blocks rollout", async () => {
    await db.exec(
      "update storage.buckets set public=true where id='partner-documents'",
    );
    assert.equal(
      Number((await report()).private_buckets_unavailable.failures),
      1,
    );
    await db.exec(
      "update storage.buckets set public=false where id='partner-documents';delete from storage.buckets where id='partner-portfolio'",
    );
    assert.equal(
      Number((await report()).private_buckets_unavailable.failures),
      1,
    );
    await db.exec(
      "insert into storage.buckets(id,name,public) values('partner-portfolio','partner-portfolio',false)",
    );
  });
  await test("disabled RLS is detected", async () => {
    await db.exec("alter table public.profiles disable row level security");
    assert.equal((await report()).rls_not_enabled.result, "blocker");
    await db.exec("alter table public.profiles enable row level security");
  });
  await test("exposed RPC or absent service permission blocks rollout", async () => {
    await db.exec(
      "grant execute on function admin_review_application(uuid,uuid,text,text,text) to authenticated",
    );
    assert.equal((await report()).unsafe_rpc_permissions.result, "blocker");
    await db.exec(
      "revoke execute on function admin_review_application(uuid,uuid,text,text,text) from authenticated,service_role",
    );
    assert.equal((await report()).unsafe_rpc_permissions.result, "blocker");
    await db.exec(
      "grant execute on function admin_review_application(uuid,uuid,text,text,text) to service_role",
    );
  });
  const person = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [person]);
  await db.query(
    "insert into partners(id,partner_code,verification_status,is_accepting_jobs) values($1,'TEST-ONLY','suspended',true)",
    [person],
  );
  await test("suspended online partner is reported, never silently fixed", async () => {
    assert.equal(
      (await report()).unapproved_partner_still_online.result,
      "blocker",
    );
    assert.equal(
      (
        await db.query("select is_accepting_jobs from partners where id=$1", [
          person,
        ])
      ).rows[0].is_accepting_jobs,
      true,
    );
    await db.query(
      "update partners set is_accepting_jobs=false,verification_status='approved' where id=$1",
      [person],
    );
  });
  await test("legacy approval issues are review items and do not rewrite accounts", async () => {
    const r = await report();
    for (const check of [
      "approved_partner_missing_level",
      "approved_partner_missing_identity",
      "approved_partner_application_mismatch",
    ])
      assert.equal(r[check].result, "review");
    assert.equal(
      (
        await db.query("select service_level_id from partners where id=$1", [
          person,
        ])
      ).rows[0].service_level_id,
      null,
    );
  });
  await test("approved identity metadata without file is detected", async () => {
    await db.query(
      "insert into partner_verification_documents(partner_id,document_type,storage_path,file_name,mime_type,size_bytes,status) values($1,'identity','test-only/missing.jpg','test.jpg','image/jpeg',3,'approved')",
      [person],
    );
    assert.equal(
      (await report()).approved_identity_missing_file.result,
      "review",
    );
  });
  const bookings = (
    await db.query(
      `insert into bookings(customer_id,service_id,service_level_id,scheduled_start,duration_minutes,location_text,location_lat,location_long,raw_policy_version,raw_policy_accepted_at)
    select $1,(select id from services where name='Photography'),(select id from service_levels where name='Basic'),'2099-01-01',60,'Test Bhopal',23.18469,77.435274,'raw-v1',now() from generate_series(1,2) returning id`,
      [person],
    )
  ).rows;
  await db.query(
    "insert into payouts(booking_id,partner_id,amount_paise,status,provider_payout_id) values($1,$3,100,'released','pout_TestDuplicate'),($2,$3,100,'released','pout_TestOther')",
    [bookings[0].id, bookings[1].id, person],
  );
  await test("legacy released records require reconciliation, never mean paid", async () => {
    assert.equal(
      Number(
        (await report()).legacy_released_payout_needs_reconciliation.failures,
      ),
      2,
    );
  });
  await test("duplicate provider references are caught before unique-index rollout", async () => {
    await db.exec(
      "drop index public.payouts_provider_unique;update payouts set provider_payout_id='pout_TestDuplicate'",
    );
    assert.equal(
      Number((await report()).duplicate_provider_payout_refs.failures),
      1,
    );
    assert.equal(
      (await db.query("select count(*) n from payouts")).rows[0].n,
      2,
    );
  });
  console.log(
    `\n${passed} read-only rollout inspection scenarios passed. Disposable local DB, not live readiness.`,
  );
} finally {
  await db.close();
}
