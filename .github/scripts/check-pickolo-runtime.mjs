import fs from 'node:fs/promises';
import dns from 'node:dns/promises';
const web = 'https://pickolo-studio.vercel.app';
const config = await fs.readFile('lib/supabase-config.ts', 'utf8');
const supabase = config.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
const publicKey = config.match(/"(sb_publishable_[^"]+)"/)?.[1];
if (!supabase || !publicKey) throw new Error('Unable to read checked-in public client configuration.');
const checks = [];
try { const address = await dns.lookup(new URL(supabase).hostname); checks.push({name:'Backend DNS',status:'PASS',detail:{family:address.family}}); }
catch(error) { checks.push({name:'Backend DNS',status:'BLOCKED',detail:{message:error.message,code:error.code}}); console.log(JSON.stringify(checks.at(-1))); }
async function check(name, url, accept, options = {}) {
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(25000), redirect: 'follow' });
    const raw = await response.text();
    let data; try { data = JSON.parse(raw); } catch { data = null; }
    const result = accept(response, data, raw);
    const record = { name, status: result.ok ? 'PASS' : 'FAIL', httpStatus: response.status, detail: result.detail };
    checks.push(record);
    console.log(JSON.stringify(record));
  } catch (error) {
    const record = { name, status: 'BLOCKED', detail: {message:error.message,cause:error.cause?.message,code:error.cause?.code} };
    checks.push(record); console.log(JSON.stringify(record));
  }
}
await check('Web landing', web, (r, d, text) => ({ ok: r.ok && text.includes('PICKOLO'), detail: r.ok ? 'Landing response received' : 'Landing unavailable' }));
for (const route of ['/api/bookings', '/api/partner/jobs', '/api/admin/metrics']) {
  await check('Anonymous authorization guard: ' + route, web + route, (r, d) => ({ ok: r.status === 401, detail: d?.error || 'Unexpected response' }));
}
await check('Invalid booking rejected without creation', web + '/api/bookings', (r, d) => ({ ok: r.status === 400, detail: d?.error || 'Unexpected response' }), { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
for (const level of ['Basic', 'Standard', 'Professional']) {
  await check('Live pricing: ' + level + ', 60 minutes', web + '/api/pricing?level=' + level + '&duration=60', (r, d) => ({ ok: r.ok && Number.isSafeInteger(d?.totalPaise) && d.totalPaise > 0 && d.currency === 'INR', detail: r.ok ? {currency:d?.currency,totalPaise:d?.totalPaise} : (d?.error || 'Price unavailable') }));
}
const headers = {apikey: publicKey};
await check('Public Auth provider settings', supabase + '/auth/v1/settings', (r, d) => ({ ok: r.ok && d?.external?.google === true, detail: r.ok ? {googleEnabled:d?.external?.google === true} : (d?.message || d?.error || 'Auth settings unavailable') }), {headers});
for (const table of ['services','service_levels','service_level_prices']) {
  await check('Active public catalog: ' + table, supabase + '/rest/v1/' + table + '?select=*&active=eq.true', (r, d) => ({ ok:r.ok && Array.isArray(d) && d.length > 0, detail: r.ok && Array.isArray(d) ? {activeRows:d.length, names:d.filter(x=>typeof x.name==='string').map(x=>x.name)} : (d?.message || d?.error || 'Catalog unavailable') }), {headers});
}
for (const table of ['bookings','profiles']) {
  await check('Anonymous isolation: ' + table, supabase + '/rest/v1/' + table + '?select=id&limit=1', (r, d) => ({ ok: (r.ok && Array.isArray(d) && d.length===0) || r.status===401 || r.status===403, detail: r.ok && Array.isArray(d) ? {visibleRowCount:d.length} : (d?.message || d?.error || 'Access denied or unavailable') }), {headers});
}
const mobile = JSON.parse(await fs.readFile('mobile/customer/app.json','utf8'));
const vercel = JSON.parse(await fs.readFile('vercel.json','utf8'));
const notes = [
  {name:'Native push identity',status: mobile.expo?.extra?.eas?.projectId ? 'SOURCE_CONFIG_PRESENT' : 'UNVERIFIED',detail:'Physical-device Expo/FCM credentials and push receipt still require verification.'},
  {name:'Background workers',status: vercel.crons?.length ? 'VERCEL_CRONS_PRESENT' : 'UNVERIFIED',detail:'No Vercel crons are declared in checked-in vercel.json; an external scheduler has not been verified.'},
  {name:'Privileged infrastructure',status:'BLOCKED',detail:'Current connected Supabase management account exposes the old inactive project, not the app backend. The SMF Vercel workspace and variable inventory are verified in Chrome; server-secret correctness and actual payment sandbox transactions are not yet verified.'},
  {name:'Device and authenticated isolation',status:'UNVERIFIED',detail:'APK installation, native OAuth callback, two-customer isolation, Partner/Admin role tests, payments and delivery require their real test sessions.'}
];
const report = {generatedAt:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA,web,backendProject:new URL(supabase).hostname.split('.')[0],scope:'Public read-only integration checks and an empty invalid booking request; no user account, booking, payment, payout or private database mutation.',checks,notes};
await fs.mkdir('readiness-report',{recursive:true});
await fs.writeFile('readiness-report/pickolo-readiness.json',JSON.stringify(report,null,2)+'\n');
const failures=checks.filter(x=>x.status!=='PASS');
await fs.writeFile('readiness-report/SUMMARY.md','# Pickolo readiness checks\n\n'+checks.map(x=>'- '+x.status+' — '+x.name+' ('+(x.httpStatus||'network')+')').join('\n')+'\n\nPrivate infrastructure and device tests remain separate gates.\n');
if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,await fs.readFile('readiness-report/SUMMARY.md','utf8'));
process.exitCode=failures.length?1:0;
