const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mobile = require('../package.json');
for (const app of ['partner', 'customer']) {
  const manifest = require('../' + app + '/package.json');
  assert.equal(
    manifest.dependencies['react-native'],
    mobile.dependencies['react-native'],
    app +
      ' must declare the shared native runtime rather than relying on npm-version-specific workspace overrides.',
  );
}
assert.equal(
  require('react-native/package.json').version,
  mobile.dependencies['react-native'],
);
assert.equal(
  require('@react-native/metro-config/package.json').version,
  mobile.dependencies['react-native'],
);
const xcode = require('xcode');
const xcodeRequire = createRequire(require.resolve('xcode'));
const uuid = xcodeRequire('uuid');
assert.equal(xcodeRequire('uuid/package.json').version, '11.1.1');
assert.match(uuid.v4(), /^[0-9a-f-]{36}$/);
assert.throws(
  () => uuid.v5('x', uuid.v5.DNS, new Uint8Array(8), 4),
  RangeError,
);
const project = xcode.project('compatibility-test.pbxproj');
project.hash = { project: { objects: {} } };
for (let index = 0; index < 100; index++)
  assert.match(project.generateUuid(), /^[0-9A-F]{24}$/);
const queryString = require('query-string');
assert.equal(
  JSON.parse(
    fs.readFileSync(
      path.join(
        path.dirname(require.resolve('decode-uri-component')),
        'package.json',
      ),
      'utf8',
    ),
  ).version,
  '0.5.0',
);
assert.equal(
  queryString.parse('city=Bhopal&name=%E0%A4%A8%E0%A4%BE%E0%A4%AE').city,
  'Bhopal',
);
assert.equal(
  queryString.parse(queryString.stringify({ id: 'booking', mode: 'shoot' }))
    .mode,
  'shoot',
);
assert.equal(queryString.parse('name=%E0%A4%A8%E0%A4%BE%E0%A4%AE').name, 'नाम');
assert.equal(queryString.parse('name=a+b').name, 'a b');
assert.deepEqual([...queryString.parse('id=one&id=two').id], ['one', 'two']);
assert.equal(queryString.parse('path=a%2Fb').path, 'a/b');
// Run malformed-input regressions in a bounded child so a vulnerable decoder
// cannot hang the whole test job. The official scanner must return promptly.
execFileSync(
  process.execPath,
  [
    '-e',
    `const assert = require('node:assert/strict'); const q = require('query-string'); for (const bytes of ['%C0','%EA','%FF','%E0%A4']) { const input = bytes.repeat(10000); const output = q.parse('value=' + input).value; assert.equal(typeof output, 'string'); assert(output.length <= input.length); }`,
  ],
  { cwd: path.resolve(__dirname, '..'), timeout: 7000, stdio: 'pipe' },
);
console.log(
  'PASS: patched UUID bounds, Xcode identifiers, decoder 0.5.0 interop, Unicode/URL query contracts and bounded malformed-input regressions.',
);
