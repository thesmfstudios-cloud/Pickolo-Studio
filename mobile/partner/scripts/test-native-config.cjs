const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const cli = path.join(
  path.dirname(require.resolve('expo/package.json')),
  'bin/cli',
);
const stdout = execFileSync(
  process.execPath,
  [cli, 'config', '--type', 'introspect', '--json'],
  {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    timeout: 45000,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
const config = JSON.parse(stdout);
const android = config._internal?.modResults?.android;
assert(
  android?.manifest?.manifest,
  'Expo must generate an Android manifest through config plugins.',
);
const permissions = android.manifest.manifest['uses-permission'] ?? [];
for (const name of [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
]) {
  const entry = permissions.find(
    (permission) => permission.$['android:name'] === name,
  );
  assert.equal(
    entry?.$['tools:node'],
    'remove',
    name + ' must be explicitly removed.',
  );
}
for (const name of [
  'android.permission.INTERNET',
  'android.permission.ACCESS_FINE_LOCATION',
])
  assert(
    permissions.some(
      (permission) =>
        permission.$['android:name'] === name &&
        permission.$['tools:node'] !== 'remove',
    ),
  );
assert.equal(config.android.package, 'com.smfstudios.pickolopartner');
assert.equal(config.userInterfaceStyle, 'light');
console.log(
  'PASS: actual Expo Android config-plugin introspection, unused camera/microphone removal, network/location permissions and package identity. Not an APK/Gradle build.',
);
