import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server.js';
import ts from 'typescript';

// Actual Next handlers + actual SQL functions. Only Supabase auth/transport and
// Storage URL generation are replaced; no live credentials or database writes.
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,phone text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean);
create table storage.objects(id uuid,name text,bucket_id text,owner_id text);
grant usage on schema public,auth to authenticated,anon,service_role;`);
for (const file of fs
  .readdirSync('supabase/migrations')
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  await db.exec(
    fs
      .readFileSync('supabase/migrations/' + file, 'utf8')
      .replace('create extension if not exists pgcrypto;', ''),
  );
}
const customer = '00000000-0000-0000-0000-000000000001';
const partner = '00000000-0000-0000-0000-000000000002';
const otherPartner = '00000000-0000-0000-0000-000000000003';
await db.query('insert into auth.users(id) values($1),($2),($3)', [
  customer,
  partner,
  otherPartner,
]);
await db.query(
  "update public.profiles set role='partner' where id=$1 or id=$2",
  [partner, otherPartner],
);
await db.query(
  "insert into public.partners(id,partner_code,verification_status) values($1,'TEST','approved'),($2,'OTHER','approved')",
  [partner, otherPartner],
);
const photo = (
  await db.query("select id from public.services where name='Photography'")
).rows[0].id;
const basic = (
  await db.query("select id from public.service_levels where name='Basic'")
).rows[0].id;
await db.query('update public.partners set service_level_id=$1 where id=$2', [
  basic,
  partner,
]);
let state;
async function fresh() {
  await db.query(
    "update public.partners set verification_status='approved' where id=$1",
    [partner],
  );
  const booking = (
    await db.query(
      `insert into public.bookings(customer_id,service_id,service_level_id,scheduled_start,duration_minutes,location_text,location_lat,location_long,raw_policy_version,raw_policy_accepted_at)
  values($1,$2,$3,'2099-01-01',60,'Shahpura, Bhopal',23.184690686312052,77.43527393974985,'raw-v1',now()) returning *`,
      [customer, photo, basic],
    )
  ).rows[0];
  await db.query(
    "update public.bookings set assigned_partner_id=$1,status='DATA_PENDING',partner_acceptance_status='accepted' where id=$2",
    [partner, booking.id],
  );
  booking.assigned_partner_id = partner;
  booking.status = 'DATA_PENDING';
  state = { user: { id: partner }, booking, rpcCalls: [], queryCalls: [] };
  return booking;
}
async function putObject(name) {
  await db.query(
    "insert into storage.objects(id,name,bucket_id,owner_id) values(gen_random_uuid(),$1,'booking-deliveries',$2)",
    [name, partner],
  );
}
function asset(name = 'photo.jpg') {
  return {
    path: state.booking.id + '/' + name,
    fileName: name,
    mimeType: 'image/jpeg',
    sizeBytes: 3,
  };
}
const tables = new Set([
  'bookings',
  'partners',
  'profiles',
  'partner_performance',
  'payouts',
  'service_levels',
  'booking_status_history',
]);
function from(table) {
  assert(tables.has(table), 'Unexpected table: ' + table);
  const filters = [],
    updates = {};
  let sortColumn,
    ascending = true,
    limit;
  const execute = async (single = false) => {
    state.queryCalls.push(table);
    if (state.queryError === table)
      return { data: null, error: { message: 'Database unavailable' } };
    const params = [];
    const where = filters
      .map(([column, value]) => {
        params.push(value);
        return column + '=$' + params.length;
      })
      .join(' and ');
    let query;
    if (Object.keys(updates).length) {
      const assignments = Object.entries(updates).map(([column, value]) => {
        params.push(value);
        return column + '=$' + params.length;
      });
      query =
        'update public.' +
        table +
        ' set ' +
        assignments.join(',') +
        (where ? ' where ' + where : '') +
        ' returning *';
    } else
      query =
        'select * from public.' +
        table +
        (where ? ' where ' + where : '') +
        (sortColumn
          ? ' order by ' + sortColumn + (ascending ? ' asc' : ' desc')
          : '') +
        (limit ? ' limit ' + limit : '');
    try {
      const { rows } = await db.query(query, params);
      return { data: single ? (rows[0] ?? null) : rows, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }
  };
  const builder = {
    select: () => builder,
    eq: (column, value) => {
      assert.match(column, /^[a-z_]+$/);
      filters.push([column, value]);
      return builder;
    },
    order: (column, options = {}) => {
      assert.match(column, /^[a-z_]+$/);
      sortColumn = column;
      ascending = options.ascending !== false;
      return builder;
    },
    limit: (value) => {
      assert(Number.isInteger(value));
      limit = value;
      return builder;
    },
    update: (values) => {
      for (const key of Object.keys(values)) assert.match(key, /^[a-z_]+$/);
      Object.assign(updates, values);
      return builder;
    },
    single: () => execute(true),
    maybeSingle: () => execute(true),
    then: (resolve, reject) => execute().then(resolve, reject),
  };
  return builder;
}
const client = {
  auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
  from,
  storage: {
    from: (bucket) => {
      assert.equal(bucket, 'booking-deliveries');
      return {
        createSignedUrl: async (name) => {
          const exists = (
            await db.query(
              'select name from storage.objects where bucket_id=$1 and name=$2',
              [bucket, name],
            )
          ).rows.length;
          return exists && !state.storageError
            ? {
                data: { signedUrl: 'https://test.invalid/private' },
                error: null,
              }
            : { data: null, error: { message: 'Missing file' } };
        },
      };
    },
  },
  rpc: async (name, args) => {
    state.rpcCalls.push({ name, args });
    assert.equal(name, 'finalize_partner_delivery');
    if (state.rpcError) return { data: null, error: state.rpcError };
    try {
      const { rows } = await db.query(
        'select public.finalize_partner_delivery($1,$2,$3,$4::jsonb) as result',
        [
          args.p_booking_id,
          args.p_partner_id,
          args.p_customer_handoff_confirmed,
          JSON.stringify(args.p_assets),
        ],
      );
      return { data: rows[0].result, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }
  },
};
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const localRequire = (name) => {
    if (name === '@supabase/supabase-js') return { createClient: () => client };
    if (name === '@/lib/supabase-admin')
      return { getServiceClient: () => client };
    if (name.startsWith('@/'))
      return load(path.join(root, name.slice(2) + '.ts'));
    return require(name);
  };
  new Function('require', 'module', 'exports', js)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}
const finalize = load(
  'app/api/partner/jobs/[id]/delivery/finalize/route.ts',
).POST;
const transition = load('app/api/bookings/[id]/transition/route.ts').POST;
const profile = load('app/api/partner/profile/route.ts');
const performance = load('app/api/partner/performance/route.ts');
async function submit(assets = [asset()], confirmed = true) {
  const request = new NextRequest(
    'https://test.invalid/api/partner/jobs/' +
      state.booking.id +
      '/delivery/finalize',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assets, customer_handoff_confirmed: confirmed }),
    },
  );
  return finalize(request, {
    params: Promise.resolve({ id: state.booking.id }),
  });
}
async function rpc(
  assets,
  id = state.booking.id,
  userId = partner,
  confirmed = true,
) {
  return db.query(
    'select public.finalize_partner_delivery($1,$2,$3,$4::jsonb) as result',
    [id, userId, confirmed, JSON.stringify(assets)],
  );
}
const sqlAsset = (a) => ({
  storage_path: a.path,
  file_name: a.fileName,
  mime_type: a.mimeType,
  size_bytes: a.sizeBytes,
});
async function assertUntouched() {
  assert.equal(
    (
      await db.query('select status from public.bookings where id=$1', [
        state.booking.id,
      ])
    ).rows[0].status,
    'DATA_PENDING',
  );
  assert.equal(
    (
      await db.query(
        'select * from public.delivery_assets where booking_id=$1',
        [state.booking.id],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        'select * from public.delivery_records where booking_id=$1',
        [state.booking.id],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select * from public.booking_status_history where booking_id=$1 and to_status='DATA_SUBMITTED'",
        [state.booking.id],
      )
    ).rows.length,
    0,
  );
}
let passed = 0;
async function test(name, run) {
  await fresh();
  await run();
  passed++;
  console.log('PASS ' + name);
}
await test('handler requires authentication', async () => {
  state.user = null;
  assert.equal((await submit()).status, 401);
  await assertUntouched();
});
await test('handler rejects unapproved partner', async () => {
  await db.query(
    "update public.partners set verification_status='pending' where id=$1",
    [partner],
  );
  assert.equal((await submit()).status, 403);
  await assertUntouched();
});
await test('handler rejects another assigned partner', async () => {
  state.user.id = otherPartner;
  assert.equal((await submit()).status, 403);
  await assertUntouched();
});
await test('handler requires explicit customer handoff', async () => {
  assert.equal((await submit([asset()], false)).status, 400);
  assert.equal(state.rpcCalls.length, 0);
  await assertUntouched();
});
await test('handler rejects malformed JSON without performing delivery writes', async () => {
  const request = new NextRequest('https://test.invalid/api/delivery', {
    method: 'POST',
    body: '{invalid',
  });
  assert.equal(
    (
      await finalize(request, {
        params: Promise.resolve({ id: state.booking.id }),
      })
    ).status,
    400,
  );
  assert.equal(state.rpcCalls.length, 0);
  await assertUntouched();
});
await test('handler rejects invalid paths, metadata, sizes, duplicates and asset counts', async () => {
  const valid = asset();
  for (const assets of [
    [],
    Array(101).fill(valid),
    [valid, valid],
    [{ ...valid, path: customer + '/file.jpg' }],
    [{ ...valid, path: state.booking.id + '/../other.jpg' }],
    [{ ...valid, path: state.booking.id + '/%2e%2e.jpg' }],
    [{ ...valid, mimeType: 'application/pdf' }],
    [{ ...valid, fileName: '' }],
    [{ ...valid, fileName: 'x'.repeat(121) }],
    [{ ...valid, sizeBytes: -1 }],
    [{ ...valid, sizeBytes: '3' }],
    [{ ...valid, sizeBytes: 1.5 }],
    [{ ...valid, sizeBytes: 501 * 1024 * 1024 }],
    [null],
  ]) {
    assert.equal((await submit(assets)).status, 400, JSON.stringify(assets));
  }
  assert.equal(state.rpcCalls.length, 0);
  await assertUntouched();
});
await test('handler refuses missing Storage object', async () => {
  assert.equal((await submit()).status, 409);
  assert.equal(state.rpcCalls.length, 0);
  await assertUntouched();
});
await test('handler commits real SQL assets, delivery, status and handoff history', async () => {
  const a = asset();
  await putObject(a.path);
  const response = await submit([a]);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.assets.length, 1);
  assert.equal(result.delivery.booking_id, state.booking.id);
  assert.equal(
    (
      await db.query('select status from public.bookings where id=$1', [
        state.booking.id,
      ])
    ).rows[0].status,
    'DATA_SUBMITTED',
  );
  const history = (
    await db.query(
      "select metadata from public.booking_status_history where booking_id=$1 and to_status='DATA_SUBMITTED'",
      [state.booking.id],
    )
  ).rows;
  assert.equal(history.length, 1);
  assert.equal(history[0].metadata.customer_handoff, 'on_site');
});
await test('repeated submit returns conflict and cannot duplicate records', async () => {
  await putObject(asset().path);
  assert.equal((await submit()).status, 200);
  assert.equal((await submit()).status, 409);
  assert.equal(
    (
      await db.query(
        'select * from public.delivery_records where booking_id=$1',
        [state.booking.id],
      )
    ).rows.length,
    1,
  );
});
await test('two simultaneous handler submissions yield one saved delivery', async () => {
  await putObject(asset().path);
  const responses = await Promise.all([submit(), submit()]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );
  assert.equal(
    (
      await db.query(
        'select * from public.delivery_records where booking_id=$1',
        [state.booking.id],
      )
    ).rows.length,
    1,
  );
});
await test('handler maps RPC conflict, forbidden and database failure without false success', async () => {
  await putObject(asset().path);
  for (const [code, status] of [
    ['40001', 409],
    ['42501', 403],
    ['22023', 400],
    ['XX000', 500],
  ]) {
    state.rpcError = { code, message: 'Test rejection' };
    assert.equal((await submit()).status, status);
    await assertUntouched();
  }
});
await test('generic transition cannot bypass verified delivery', async () => {
  const request = new NextRequest(
    'https://test.invalid/api/bookings/' + state.booking.id + '/transition',
    { method: 'POST', body: JSON.stringify({ to_status: 'DATA_SUBMITTED' }) },
  );
  assert.equal(
    (
      await transition(request, {
        params: Promise.resolve({ id: state.booking.id }),
      })
    ).status,
    403,
  );
  await assertUntouched();
});
await test('database rejects direct DATA_SUBMITTED status update', async () => {
  await assert.rejects(
    () =>
      db.query(
        "update public.bookings set status='DATA_SUBMITTED' where id=$1",
        [state.booking.id],
      ),
    /verified delivery/,
  );
  await assertUntouched();
});
await test('SQL enforces wrong partner, approval and handoff under the booking lock', async () => {
  const a = sqlAsset(asset());
  await putObject(a.storage_path);
  await assert.rejects(
    () => rpc([a], state.booking.id, otherPartner),
    /access required/,
  );
  await assert.rejects(
    () => rpc([a], state.booking.id, partner, false),
    /handoff/,
  );
  await db.query(
    "update public.partners set verification_status='suspended' where id=$1",
    [partner],
  );
  await assert.rejects(() => rpc([a]), /access required/);
  await assertUntouched();
});
await test('SQL rollback removes earlier inserts when a later file is missing', async () => {
  const a = sqlAsset(asset('one.jpg')),
    b = sqlAsset(asset('missing.jpg'));
  await putObject(a.storage_path);
  await assert.rejects(() => rpc([a, b]), /not present/);
  await assertUntouched();
});
await test('SQL rollback removes records/status when history insert fails', async () => {
  const a = sqlAsset(asset());
  await putObject(a.storage_path);
  await db.exec(`create function public.test_history_failure() returns trigger language plpgsql as $$ begin raise exception 'Test history failure'; end $$;
  create trigger test_history_failure before insert on public.booking_status_history for each row execute function public.test_history_failure();`);
  try {
    await assert.rejects(() => rpc([a]), /Test history failure/);
    await assertUntouched();
  } finally {
    await db.exec(
      'drop trigger test_history_failure on public.booking_status_history; drop function public.test_history_failure();',
    );
  }
});
await test('SQL cannot resubmit after booking changes', async () => {
  await db.query("update public.bookings set status='CANCELLED' where id=$1", [
    state.booking.id,
  ]);
  await assert.rejects(() => rpc([sqlAsset(asset())]), /Booking changed/);
});
await test('SQL rejects duplicate/cross-booking paths and unsupported metadata', async () => {
  const a = sqlAsset(asset());
  await putObject(a.storage_path);
  for (const assets of [
    [a, a],
    [{ ...a, storage_path: customer + '/file.jpg' }],
    [{ ...a, mime_type: 'application/pdf' }],
    [{ ...a, size_bytes: 0 }],
    [],
    null,
  ]) {
    await assert.rejects(() => rpc(assets));
    await assertUntouched();
  }
});
await test('SQL successful multi-file delivery is immutable against repeat submission', async () => {
  const a = sqlAsset(asset('one.jpg')),
    b = { ...sqlAsset(asset('video.mp4')), mime_type: 'video/mp4' };
  await putObject(a.storage_path);
  await putObject(b.storage_path);
  const result = (await rpc([a, b])).rows[0].result;
  assert.equal(result.assets.length, 2);
  await assert.rejects(() => rpc([a, b]), /Booking changed/);
  assert.equal(
    (
      await db.query(
        'select * from public.delivery_assets where booking_id=$1',
        [state.booking.id],
      )
    ).rows.length,
    2,
  );
});
await test('verified delivery preserves customer confirmation, completion metrics and XP', async () => {
  const before = (
    await db.query(
      'select xp,completed_jobs from public.partner_performance where partner_id=$1',
      [partner],
    )
  ).rows[0] ?? { xp: 0, completed_jobs: 0 };
  await putObject(asset().path);
  assert.equal((await submit()).status, 200);
  for (const status of ['CUSTOMER_CONFIRMED', 'PAYOUT_RELEASED', 'COMPLETED'])
    await db.query('update public.bookings set status=$1 where id=$2', [
      status,
      state.booking.id,
    ]);
  const after = (
    await db.query(
      'select xp,completed_jobs from public.partner_performance where partner_id=$1',
      [partner],
    )
  ).rows[0];
  assert.equal(after.xp, before.xp + 100);
  assert.equal(after.completed_jobs, before.completed_jobs + 1);
  await db.query("update public.bookings set status='COMPLETED' where id=$1", [
    state.booking.id,
  ]);
  assert.equal(
    (
      await db.query(
        'select xp from public.partner_performance where partner_id=$1',
        [partner],
      )
    ).rows[0].xp,
    after.xp,
  );
});
await test('delivery RPC is unavailable to anonymous and authenticated clients', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role);
    try {
      await assert.rejects(() => rpc([sqlAsset(asset())]), /permission denied/);
    } finally {
      await db.exec('reset role');
    }
  }
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('service_role','public.finalize_partner_delivery(uuid,uuid,boolean,jsonb)','EXECUTE') as allowed",
      )
    ).rows[0].allowed,
    true,
  );
});
await test('profile PATCH validates, saves and clears genuine partner bio', async () => {
  for (const bio of [null, 123, 'x'.repeat(501)]) {
    assert.equal(
      (
        await profile.PATCH(
          new NextRequest('https://test.invalid/api/partner/profile', {
            method: 'PATCH',
            body: JSON.stringify({ bio }),
          }),
        )
      ).status,
      400,
    );
  }
  const response = await profile.PATCH(
    new NextRequest('https://test.invalid/api/partner/profile', {
      method: 'PATCH',
      body: JSON.stringify({ bio: ' Bhopal portrait photographer ' }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).partner.bio,
    'Bhopal portrait photographer',
  );
  const clear = await profile.PATCH(
    new NextRequest('https://test.invalid/api/partner/profile', {
      method: 'PATCH',
      body: JSON.stringify({ bio: '' }),
    }),
  );
  assert.equal((await clear.json()).partner.bio, null);
});
await test('performance reports database assigned level and surfaces failed queries', async () => {
  const request = new NextRequest(
    'https://test.invalid/api/partner/performance',
  );
  const response = await performance.GET(request);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.current_level.id, basic);
  assert.equal(result.levels.length, 3);
  for (const table of ['partner_performance', 'payouts', 'service_levels']) {
    state.queryError = table;
    assert.equal((await performance.GET(request)).status, 500);
  }
});
await test('existing portfolio Storage policy isolates owner reads and removals', async () => {
  await db.exec(
    'alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated; grant select on all tables in schema public to authenticated;',
  );
  await db.query(
    "insert into storage.objects(id,name,bucket_id,owner_id) values(gen_random_uuid(),$1,'partner-portfolio',$2),(gen_random_uuid(),$3,'partner-portfolio',$4)",
    [partner + '/mine.jpg', partner, otherPartner + '/other.jpg', otherPartner],
  );
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${partner}',false);`,
  );
  try {
    const visible = (
      await db.query(
        "select name from storage.objects where bucket_id='partner-portfolio'",
      )
    ).rows;
    assert.deepEqual(
      visible.map((file) => file.name),
      [partner + '/mine.jpg'],
    );
    assert.equal(
      (
        await db.query(
          "delete from storage.objects where bucket_id='partner-portfolio' and name=$1 returning name",
          [otherPartner + '/other.jpg'],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into storage.objects(id,name,bucket_id,owner_id) values(gen_random_uuid(),$1,'partner-portfolio',$2)",
          [otherPartner + '/forged.jpg', otherPartner],
        ),
      /row-level security/,
    );
    assert.equal(
      (
        await db.query(
          "delete from storage.objects where bucket_id='partner-portfolio' and name=$1 returning name",
          [partner + '/mine.jpg'],
        )
      ).rows.length,
      1,
    );
  } finally {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub','',false);",
    );
  }
});
await db.close();
console.log(
  `\n${passed} actual-handler/local-database scenarios passed. Supabase auth/transport and Storage signing were mocked.`,
);
