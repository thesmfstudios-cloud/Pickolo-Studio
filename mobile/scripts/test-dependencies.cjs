const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
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
  queryString.parse('city=Bhopal&name=%E0%A4%A8%E0%A4%BE%E0%A4%AE').city,
  'Bhopal',
);
assert.equal(
  queryString.parse(queryString.stringify({ id: 'booking', mode: 'shoot' }))
    .mode,
  'shoot',
);
console.log(
  'PASS: patched UUID bounds, CommonJS compatibility, Xcode project identifiers and current router query-string contract.',
);
