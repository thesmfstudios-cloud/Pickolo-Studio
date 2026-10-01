const assert = require('node:assert/strict');
const { validateRelease } = require('../scripts/validate-release.cjs');
const app = require('../app.json').expo;
const eas = require('../eas.json');
const configure = require('../app.config.js');
const valid = {
  EXPO_PUBLIC_API_BASE_URL: 'https://api.pickolo.test',
  EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_only_a_test_fixture_12345',
  EXPO_PUBLIC_EAS_PROJECT_ID: '00000000-0000-0000-0000-000000000001',
  EXPO_PUBLIC_SUPPORT_PHONE: '+919999999999',
};
assert.equal(validateRelease(valid, app, eas).errors.length, 0);
assert.equal(validateRelease({}, app, eas).errors.length, 4);
for (const endpoint of [
  'http://localhost:3000',
  'https://YOUR_PICKOLO_API_DOMAIN',
  'https://example.com',
  'https://api.invalid',
  'https://user:password@api.pickolo.test',
  'https://api.pickolo.test?secret=value',
])
  assert(
    validateRelease({ ...valid, EXPO_PUBLIC_API_BASE_URL: endpoint }, app, eas)
      .errors.length,
  );
for (const key of [
  'YOUR_ANON_KEY',
  'sb_secret_do_not_use_in_mobile',
  'bad.jwt.value',
])
  assert(
    validateRelease({ ...valid, EXPO_PUBLIC_SUPABASE_ANON_KEY: key }, app, eas)
      .errors.length,
  );
const jwt = (role) =>
  'header.' +
  Buffer.from(JSON.stringify({ role })).toString('base64url') +
  '.signature';
assert.equal(
  validateRelease(
    { ...valid, EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') },
    app,
    eas,
  ).errors.length,
  0,
);
assert(
  validateRelease(
    { ...valid, EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') },
    app,
    eas,
  ).errors.length,
);
assert(
  validateRelease(
    { ...valid, EXPO_PUBLIC_EAS_PROJECT_ID: 'not-a-project' },
    app,
    eas,
  ).errors.length,
);
assert(
  validateRelease(
    { ...valid, EXPO_PUBLIC_SUPPORT_PHONE: 'Call support' },
    app,
    eas,
  ).errors.length,
);
assert.equal(
  validateRelease({ ...valid, EXPO_PUBLIC_SUPPORT_PHONE: '' }, app, eas)
    .warnings.length,
  1,
);
assert(
  validateRelease(valid, { ...app, android: { package: 'wrong.app' } }, eas)
    .errors.length,
);
assert(validateRelease(valid, app, { build: {} }).errors.length);
const previous = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
try {
  delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  assert.equal(configure({ config: app }).extra?.eas?.projectId, undefined);
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID = valid.EXPO_PUBLIC_EAS_PROJECT_ID;
  assert.equal(
    configure({ config: app }).extra.eas.projectId,
    valid.EXPO_PUBLIC_EAS_PROJECT_ID,
  );
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID = 'invalid';
  assert.throws(() => configure({ config: app }), /must be the UUID/);
} finally {
  if (previous === undefined) delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  else process.env.EXPO_PUBLIC_EAS_PROJECT_ID = previous;
}
const picker = app.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
)[1];
assert.equal(picker.cameraPermission, false);
assert.equal(picker.microphonePermission, false);
assert.equal(app.userInterfaceStyle, 'light');
console.log(
  'PASS: release endpoint/public-key/project/profile guards, dynamic EAS identity and unused camera/microphone permission configuration. Fixtures are not real credentials.',
);
