const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const projectId = '00000000-0000-0000-0000-000000000001';
const bookingId = '00000000-0000-0000-0000-000000000002';
const notification = (id = bookingId, identifier = 'notice-1') => ({
  notification: {
    request: { identifier, content: { data: { bookingId: id } } },
  },
});
const source = ts.transpileModule(
  fs.readFileSync(
    path.resolve(__dirname, '../shared/notifications.ts'),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function fixture(overrides = {}) {
  const state = {
    device: true,
    session: { access_token: 'test-token' },
    permission: 'granted',
    requested: 'granted',
    projectId,
    calls: [],
    routes: [],
    platform: 'android',
    registrations: [],
    ...overrides,
  };
  const mocks = {
    'expo-device': { isDevice: state.device },
    'expo-constants': {
      __esModule: true,
      default: {
        expoConfig: { extra: { eas: { projectId: state.projectId } } },
      },
    },
    'react-native': { Platform: { OS: state.platform } },
    'expo-router': { router: { push: (route) => state.routes.push(route) } },
    './supabase': {
      supabase: {
        auth: {
          getSession: async () => ({ data: { session: state.session } }),
        },
      },
    },
    'expo-notifications': {
      setNotificationHandler: () => {},
      AndroidImportance: { DEFAULT: 3 },
      addNotificationResponseReceivedListener: (listener) => {
        state.listener = listener;
        return {
          remove: () => {
            state.removed = true;
          },
        };
      },
      getLastNotificationResponse: () => state.initialResponse || null,
      setNotificationChannelAsync: async () => state.calls.push('channel'),
      getPermissionsAsync: async () => {
        state.calls.push('permissions');
        return { status: state.permission };
      },
      requestPermissionsAsync: async () => {
        state.calls.push('request');
        return { status: state.requested };
      },
      getExpoPushTokenAsync: async (options) => {
        assert.equal(options.projectId, projectId);
        state.calls.push('token');
        return { data: 'ExponentPushToken[test]' };
      },
    },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (name) => {
      assert(mocks[name], 'Unexpected import ' + name);
      return mocks[name];
    },
    module,
    module.exports,
  );
  global.fetch = async (url, options) => {
    state.registrations.push({ url, options, body: JSON.parse(options.body) });
    return { ok: !state.serverError };
  };
  return { state, register: module.exports.registerPushToken };
}
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log('PASS ' + name);
}
(async () => {
  const previousBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://test.invalid/';
  try {
    await test('Android channel precedes permissions and token; auth/project/role request retained', async () => {
      const { state, register } = fixture();
      assert.equal(await register('partner'), 'ExponentPushToken[test]');
      assert.deepEqual(state.calls, ['channel', 'permissions', 'token']);
      assert.equal(
        state.registrations[0].url,
        'https://test.invalid/api/notifications/register-token',
      );
      assert.equal(
        state.registrations[0].options.headers.Authorization,
        'Bearer test-token',
      );
      assert.equal(state.registrations[0].body.app_role, 'partner');
    });
    await test('permission denial creates no backend registration', async () => {
      const { state, register } = fixture({
        permission: 'denied',
        requested: 'denied',
      });
      assert.equal(await register('partner'), null);
      assert.deepEqual(state.calls, ['channel', 'permissions', 'request']);
      assert.equal(state.registrations.length, 0);
    });
    await test('missing project/config does not request native push token', async () => {
      const { state, register } = fixture({ projectId: null });
      assert.equal(await register('partner'), null);
      assert.equal(state.calls.length, 0);
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
      const next = fixture();
      assert.equal(await next.register('partner'), null);
      assert.equal(next.state.calls.length, 0);
      process.env.EXPO_PUBLIC_API_BASE_URL = 'https://test.invalid/';
    });
    await test('emulator and signed-out accounts skip push registration', async () => {
      for (const override of [{ device: false }, { session: null }]) {
        const { state, register } = fixture(override);
        assert.equal(await register('partner'), null);
        assert.equal(state.calls.length, 0);
      }
    });
    await test('partner notification tap opens exact assignment, not generic inbox', async () => {
      const { state, register } = fixture();
      await register('partner');
      state.listener(notification());
      assert.deepEqual(state.routes, [
        { pathname: '/job', params: { id: bookingId } },
      ]);
      state.listener(notification());
      assert.equal(state.routes.length, 1);
    });
    await test('cold-start response opens once and rejects malformed booking IDs', async () => {
      const { state, register } = fixture({ initialResponse: notification() });
      await register('partner');
      assert.equal(state.routes.length, 1);
      state.listener(notification('../other', 'bad'));
      assert.equal(state.routes.length, 1);
      await register('partner');
      assert.equal(state.routes.length, 1);
    });
    await test('customer push keeps booking-detail navigation and no Android-only channel', async () => {
      const { state, register } = fixture({ platform: 'ios' });
      await register('customer');
      state.listener(notification());
      assert.deepEqual(state.routes, [
        { pathname: '/booking-detail', params: { id: bookingId } },
      ]);
      assert.deepEqual(state.calls, ['permissions', 'token']);
    });
    await test('server rejects token registration without claiming success', async () => {
      const { register } = fixture({ serverError: true });
      assert.equal(await register('partner'), null);
    });
    console.log(
      `\n${passed} shared push-contract scenarios passed. Native notifications/auth/HTTP were mocked; this is not real push delivery.`,
    );
  } finally {
    if (previousBase === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = previousBase;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
