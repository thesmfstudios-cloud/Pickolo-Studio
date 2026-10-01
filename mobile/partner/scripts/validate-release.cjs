const fs = require('node:fs');
const path = require('node:path');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateRelease(env, app, eas) {
  const errors = [],
    warnings = [];
  for (const name of ['EXPO_PUBLIC_API_BASE_URL', 'EXPO_PUBLIC_SUPABASE_URL']) {
    try {
      const url = new URL(env[name]);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.hash ||
        url.search ||
        /YOUR_|\.invalid$|(^|\.)example\.(com|org|net)$/i.test(url.hostname)
      )
        throw new Error();
    } catch {
      errors.push(name + ' must be a real HTTPS endpoint, not a placeholder.');
    }
  }
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
  let publicKey = /^sb_publishable_[a-zA-Z0-9_-]{16,}$/.test(key);
  if (!publicKey && key.split('.').length === 3) {
    try {
      publicKey =
        JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
          .role === 'anon';
    } catch {
      /* Invalid public key format. */
    }
  }
  if (!publicKey)
    errors.push(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY must be a public anon/publishable key, never a secret key.',
    );
  if (
    !UUID.test(
      env.EXPO_PUBLIC_EAS_PROJECT_ID || app.extra?.eas?.projectId || '',
    )
  )
    errors.push(
      'Configure the UUID of an existing Expo/EAS project for Android builds and push registration.',
    );
  if (app.android?.package !== 'com.smfstudios.pickolopartner')
    errors.push(
      'Partner Android package identity must remain com.smfstudios.pickolopartner.',
    );
  if (
    eas.build?.preview?.android?.buildType !== 'apk' ||
    eas.build?.preview?.distribution !== 'internal'
  )
    errors.push('Preview must be an internal Android APK build.');
  if (eas.build?.production?.android?.buildType !== 'app-bundle')
    errors.push('Production must explicitly build an Android App Bundle.');
  if (!env.EXPO_PUBLIC_SUPPORT_PHONE)
    warnings.push('Partner support phone is not configured.');
  else if (!/^\+?[0-9]{10,15}$/.test(env.EXPO_PUBLIC_SUPPORT_PHONE))
    errors.push('EXPO_PUBLIC_SUPPORT_PHONE must be a valid dialling number.');
  return { errors, warnings };
}
module.exports = { validateRelease };
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  // Load values without printing credentials; existing build environment wins.
  for (const file of [
    '.env.production.local',
    '.env.local',
    '.env.production',
    '.env',
  ]) {
    const filename = path.join(root, file);
    if (fs.existsSync(filename)) process.loadEnvFile(filename);
  }
  const app = JSON.parse(
    fs.readFileSync(path.join(root, 'app.json'), 'utf8'),
  ).expo;
  const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  const result = validateRelease(process.env, app, eas);
  for (const error of result.errors) console.error('BLOCKED: ' + error);
  for (const warning of result.warnings) console.warn('WARNING: ' + warning);
  if (result.errors.length) process.exitCode = 1;
  else
    console.log(
      'PASS: build configuration is present. This does not verify account access, credentials, live APIs or native build success.',
    );
}
