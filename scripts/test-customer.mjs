import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,phone text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,name text,bucket_id text,owner_id text);
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
grant usage on schema public,auth to authenticated,anon,service_role;`);
for (const file of fs
  .readdirSync("supabase/migrations")
  .filter((x) => x.endsWith(".sql"))
  .sort()) {
  const sql = fs
    .readFileSync("supabase/migrations/" + file, "utf8")
    .replace("create extension if not exists pgcrypto;", "");
  try {
    await db.exec(sql);
  } catch (e) {
    throw new Error(file + ": " + e.message);
  }
}
await db.exec(
  `grant select,insert,update on all tables in schema public to authenticated; revoke all on public.booking_start_codes from authenticated;`,
);
const customer = "00000000-0000-0000-0000-000000000001",
  partner = "00000000-0000-0000-0000-000000000002";
await db.query("insert into auth.users(id) values($1),($2)", [
  customer,
  partner,
]);
await db.exec(
  `insert into public.partners(id,partner_code,verification_status) values('${partner}','TEST','approved'); update public.service_area_settings set enabled=true;`,
);
const services = (await db.query("select id,name from public.services")).rows;
const levels = (await db.query("select id,name from public.service_levels"))
  .rows;
const photo = services.find((s) => s.name === "Photography").id;
const studioLat = 23.184690686312052;
const studioLng = 77.43527393974985;
const area = (
  await db.query(
    "select latitude,longitude,radius_km,enabled from public.service_area_settings where id=1",
  )
).rows[0];
assert.equal(Number(area.latitude), studioLat);
assert.equal(Number(area.longitude), studioLng);
assert.equal(Number(area.radius_km), 15);
assert.equal(area.enabled, true);
await db.exec(
  `set role authenticated;select set_config('request.jwt.claim.sub','${customer}',false);`,
);
const create = async ({
  service = photo,
  level = "Standard",
  minutes = 60,
  lat = studioLat,
  lng = studioLng,
  ack = true,
  start = "2099-01-01T10:00:00Z",
} = {}) =>
  (
    await db.query(
      "select * from public.create_customer_booking($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        service,
        levels.find((l) => l.name === level).id,
        start,
        minutes,
        "Test venue, Rohit Nagar",
        lat,
        lng,
        null,
        ack,
      ],
    )
  ).rows[0];
for (const [level, prices] of Object.entries({
  Basic: [600, 1000, 1400, 1800, 2200],
  Standard: [1000, 1500, 2000, 2500, 3000],
  Professional: [1500, 2500, 3500, 4500, 5500],
}))
  for (let i = 0; i < 5; i++) {
    const b = await create({ level, minutes: (i + 1) * 60 });
    assert.equal(Number(b.customer_price_paise), prices[i] * 100);
  }
assert.equal(
  Number(
    (
      await create({
        service: services.find((s) => s.name === "Videography").id,
      })
    ).customer_price_paise,
  ),
  150000,
);
assert.equal(
  Number(
    (await create({ service: services.find((s) => s.name === "Both").id }))
      .customer_price_paise,
  ),
  250000,
);
await create({ lat: studioLat + 14.9 / 111.195 });
await assert.rejects(
  () => create({ lat: studioLat + 15.1 / 111.195 }),
  /15 km/,
);
await assert.rejects(() => create({ lat: 24 }), /15 km/);
await assert.rejects(() => create({ ack: false }), /acknowledge/);
await assert.rejects(() => create({ minutes: 301 }), /Invalid/);
await assert.rejects(() => create({ start: "2000-01-01" }), /future/);
await assert.rejects(() => create({ lat: null }), /latitude/);
await assert.rejects(
  () => db.query("select * from public.booking_start_codes"),
  /permission denied/,
);
const b = await create();
const direct = await db.query(
  "insert into public.bookings(customer_id,service_id,service_level_id,scheduled_start,duration_minutes,location_text,location_lat,location_long,raw_policy_version,raw_policy_accepted_at,customer_price_paise) values($1,$2,$3,'2099-01-01',60,'Rohit Nagar',$4,$5,'raw-v1',now(),1) returning customer_price_paise",
  [
    customer,
    photo,
    levels.find((l) => l.name === "Standard").id,
    studioLat,
    studioLng,
  ],
);
assert.equal(Number(direct.rows[0].customer_price_paise), 100000);
await assert.rejects(
  () =>
    db.query(
      "insert into public.bookings(customer_id,service_id,service_level_id,scheduled_start,duration_minutes,location_text,location_lat,location_long) values($1,$2,$3,'2099-01-01',60,'Rohit Nagar',$4,$5)",
      [customer, photo, levels[0].id, studioLat, studioLng],
    ),
  /acknowledge/,
);
await db.exec(
  "select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false)",
);
assert.equal(
  (await db.query("select * from public.bookings where id=$1", [b.id])).rows
    .length,
  0,
);
await db.exec(
  `reset role;select set_config('request.jwt.claim.sub','',false);`,
);
await db.query(
  "update public.bookings set assigned_partner_id=$1,partner_acceptance_status='accepted',status='ON_THE_WAY' where id=$2",
  [partner, b.id],
);
await assert.rejects(
  () =>
    db.query("update public.bookings set status='SHOOT_STARTED' where id=$1", [
      b.id,
    ]),
  /Verify/,
);
await assert.rejects(
  () =>
    db.query("select public.verify_and_start_shoot($1,$2,$3)", [
      b.id,
      customer,
      "000000",
    ]),
  /not ready/,
);
for (let i = 0; i < 5; i++)
  assert.equal(
    (
      await db.query("select public.verify_and_start_shoot($1,$2,$3) as ok", [
        b.id,
        partner,
        "000000",
      ])
    ).rows[0].ok,
    false,
  );
const code = (
  await db.query(
    "select code from public.booking_start_codes where booking_id=$1",
    [b.id],
  )
).rows[0].code;
await assert.rejects(
  () =>
    db.query("select public.verify_and_start_shoot($1,$2,$3)", [
      b.id,
      partner,
      code,
    ]),
  /Too many/,
);
await db.query(
  "update public.booking_start_codes set last_attempt_at=now()-interval '16 minutes' where booking_id=$1",
  [b.id],
);
assert.equal(
  (
    await db.query("select public.verify_and_start_shoot($1,$2,$3) as ok", [
      b.id,
      partner,
      code,
    ])
  ).rows[0].ok,
  true,
);
assert.equal(
  (await db.query("select status from public.bookings where id=$1", [b.id]))
    .rows[0].status,
  "SHOOT_STARTED",
);
await assert.rejects(
  () =>
    db.query("select public.verify_and_start_shoot($1,$2,$3)", [
      b.id,
      partner,
      code,
    ]),
  /not ready/,
);
await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${customer}',false);`);
const deferred = await create({ minutes:120 });
await db.query('select public.request_pay_after_shoot($1)',[deferred.id]);
await db.query('select public.request_pay_after_shoot($1)',[deferred.id]);
assert.equal((await db.query('select status from public.bookings where id=$1',[deferred.id])).rows[0].status,'SEARCHING_PARTNER');
assert.equal((await db.query('select count(*)::int as n from public.payments where booking_id=$1',[deferred.id])).rows[0].n,0);
await assert.rejects(()=>db.query('select public.create_customer_payment_order($1,$2,$3)',[deferred.id,'order_fake',1]),/permission denied/);
await assert.rejects(()=>db.query('select public.store_server_payment_order($1,$2)',[deferred.id,'order_fake']),/permission denied/);
await assert.rejects(()=>db.query('select public.record_verified_payment($1,$2,$3,$4,$5)',[deferred.id,'order_fake','pay_fake',1,null]),/permission denied/);
await db.exec(`select set_config('request.jwt.claim.sub','${partner}',false);`);
await assert.rejects(()=>db.query('select public.request_pay_after_shoot($1)',[deferred.id]),/not found/);
await db.exec('reset role');
await db.query("update public.bookings set status='SHOOT_COMPLETED' where id=$1",[deferred.id]);
await assert.rejects(()=>db.query("update public.bookings set status='CUSTOMER_CONFIRMED' where id=$1",[deferred.id]),/Payment must/);
await assert.rejects(()=>db.query("update public.bookings set status='PAYOUT_RELEASED' where id=$1",[deferred.id]),/Payment must/);
await db.exec('set role service_role');
await db.query('select public.store_server_payment_order($1,$2)',[deferred.id,'order_test123']);
const reused = (await db.query('select (public.store_server_payment_order($1,$2)).provider_order_id as id',[deferred.id,'order_test456'])).rows[0];
assert.equal(reused.id,'order_test123');
await assert.rejects(()=>db.query('select public.record_verified_payment($1,$2,$3,$4,$5)',[deferred.id,'order_test123','pay_test123',1,null]),/does not match/);
await db.query('select public.record_verified_payment($1,$2,$3,$4,$5)',[deferred.id,'order_test123','pay_test123',150000,null]);
await db.query('select public.record_verified_payment($1,$2,$3,$4,$5)',[deferred.id,'order_test123','pay_test123',150000,null]);
await assert.rejects(()=>db.query('select public.record_verified_payment($1,$2,$3,$4,$5)',[deferred.id,'order_test123','pay_other',150000,null]),/different payment/);
await db.exec('reset role');
assert.equal((await db.query('select status from public.bookings where id=$1',[deferred.id])).rows[0].status,'SHOOT_COMPLETED');
assert.equal((await db.query('select status from public.payments where booking_id=$1',[deferred.id])).rows[0].status,'captured');
await db.query("update public.bookings set status='CUSTOMER_CONFIRMED' where id=$1",[deferred.id]);
await db.close();
console.log(
  "PASS: all migrations, pricing, geo/time/policy, OTP privacy/lockout/replay, deferred fulfilment, owner isolation, server-only payment writes, order reuse, amount tampering, capture retries, no status rewind and unpaid payout/delivery gates.",
);
