#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function exists(relative) {
  return fs.existsSync(path.join(root, relative));
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function required(relative) {
  if (!exists(relative)) failures.push(`Missing required file: ${relative}`);
}

const requiredFiles = [
  'README.md',
  '.env.example',
  '.nvmrc',
  'vercel.json',
  'next.config.ts',
  'docs/PROJECT_LOG.md',
  'docs/BUG_LOG.md',
  'docs/ROADMAP.md',
  'docs/TESTING.md',
  'docs/DATABASE.md',
  'docs/API.md',
  'docs/RELEASE_CHECKLIST.md',
  'mobile/package.json',
  'mobile/customer/.env.example',
  'mobile/partner/.env.example',
  'mobile/customer/app.json',
  'mobile/partner/app.json',
  'mobile/customer/eas.json',
  'mobile/partner/eas.json',
  'supabase/migrations/0018_profile_role_guard.sql',
  'supabase/migrations/0019_partner_privacy_geo_constraints.sql',
];

for (const file of requiredFiles) required(file);

const migrationDir = path.join(root, 'supabase', 'migrations');
if (fs.existsSync(migrationDir)) {
  const migrations = fs.readdirSync(migrationDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();

  migrations.forEach((name, index) => {
    const expected = String(index + 1).padStart(4, '0');
    if (!name.startsWith(expected + '_')) {
      failures.push(`Migration numbering gap/order error near ${name}; expected prefix ${expected}`);
    }
  });
}

const cronConfig = JSON.parse(read('vercel.json'));
for (const cron of cronConfig.crons ?? []) {
  const routePath = path.join(root, 'app', cron.path.replace(/^\//, ''), 'route.ts');
  if (!fs.existsSync(routePath)) failures.push(`Vercel cron route does not exist: ${cron.path}`);
  else if (!read(path.relative(root, routePath)).includes('export async function GET')) {
    failures.push(`Vercel cron route must export GET: ${cron.path}`);
  }
}

for (const relative of ['mobile/customer', 'mobile/partner']) {
  const pkgPath = path.join(relative, 'package.json').replaceAll(path.sep, '/');
  const pkg = JSON.parse(read(pkgPath));

  if (pkg.scripts?.typecheck !== 'tsc --noEmit') {
    failures.push(`${relative}/package.json missing typecheck script`);
  }

  if (pkg.dependencies?.['@supabase/supabase-js'] === 'latest') {
    failures.push(`${relative}/package.json must pin @supabase/supabase-js`);
  }

  if (pkg.dependencies?.['react-native-url-polyfill'] === 'latest') {
    failures.push(`${relative}/package.json must pin react-native-url-polyfill`);
  }

  if (!pkg.dependencies?.['expo-secure-store']) {
    failures.push(`${relative}/package.json missing expo-secure-store`);
  }
}


const mobileWorkspace = JSON.parse(read('mobile/package.json'));
if (!Array.isArray(mobileWorkspace.workspaces) ||
    !mobileWorkspace.workspaces.includes('customer') ||
    !mobileWorkspace.workspaces.includes('partner')) {
  failures.push('Mobile workspace must include customer and partner apps.');
}

const rootPackage = JSON.parse(read('package.json'));
if (rootPackage.dependencies?.['@supabase/supabase-js'] === 'latest') {
  failures.push('root package.json must pin @supabase/supabase-js');
}
if (rootPackage.devDependencies?.typescript !== '5.9.3') {
  failures.push('root package.json must pin TypeScript 5.9.3 for deterministic CI builds.');
}
if (rootPackage.devDependencies?.['@types/node'] !== '22.20.4') {
  failures.push('root package.json must pin @types/node 22.20.4 for the Node 22 CI target.');
}

const mobileCodeDirs = ['mobile/customer', 'mobile/partner', 'mobile/shared'];
for (const dir of mobileCodeDirs) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) continue;
  const stack = [base];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.expo', '.git'].includes(entry.name)) stack.push(full);
      } else if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf8');
        for (const forbidden of [
          'SUPABASE_SERVICE_ROLE_KEY',
          'RAZORPAY_KEY_SECRET',
          'RAZORPAY_WEBHOOK_SECRET',
        ]) {
          if (content.includes(forbidden)) {
            failures.push(`Server secret name found in mobile code: ${path.relative(root, full)}`);
          }
        }
      }
    }
  }
}

if (!read('mobile/shared/supabase.ts').includes('expo-secure-store')) {
  failures.push('Mobile Supabase client must use secure device storage.');
}

if (!read('mobile/partner/app/auth.tsx').includes("supabase.auth.signUp")) {
  failures.push('Partner auth must contain a working signup path.');
}
if (!read('mobile/partner/app/auth.tsx').includes("mode === 'signup' ? '/apply' : '/home'")) {
  failures.push('Partner signup must route through onboarding.');
}
if (!read('mobile/partner/app/home.tsx').includes("profile?.role === 'customer'")) {
  failures.push('Partner home must gate the workspace by profile role.');
}

if (!read('app/api/internal/notifications/dispatch/route.ts').includes("ticket?.status !== 'ok'")) {
  failures.push('Notification dispatcher must inspect individual Expo push tickets.');
}
if (!read('app/api/admin/partner-documents/route.ts').includes('storage_path')) {
  failures.push('Admin document review route must access private storage paths internally.');
}

if (!read('supabase/migrations/0018_profile_role_guard.sql').includes('auth.uid() = old.id')) {
  failures.push('Profile role guard must reject self role changes.');
}


const partnerRls = read('supabase/migrations/0019_partner_privacy_geo_constraints.sql');
if (!partnerRls.includes('drop policy if exists "partners_public_read_approved"') ||
    !partnerRls.includes('create policy "partners_owner_read"')) {
  failures.push('Partner base-location data must not remain publicly readable.');
}
if (!partnerRls.includes('bookings_location_lat_valid') ||
    !partnerRls.includes('bookings_location_long_valid') ||
    !partnerRls.includes('partners_base_lat_valid') ||
    !partnerRls.includes('partners_base_long_valid')) {
  failures.push('Geographic coordinate constraints missing from security migration.');
}

if (!exists('app/api/partner/jobs/[id]/delivery/route.ts')) {
  failures.push('Legacy delivery route missing unexpectedly.');
} else if (!read('app/api/partner/jobs/[id]/delivery/route.ts').includes('status: 410')) {
  failures.push('Legacy delivery route is not retired.');
}

if (failures.length) {
  console.error('Pickolo repository validation FAILED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}

console.log('Pickolo repository validation PASSED');
console.log(' - required architecture/docs present');
console.log(' - migrations sequential');
console.log(' - Vercel cron routes valid');
console.log(' - mobile typecheck scripts present');
console.log(' - mobile dependencies pinned');
console.log(' - secure mobile session storage present');
console.log(' - server secret names absent from mobile source');
console.log(' - partner signup and onboarding gate present');
console.log(' - Expo push ticket handling present');
console.log(' - profile role escalation guard present');
console.log(' - partner location privacy and geo constraints present');
console.log(' - legacy delivery write path retired');
