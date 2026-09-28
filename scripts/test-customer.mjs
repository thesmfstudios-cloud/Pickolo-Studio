import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,phone text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean);create table storage.objects(id uuid,name text,bucket_id text,owner_id text);
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
await db.close();
console.log(
  "PASS: all migrations, 15 photo prices, video/both multipliers, area/time/duration/policy validation, OTP privacy, wrong partner, lockout, start and replay.",
);
