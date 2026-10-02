import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Execute the actual screen components and their event handlers. Only native
// device modules, navigation, Supabase and HTTP are mocked; this is not device QA.
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(base, 'package.json'));
const React = require('react');
const { create, act } = require('react-test-renderer');
const ts = require('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
process.env.EXPO_PUBLIC_API_BASE_URL = 'https://test.invalid';
let state, renderer;
const originalError = console.error;
console.error = (...args) => {
  if (!String(args[0]).includes('react-test-renderer is deprecated'))
    originalError(...args);
};
const partner = {
  id: 'partner',
  partner_code: 'PK-TEST',
  verification_status: 'approved',
  is_accepting_jobs: false,
  payout_upi_id: 'test@upi',
};
const performance = {
  completed_jobs: 2,
  delivered_jobs: 1,
  on_time_jobs: 1,
  cancellations: 0,
  no_shows: 0,
  average_rating: 4.2,
  xp: 40,
};
const job = {
  id: 'booking',
  booking_code: 'PK-REAL',
  status: 'ON_THE_WAY',
  partner_acceptance_status: 'accepted',
  scheduled_start: '2099-02-02T10:00:00Z',
  duration_minutes: 60,
  location_text: 'Shahpura, Bhopal',
  location_lat: 23.2,
  location_long: 77.4,
  service: { name: 'Photography' },
};
function reset(overrides = {}) {
  state = {
    session: { access_token: 'test-token' },
    user: {
      id: 'partner',
      email: 'test@example.invalid',
      user_metadata: { full_name: 'Test Creator' },
    },
    role: 'partner',
    routes: [],
    alerts: [],
    calls: [],
    uploads: [],
    permission: true,
    pickerAssets: [],
    docs: [],
    application: null,
    jobs: [],
    partner: { ...partner },
    performance: { ...performance },
    payouts: [],
    notices: [],
    slots: [],
    portfolio: [],
    levels: [
      {
        id: 'basic',
        name: 'Basic',
        description: 'Entry-level creators',
        sort_order: 1,
      },
      {
        id: 'standard',
        name: 'Standard',
        description: 'Experienced creators',
        sort_order: 2,
      },
    ],
    currentLevel: {
      id: 'basic',
      name: 'Basic',
      description: 'Entry-level creators',
      sort_order: 1,
    },
    authCalls: [],
    params: { id: 'booking' },
    ...overrides,
  };
}
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
globalThis.fetch = async (url, options = {}) => {
  const endpoint = new URL(url).pathname;
  const body = options.body ? JSON.parse(options.body) : null;
  state.calls.push({ endpoint, options, body });
  if (state.networkError) throw new TypeError('Network request failed');
  if (state.failPath === endpoint)
    return response(
      { error: 'Server refused request' },
      state.failStatus || 409,
    );
  if (options.headers?.Authorization !== 'Bearer test-token')
    throw new Error('Missing auth header');
  if (endpoint === '/api/partner/application')
    return response({ application: state.application });
  if (endpoint === '/api/partner/profile') {
    if (options.method === 'PATCH') Object.assign(state.partner, body);
    return response({ partner: { ...state.partner } });
  }
  if (endpoint === '/api/partner/performance')
    return response({
      performance: state.performance,
      payouts: state.payouts,
      levels: state.levels,
      current_level: state.currentLevel,
    });
  if (endpoint === '/api/partner/jobs') return response({ jobs: state.jobs });
  if (endpoint === '/api/partner/availability') {
    if (options.method === 'POST')
      state.slots.push({ id: 'slot', available: true, ...body });
    return response({ availability: state.slots });
  }
  if (endpoint === '/api/notifications')
    return response({ notifications: state.notices });
  if (endpoint === '/api/notifications/read') {
    state.notices.find((n) => n.id === body.id).read_at = '2099-01-01';
    return response({ ok: true });
  }
  if (endpoint === '/api/partner/apply') {
    assert.match(body.payout_upi_id, /@/);
    state.application = { ...body, status: 'pending' };
    return response({ application: state.application }, 201);
  }
  if (endpoint === '/api/partner/documents')
    return response({ documents: state.docs });
  if (endpoint.endsWith('/upload-url')) {
    const info = {
      path: 'booking/test.jpg',
      token: 'signed-test-token',
      fileName: body.file_name,
      mimeType: body.mime_type,
      sizeBytes: body.size_bytes,
    };
    if (endpoint.includes('/documents/'))
      state.docs.push({
        id: 'doc',
        file_name: body.file_name,
        document_type: body.document_type,
        status: 'pending',
      });
    return response(info);
  }
  if (endpoint.endsWith('/respond')) {
    if (body.action === 'accept')
      state.jobs = state.jobs.map((j) => ({
        ...j,
        partner_acceptance_status: 'accepted',
      }));
    else state.jobs = [];
    return response({ ok: true });
  }
  if (endpoint.endsWith('/transition')) {
    state.jobs = state.jobs.map((j) => ({ ...j, status: body.to_status }));
    return response({ ok: true });
  }
  if (endpoint.endsWith('/cancel')) {
    state.jobs = [];
    return response({ ok: true });
  }
  if (endpoint.endsWith('/finalize')) {
    assert(body.assets.length);
    assert.equal(
      body.customer_handoff_confirmed,
      true,
      'API requires on-site customer handoff confirmation',
    );
    return response({ ok: true });
  }
  throw new Error('Unexpected endpoint ' + endpoint);
};
const supabase = {
  auth: {
    getSession: async () => {
      if (state.sessionThrows) throw new Error('Secure storage failed');
      return { data: { session: state.session } };
    },
    getUser: async () => ({ data: { user: state.user } }),
    signInWithPassword: async (args) => {
      state.authCalls.push(args);
      if (state.authThrows) throw new Error('offline');
      return { data: { session: state.session }, error: state.authError };
    },
    signUp: async (args) => {
      state.authCalls.push(args);
      if (state.authThrows) throw new Error('offline');
      return {
        data: { session: state.signupConfirmation ? null : state.session },
        error: state.authError,
      };
    },
    signOut: async () => ({ error: state.authError }),
    resend: async (args) => {
      state.authCalls.push(args);
      if (state.authThrows) throw new Error('offline');
      if (state.resendPending) await state.resendPending;
      return { data: {}, error: state.authError };
    },
  },
  from: () => ({
    select: () => ({
      eq: () => ({ single: async () => ({ data: { role: state.role } }) }),
    }),
  }),
  storage: {
    from: (bucket) => ({
      list: async (ownerId) => {
        assert.equal(bucket, 'partner-portfolio');
        assert.equal(ownerId, state.user.id);
        if (state.networkError || state.portfolioError)
          return { data: null, error: new Error('Storage unavailable') };
        return {
          data: state.portfolio.map((name) => ({ name, id: name })),
          error: null,
        };
      },
      createSignedUrl: async (filePath, seconds) => {
        assert.equal(seconds, 600);
        assert(filePath.startsWith(state.user.id + '/'));
        return {
          data: { signedUrl: 'https://test.invalid/private/' + filePath },
        };
      },
      upload: async (filePath, bytes, options) => {
        assert.equal(bucket, 'partner-portfolio');
        assert(filePath.startsWith(state.user.id + '/'));
        assert(bytes instanceof ArrayBuffer);
        assert.equal(options.upsert, false);
        state.uploads.push({ bucket, filePath, bytes, options });
        if (!state.uploadError)
          state.portfolio.push(filePath.split('/').at(-1));
        return { error: state.uploadError };
      },
      remove: async (paths) => {
        assert.equal(bucket, 'partner-portfolio');
        assert(paths.every((p) => p.startsWith(state.user.id + '/')));
        if (state.removeError) return { error: new Error('Remove failed') };
        state.removedPaths = paths;
        state.portfolio = state.portfolio.filter(
          (name) => !paths.includes(state.user.id + '/' + name),
        );
        return { error: null };
      },
      uploadToSignedUrl: async (filePath, token, bytes, options) => {
        assert(bytes instanceof ArrayBuffer, 'Native uploads must send bytes');
        state.uploads.push({ bucket, filePath, token, bytes, options });
        return { error: state.uploadError };
      },
    }),
  },
};
const native = Object.fromEntries(
  [
    'View',
    'Text',
    'ScrollView',
    'Pressable',
    'TextInput',
    'ActivityIndicator',
    'KeyboardAvoidingView',
    'Image',
    'RefreshControl',
    'Switch',
    'SafeAreaView',
  ].map((key) => [key, key]),
);
Object.assign(native, {
  StyleSheet: { create: (styles) => styles },
  Platform: { OS: 'android' },
  Alert: { alert: (...args) => state.alerts.push(args) },
  Linking: {
    openURL: async (url) => {
      state.mapUrl = url;
    },
    openSettings: async () => {
      state.settingsOpened = true;
    },
  },
});
const mocks = {
  react: React,
  'react/jsx-runtime': require('react/jsx-runtime'),
  'react-native': native,
  'react-native-safe-area-context': {
    SafeAreaView: 'SafeAreaView',
    SafeAreaProvider: 'SafeAreaProvider',
    useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
  },
  'expo-router': {
    Stack: 'Stack',
    router: {
      replace: (route) => state.routes.push(route),
      push: (route) => state.routes.push(route),
      back: () => state.routes.push('back'),
    },
    usePathname: () => '/home',
    useLocalSearchParams: () => state.params,
    useFocusEffect: (callback) => React.useEffect(callback, [callback]),
  },
  'expo-location': {
    Accuracy: { Balanced: 3 },
    requestForegroundPermissionsAsync: async () => ({
      granted: state.permission,
    }),
    getCurrentPositionAsync: async () => ({
      coords: { latitude: 23.2, longitude: 77.4 },
    }),
  },
  'expo-image-picker': {
    requestMediaLibraryPermissionsAsync: async () => ({
      granted: state.permission,
    }),
    launchImageLibraryAsync: async (options) => {
      state.pickerOptions = options;
      return {
        canceled: !state.pickerAssets.length,
        assets: state.pickerAssets,
      };
    },
  },
  'expo-document-picker': {
    getDocumentAsync: async () => ({
      canceled: !state.pickerAssets.length,
      assets: state.pickerAssets,
    }),
  },
  'expo-file-system': {
    File: class {
      get size() {
        return state.nativeFileSize ?? 3;
      }
      async arrayBuffer() {
        return new Uint8Array([1, 2, 3]).buffer;
      }
    },
  },
  'expo-constants': {
    __esModule: true,
    default: { expoConfig: { version: '0.1.0' } },
  },
};
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const localRequire = (name) => {
    if (mocks[name]) return mocks[name];
    if (name.endsWith('/shared/supabase')) return { supabase };
    if (name.endsWith('/shared/notifications'))
      return { registerPushToken: async () => {} };
    if (name.startsWith('.')) {
      const next = path.resolve(path.dirname(filename), name);
      return load(['.tsx', '.ts'].map((ext) => next + ext).find(fs.existsSync));
    }
    throw new Error('Unmocked dependency: ' + name);
  };
  new Function('require', 'module', 'exports', js)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}
async function mount(screen) {
  await act(async () => {
    renderer = create(
      React.createElement(
        load(path.join(base, 'app', screen + '.tsx')).default,
      ),
    );
  });
}
function textOf(node) {
  return typeof node === 'string' ? node : node.children.map(textOf).join('');
}
function screenText() {
  return textOf(renderer.root);
}
async function press(label) {
  const buttons = renderer.root.findAllByType('Pressable');
  const button = buttons.find(
    (b) => textOf(b) === label || textOf(b) === label + '›',
  );
  assert(button, `Button not found: ${label}. Screen: ${screenText()}`);
  assert(!button.props.disabled, 'Button is disabled: ' + label);
  await act(async () => {
    await button.props.onPress();
  });
}
async function input(placeholder, value) {
  await act(async () => {
    renderer.root.findByProps({ placeholder }).props.onChangeText(value);
  });
}
async function unmount() {
  if (renderer)
    await act(async () => {
      renderer.unmount();
    });
  renderer = null;
}
let passed = 0;
async function test(name, action, overrides = {}) {
  reset(overrides);
  try {
    await action();
    passed++;
    console.log('PASS ' + name);
  } finally {
    await unmount();
  }
}

await test('all 17 screens and root layout render without crashing', async () => {
  for (const screen of [
    '_layout',
    'index',
    'auth',
    'apply',
    'verification',
    'home',
    'jobs',
    'job',
    'portfolio',
    'delivery',
    'availability',
    'notifications',
    'performance',
    'earnings',
    'profile',
    'settings',
    'support',
    'about',
  ]) {
    await mount(screen);
    await unmount();
  }
});
await test('auth validates empty fields', async () => {
  await mount('auth');
  await press('Login');
  assert.equal(state.authCalls.length, 0);
  assert.equal(state.alerts[0][0], 'Missing details');
});
await test('auth signs in and routes to workspace', async () => {
  await mount('auth');
  await input('Email', ' test@example.invalid ');
  await input('Password', 'test-password');
  await press('Login');
  assert.equal(state.authCalls[0].email, 'test@example.invalid');
  assert(state.routes.includes('/home'));
});
await test('signup sends name and phone and routes to application', async () => {
  await mount('auth');
  await press('Create partner account');
  await input('Full name', 'Test');
  await input('Phone', '9999999999');
  await input('Email', 'test@example.invalid');
  await input('Password', 'test-password');
  await press('Create account');
  assert.equal(state.authCalls[0].options.data.full_name, 'Test');
  assert(state.routes.includes('/apply'));
});
await test('email confirmation signup stays on auth', async () => {
  state.signupConfirmation = true;
  await mount('auth');
  await press('Create partner account');
  for (const [p, v] of [
    ['Full name', 'Test'],
    ['Phone', '9999999999'],
    ['Email', 'test@example.invalid'],
    ['Password', 'test-password'],
  ])
    await input(p, v);
  await press('Create account');
  assert.equal(state.routes.length, 0);
  assert.equal(state.alerts[0][0], 'Account created');
  assert(screenText().includes('Verify your email'));
  assert.equal(
    renderer.root.findByProps({ placeholder: 'Password' }).props.value,
    '',
  );
  assert(
    renderer.root.findByProps({
      accessibilityLabel: 'Resend verification email',
    }).props.disabled,
  );
});
await test('resend requires a valid email without calling the service', async () => {
  await mount('auth');
  await input('Email', 'not-an-email');
  await press('Resend verification email');
  assert.equal(state.authCalls.length, 0);
  assert.equal(state.alerts[0][0], 'Email required');
});
await test('resend uses the existing signup flow without password or session bypass', async () => {
  await mount('auth');
  await input('Email', ' test@example.invalid ');
  await press('Resend verification email');
  assert.deepEqual(state.authCalls[0], {
    type: 'signup',
    email: 'test@example.invalid',
  });
  assert.equal(state.routes.length, 0);
  assert.equal(state.alerts[0][0], 'Verification email requested');
  assert(
    renderer.root.findByProps({
      accessibilityLabel: 'Resend verification email',
    }).props.disabled,
  );
});
await test('resend service error is shown and allows retry', async () => {
  state.authError = { message: 'Email service unavailable' };
  await mount('auth');
  await input('Email', 'test@example.invalid');
  await press('Resend verification email');
  assert.equal(state.alerts[0][0], 'Could not resend email');
  assert(
    !renderer.root.findByProps({
      accessibilityLabel: 'Resend verification email',
    }).props.disabled,
  );
  assert.equal(state.routes.length, 0);
});
await test('rapid repeated resend taps create only one request', async () => {
  let release;
  state.resendPending = new Promise((resolve) => {
    release = resolve;
  });
  await mount('auth');
  await input('Email', 'test@example.invalid');
  const button = renderer.root.findByProps({
    accessibilityLabel: 'Resend verification email',
  });
  await act(async () => {
    const request = button.props.onPress();
    await button.props.onPress();
    assert.equal(state.authCalls.length, 1);
    release();
    await request;
  });
  assert.equal(state.authCalls.length, 1);
  assert.equal(state.routes.length, 0);
});
await test('resend rate limit disables repeated email requests', async () => {
  state.authError = {
    status: 429,
    code: 'over_email_send_rate_limit',
    message: 'Wait before resending',
  };
  await mount('auth');
  await input('Email', 'test@example.invalid');
  await press('Resend verification email');
  assert(
    renderer.root.findByProps({
      accessibilityLabel: 'Resend verification email',
    }).props.disabled,
  );
  assert.equal(state.authCalls.length, 1);
});
await test('resend offline error resets busy state without claiming email sent', async () => {
  state.authThrows = true;
  await mount('auth');
  await input('Email', 'test@example.invalid');
  await press('Resend verification email');
  assert.equal(state.alerts[0][0], 'Connection interrupted');
  assert(!screenText().includes('Verify your email'));
  assert(
    !renderer.root.findByProps({
      accessibilityLabel: 'Resend verification email',
    }).props.disabled,
  );
});
await test('unconfirmed login presents recovery without entering workspace', async () => {
  state.authError = {
    code: 'email_not_confirmed',
    message: 'Email not confirmed',
  };
  await mount('auth');
  await input('Email', 'test@example.invalid');
  await input('Password', 'test-password');
  await press('Login');
  assert.equal(state.alerts[0][0], 'Verify your email');
  assert.equal(state.routes.length, 0);
  assert(screenText().includes('Verify your email'));
  assert(
    !renderer.root.findByProps({
      accessibilityLabel: 'Resend verification email',
    }).props.disabled,
  );
});
await test('login network failure resets busy button', async () => {
  state.authThrows = true;
  await mount('auth');
  await input('Email', 'test@example.invalid');
  await input('Password', 'test-password');
  await press('Login');
  assert.equal(state.alerts[0][0], 'Connection interrupted');
  assert(screenText().includes('Login'));
});
await test('application saves required UPI before enabling KYC upload', async () => {
  await mount('apply');
  const upload = renderer.root
    .findAllByType('Pressable')
    .find((b) => textOf(b) === 'Upload document');
  assert(upload.props.disabled);
  await input('Full name', 'Test');
  await input('Phone', '9999999999');
  await input('UPI ID (name@upi)', 'test@upi');
  await press('Submit application');
  assert.equal(state.application.payout_upi_id, 'test@upi');
  assert.equal(state.alerts.at(-1)[0], 'Application saved');
});
await test('application rejects malformed UPI', async () => {
  await mount('apply');
  await input('Full name', 'Test');
  await input('Phone', '9999999999');
  await input('UPI ID (name@upi)', 'invalid');
  await press('Submit application');
  assert(!state.calls.some((c) => c.endpoint === '/api/partner/apply'));
});
await test('existing application prefilled and identity bytes upload privately', async () => {
  state.application = {
    display_name: 'Applicant',
    phone: '9999999999',
    payout_upi_id: 'test@upi',
    bio: '',
    skills: ['Photography'],
    status: 'pending',
  };
  state.pickerAssets = [
    { uri: 'file:///id.jpg', name: 'id.jpg', mimeType: 'image/jpeg', size: 3 },
  ];
  await mount('apply');
  assert.equal(
    renderer.root.findByProps({ placeholder: 'Full name' }).props.value,
    'Applicant',
  );
  await press('Upload document');
  assert.equal(state.uploads[0].bucket, 'partner-documents');
});
await test('verification displays actual rejected reason', async () => {
  state.application = {
    status: 'rejected',
    rejection_reason: 'Document is blurred',
  };
  await mount('verification');
  assert(screenText().includes('Document is blurred'));
  assert(!screenText().includes('Application under review'));
});
await test('dashboard shows actual assignment and metrics', async () => {
  state.jobs = [{ ...job }];
  await mount('home');
  assert(screenText().includes('PK-REAL'));
  assert(!screenText().includes('PKL-2846'));
  assert(screenText().includes('4.2'));
});
await test('online state persists with PATCH and reload', async () => {
  await mount('home');
  await press('Offline');
  const call = state.calls.find((c) => c.options.method === 'PATCH');
  assert.equal(call.body.is_accepting_jobs, true);
  assert(screenText().includes('Online'));
});
await test('failed online request preserves offline state', async () => {
  await mount('home');
  state.failPath = '/api/partner/profile';
  await press('Offline');
  assert.equal(state.partner.is_accepting_jobs, false);
  assert(screenText().includes('Offline'));
  assert.equal(state.alerts[0][0], 'Availability unchanged');
});
await test('dashboard shows empty assignment without invented job', async () => {
  await mount('home');
  assert(screenText().includes('Ready for your next shoot'));
  assert(!screenText().includes('Birthday Photography'));
});
await test('jobs accept offer with correct action', async () => {
  state.jobs = [
    {
      ...job,
      status: 'PARTNER_ASSIGNED',
      partner_acceptance_status: 'pending',
    },
  ];
  await mount('jobs');
  await press('OPEN OFFERS');
  await press('Accept job');
  assert.equal(
    state.calls.find((c) => c.endpoint.endsWith('/respond')).body.action,
    'accept',
  );
});
await test('jobs pass offer with correct action', async () => {
  state.jobs = [
    {
      ...job,
      status: 'PARTNER_ASSIGNED',
      partner_acceptance_status: 'pending',
    },
  ];
  await mount('jobs');
  await press('OPEN OFFERS');
  await press('Pass');
  assert.equal(
    state.calls.find((c) => c.endpoint.endsWith('/respond')).body.action,
    'decline',
  );
});
await test('expired offer has disabled accept and pass buttons', async () => {
  state.jobs = [
    {
      ...job,
      status: 'PARTNER_ASSIGNED',
      partner_acceptance_status: 'pending',
      partner_offer_expires_at: '2000-01-01',
    },
  ];
  await mount('jobs');
  await press('OPEN OFFERS');
  for (const label of ['Accept job', 'Pass'])
    assert(
      renderer.root.findAllByType('Pressable').find((b) => textOf(b) === label)
        .props.disabled,
    );
});
await test('shoot start requires six-digit customer OTP', async () => {
  state.jobs = [{ ...job }];
  await mount('jobs');
  await press('Start shoot');
  assert(!state.calls.some((c) => c.endpoint.endsWith('/transition')));
  await input('Six-digit OTP', '123456');
  await press('Start shoot');
  const call = state.calls.find((c) => c.endpoint.endsWith('/transition'));
  assert.equal(call.body.booking_otp, '123456');
  assert.equal(call.body.to_status, 'SHOOT_STARTED');
});
await test('job lifecycle completes shoot and prepares delivery', async () => {
  state.jobs = [{ ...job, status: 'SHOOT_STARTED' }];
  await mount('jobs');
  await press('Complete shoot');
  await press('Prepare delivery');
  assert.equal(state.jobs[0].status, 'DATA_PENDING');
  assert(!screenText().includes('Submit delivery'));
  await press('Upload delivery');
  assert.deepEqual(state.routes.at(-1), {
    pathname: '/delivery',
    params: { id: 'booking' },
  });
});
await test('cancel requires confirmation before mutation', async () => {
  state.jobs = [{ ...job }];
  await mount('jobs');
  await press('Cancel assignment');
  assert(!state.calls.some((c) => c.endpoint.endsWith('/cancel')));
  await act(async () => {
    state.alerts
      .at(-1)[2]
      .find((b) => b.style === 'destructive')
      .onPress();
  });
  assert(state.calls.some((c) => c.endpoint.endsWith('/cancel')));
});
await test('navigation uses real job coordinates', async () => {
  state.jobs = [{ ...job }];
  await mount('jobs');
  await press('Navigate to shoot ↗');
  assert(state.mapUrl.includes('23.2%2C77.4'));
});
await test('delivery supports videos and finalizes only after upload', async () => {
  state.pickerAssets = [
    {
      uri: 'file:///video.mp4',
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
      fileSize: 3,
    },
  ];
  await mount('delivery');
  await press('Select photos & videos');
  assert(state.pickerOptions.mediaTypes.includes('videos'));
  await press('☐ Customer received files on site');
  await press('Upload & submit delivery');
  assert.equal(state.uploads[0].bucket, 'booking-deliveries');
  assert.equal(state.calls.at(-1).body.assets[0].mimeType, 'video/mp4');
  assert.equal(state.alerts[0][0], 'Delivery submitted');
});
await test('failed storage upload never finalizes and allows retry', async () => {
  state.pickerAssets = [
    {
      uri: 'file:///photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 3,
    },
  ];
  state.uploadError = { message: 'Storage unavailable' };
  await mount('delivery');
  await press('Select photos & videos');
  await press('☐ Customer received files on site');
  await press('Upload & submit delivery');
  assert(!state.calls.some((c) => c.endpoint.endsWith('/finalize')));
  assert.equal(state.alerts[0][0], 'Delivery failed');
});
await test('availability validates date and saves time in IST', async () => {
  await mount('availability');
  await input('YYYY-MM-DD', '2099-02-30');
  await input('Start HH:MM', '10:00');
  await input('End HH:MM', '11:00');
  await press('Add time window');
  assert(!state.calls.some((c) => c.options.method === 'POST'));
  await input('YYYY-MM-DD', '2099-02-02');
  await press('Add time window');
  const call = state.calls.find((c) => c.options.method === 'POST');
  assert.equal(call.body.starts_at, '2099-02-02T04:30:00.000Z');
});
await test('notifications mark read before opening linked jobs', async () => {
  state.notices = [
    {
      id: 'notice',
      title: 'Assigned',
      body: 'New job',
      booking_id: 'booking',
      created_at: '2099-01-01',
    },
  ];
  await mount('notifications');
  const button = renderer.root
    .findAllByType('Pressable')
    .find((b) => textOf(b).includes('Assigned'));
  await act(async () => {
    await button.props.onPress();
  });
  assert(state.calls.some((c) => c.endpoint.endsWith('/read')));
  assert.deepEqual(state.routes.at(-1), {
    pathname: '/job',
    params: { id: 'booking' },
  });
});
await test('failed mark-read request reports failure', async () => {
  state.notices = [
    {
      id: 'notice',
      title: 'Assigned',
      body: 'New job',
      created_at: '2099-01-01',
    },
  ];
  state.failPath = '/api/notifications/read';
  await mount('notifications');
  const button = renderer.root
    .findAllByType('Pressable')
    .find((b) => textOf(b).includes('Assigned'));
  await act(async () => {
    await button.props.onPress();
  });
  assert(!state.notices[0].read_at);
  assert.equal(state.alerts[0][0], 'Unable to open notification');
});
await test('earnings period filters show real released records', async () => {
  state.payouts = [
    {
      id: 'old',
      amount_paise: 123400,
      status: 'released',
      created_at: '2000-01-01',
    },
  ];
  await mount('earnings');
  assert(screenText().includes('₹0'));
  await press('LATEST 100');
  assert(screenText().includes('₹1,234'));
  assert(!screenText().includes('Quality bonus'));
});
await test('profile badge comes from actual verification status', async () => {
  state.partner.verification_status = 'suspended';
  await mount('profile');
  assert(screenText().includes('SUSPENDED'));
  assert(!screenText().includes('VERIFIED'));
  await press('Log out');
  assert(state.routes.includes('/auth'));
});
await test('profile saves valid UPI with existing endpoint', async () => {
  await mount('profile');
  await input('New UPI ID', 'new@upi');
  await press('Save UPI account');
  assert.equal(state.partner.payout_upi_id, 'new@upi');
});
await test('settings opens native permission settings', async () => {
  await mount('settings');
  await press('Notifications, photos & location');
  assert(state.settingsOpened);
});
await test('bottom tabs route to home/jobs/earnings/profile', async () => {
  await mount('home');
  for (const label of ['⌂Home', '▣Jobs', '₹Earnings', '●Profile'])
    await press(label);
  assert.deepEqual(state.routes.slice(-4), [
    '/home',
    '/jobs',
    '/earnings',
    '/profile',
  ]);
});
await test('all remote screens recover from network failure with retry', async () => {
  for (const screen of [
    'home',
    'jobs',
    'availability',
    'notifications',
    'performance',
    'earnings',
    'profile',
    'verification',
    'portfolio',
    'job',
  ]) {
    state.networkError = true;
    await mount(screen);
    assert(screenText().includes('Unable to load'), screen);
    state.networkError = false;
    await press('Try again');
    assert(!screenText().includes('Unable to load'), screen);
    await unmount();
  }
});
await test('expired session routes to auth without API writes', async () => {
  state.session = null;
  await mount('jobs');
  assert(state.routes.includes('/auth'));
  assert.equal(state.calls.length, 0);
});
await test('server 401 response routes to auth', async () => {
  state.failPath = '/api/partner/jobs';
  state.failStatus = 401;
  await mount('jobs');
  assert(state.routes.includes('/auth'));
});
await test('login server error stays on auth', async () => {
  state.authError = { message: 'Invalid credentials' };
  await mount('auth');
  await input('Email', 'test@example.invalid');
  await input('Password', 'test-password');
  await press('Login');
  assert.equal(state.alerts[0][1], 'Invalid credentials');
  assert.equal(state.routes.length, 0);
});
await test('pending applicant routes to verification', async () => {
  state.role = 'customer';
  state.application = { status: 'pending' };
  await mount('home');
  assert(state.routes.includes('/verification'));
});
await test('new applicant routes to application', async () => {
  state.role = 'customer';
  await mount('home');
  assert(state.routes.includes('/apply'));
});
await test('suspended partner cannot see workspace metrics', async () => {
  state.partner.verification_status = 'suspended';
  await mount('home');
  assert(state.routes.includes('/verification'));
  assert(screenText().includes('Unable to load'));
});
await test('rejected job action resets busy state', async () => {
  state.jobs = [{ ...job }];
  await mount('jobs');
  await input('Six-digit OTP', '123456');
  state.failPath = '/api/bookings/booking/transition';
  await press('Start shoot');
  assert.equal(state.jobs[0].status, 'ON_THE_WAY');
  assert.equal(state.alerts[0][0], 'Action failed');
  assert(screenText().includes('Start shoot'));
});
await test('submitted jobs expose no shoot or delivery mutation', async () => {
  state.jobs = [{ ...job, status: 'DATA_SUBMITTED' }];
  await mount('jobs');
  await press('HISTORY');
  assert(screenText().includes('PK-REAL'));
  assert(!screenText().includes('Start shoot'));
  assert(!screenText().includes('Upload delivery'));
});
await test('media permission denial does not open picker', async () => {
  state.permission = false;
  await mount('delivery');
  await press('Select photos & videos');
  assert(!state.pickerOptions);
  assert.equal(state.alerts[0][0], 'Photo access');
});
await test('oversized delivery rejected before storage request', async () => {
  state.pickerAssets = [
    {
      uri: 'file:///large.mp4',
      fileName: 'large.mp4',
      mimeType: 'video/mp4',
      fileSize: 501 * 1024 * 1024,
    },
  ];
  await mount('delivery');
  await press('Select photos & videos');
  await press('☐ Customer received files on site');
  await press('Upload & submit delivery');
  assert.equal(state.uploads.length, 0);
  assert.equal(state.calls.length, 0);
});
await test('failed delivery prepare URL never uploads or finalizes', async () => {
  state.failPath = '/api/partner/jobs/booking/delivery/upload-url';
  state.pickerAssets = [
    {
      uri: 'file:///photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 3,
    },
  ];
  await mount('delivery');
  await press('Select photos & videos');
  await press('☐ Customer received files on site');
  await press('Upload & submit delivery');
  assert.equal(state.uploads.length, 0);
  assert(!state.calls.some((c) => c.endpoint.endsWith('/finalize')));
});
await test('failed finalize is reported without success', async () => {
  state.failPath = '/api/partner/jobs/booking/delivery/finalize';
  state.pickerAssets = [
    {
      uri: 'file:///photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 3,
    },
  ];
  await mount('delivery');
  await press('Select photos & videos');
  await press('☐ Customer received files on site');
  await press('Upload & submit delivery');
  assert.equal(state.uploads.length, 1);
  assert.equal(state.alerts.at(-1)[0], 'Delivery failed');
  state.failPath = null;
  await press('Upload & submit delivery');
  assert.equal(
    state.uploads.length,
    1,
    'Retry reuses the successfully uploaded private object',
  );
  assert.equal(state.alerts.at(-1)[0], 'Delivery submitted');
});
await test('oversized KYC document is rejected', async () => {
  state.application = {
    display_name: 'Applicant',
    phone: '9999999999',
    payout_upi_id: 'test@upi',
    skills: [],
    status: 'pending',
  };
  state.pickerAssets = [
    {
      uri: 'file:///id.pdf',
      name: 'id.pdf',
      mimeType: 'application/pdf',
      size: 21 * 1024 * 1024,
    },
  ];
  await mount('apply');
  await press('Upload document');
  assert.equal(state.uploads.length, 0);
  assert.equal(state.alerts[0][0], 'Document too large');
});
await test('configured support opens phone dialler', async () => {
  process.env.EXPO_PUBLIC_SUPPORT_PHONE = '+919999999999';
  try {
    await mount('support');
    await press('Call partner support');
    assert.equal(state.mapUrl, 'tel:+919999999999');
  } finally {
    delete process.env.EXPO_PUBLIC_SUPPORT_PHONE;
  }
});
await test('missing API configuration shows recoverable error', async () => {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  try {
    await mount('jobs');
    assert(screenText().includes('not configured'));
    assert.equal(state.calls.length, 0);
  } finally {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://test.invalid';
  }
});
await test('splash restores authenticated session', async () => {
  await mount('index');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 950));
  });
  assert(state.routes.includes('/home'));
});
await test('splash storage failure routes safely to auth', async () => {
  state.sessionThrows = true;
  await mount('index');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 950));
  });
  assert(state.routes.includes('/auth'));
});
await test('provider-processed payouts are counted alongside released payouts', async () => {
  state.payouts = [
    {
      id: 'processed',
      amount_paise: 234500,
      status: 'processed',
      created_at: '2000-01-01',
    },
  ];
  await mount('earnings');
  await press('LATEST 100');
  assert(screenText().includes('₹2,345'));
});
await test('delivery submit remains disabled until customer handoff is confirmed', async () => {
  state.pickerAssets = [
    {
      uri: 'file:///photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 3,
    },
  ];
  await mount('delivery');
  await press('Select photos & videos');
  const button = renderer.root
    .findAllByType('Pressable')
    .find((b) => textOf(b) === 'Upload & submit delivery');
  assert(button.props.disabled);
  await act(async () => {
    await button.props.onPress();
  });
  assert.equal(state.calls.length, 0);
  assert.equal(state.alerts[0][0], 'Confirm customer handoff');
  await press('☐ Customer received files on site');
  await press('Upload & submit delivery');
  assert.equal(state.calls.at(-1).body.customer_handoff_confirmed, true);
});
await test('delivery checks native file size when picker metadata is missing', async () => {
  state.pickerAssets = [
    { uri: 'file:///large.mp4', fileName: 'large.mp4', mimeType: 'video/mp4' },
  ];
  state.nativeFileSize = 501 * 1024 * 1024;
  await mount('delivery');
  await press('Select photos & videos');
  await press('☐ Customer received files on site');
  await press('Upload & submit delivery');
  assert.equal(state.calls.length, 0);
  assert.equal(state.uploads.length, 0);
});
await test('portfolio uploads native bytes into the authenticated owner folder', async () => {
  state.pickerAssets = [
    { uri: 'file:///portfolio.jpg', mimeType: 'image/jpeg', fileSize: 3 },
  ];
  await mount('portfolio');
  assert(screenText().includes('Your work belongs here'));
  await press('Add portfolio photo');
  assert.equal(state.uploads[0].bucket, 'partner-portfolio');
  assert(state.uploads[0].filePath.startsWith('partner/'));
  assert.equal(state.portfolio.length, 1);
  assert(screenText().includes('1 of 6 photos'));
  assert.equal(renderer.root.findAllByType('Image').length, 1);
});
await test('full portfolio disables additions', async () => {
  state.portfolio = Array.from({ length: 6 }, (_, i) => i + '.jpg');
  await mount('portfolio');
  assert(
    renderer.root
      .findAllByType('Pressable')
      .find((b) => textOf(b) === 'Add portfolio photo').props.disabled,
  );
});
await test('portfolio removal requires confirmation and removes only the owner object', async () => {
  state.portfolio = ['photo.jpg'];
  await mount('portfolio');
  await press('Remove photo');
  assert(!state.removedPaths);
  await act(async () => {
    await state.alerts
      .at(-1)[2]
      .find((b) => b.style === 'destructive')
      .onPress();
  });
  assert.deepEqual(state.removedPaths, ['partner/photo.jpg']);
  assert(screenText().includes('Your work belongs here'));
});
await test('failed portfolio removal retains photo and reports error', async () => {
  state.portfolio = ['photo.jpg'];
  state.removeError = true;
  await mount('portfolio');
  await press('Remove photo');
  await act(async () => {
    await state.alerts
      .at(-1)[2]
      .find((b) => b.style === 'destructive')
      .onPress();
  });
  assert.equal(state.portfolio.length, 1);
  assert.equal(state.alerts.at(-1)[0], 'Unable to remove photo');
});
await test('portfolio rejects oversized image without upload', async () => {
  state.pickerAssets = [
    {
      uri: 'file:///huge.jpg',
      mimeType: 'image/jpeg',
      fileSize: 21 * 1024 * 1024,
    },
  ];
  await mount('portfolio');
  await press('Add portfolio photo');
  assert.equal(state.uploads.length, 0);
  assert.equal(state.alerts.at(-1)[0], 'Unable to add photo');
});
await test('portfolio permission denial and failed upload never add a photo', async () => {
  state.permission = false;
  await mount('portfolio');
  await press('Add portfolio photo');
  assert.equal(state.uploads.length, 0);
  state.permission = true;
  state.uploadError = new Error('Storage failed');
  state.pickerAssets = [
    { uri: 'file:///photo.jpg', mimeType: 'image/jpeg', fileSize: 3 },
  ];
  await press('Add portfolio photo');
  assert.equal(state.portfolio.length, 0);
  assert.equal(state.alerts.at(-1)[0], 'Unable to add photo');
});
await test('profile bio edits persist and portfolio link opens working screen', async () => {
  await mount('profile');
  await input('Your photography experience', 'Bhopal portrait photographer');
  await press('Save bio');
  assert.equal(state.partner.bio, 'Bhopal portrait photographer');
  await press('Manage portfolio');
  assert(state.routes.includes('/portfolio'));
});
await test('performance shows actual assigned level without invented promotion thresholds', async () => {
  state.currentLevel = { ...state.levels[1] };
  await mount('performance');
  assert(screenText().includes('Standard'));
  assert(screenText().includes('CURRENT'));
  assert(screenText().includes('40 XP'));
  assert(!screenText().includes('3000'));
});
await test('job details show only selected job, actual payout and OTP lifecycle', async () => {
  state.jobs = [
    { ...job, partner_payout_paise: 80000 },
    { ...job, id: 'other', booking_code: 'OTHER' },
  ];
  await mount('job');
  assert(screenText().includes('Assignment details'));
  assert(screenText().includes('₹800'));
  assert(!screenText().includes('OTHER'));
  await input('Six-digit OTP', '123456');
  await press('Start shoot');
  assert.equal(
    state.calls.find((c) => c.endpoint.endsWith('/transition')).body
      .booking_otp,
    '123456',
  );
});
await test('job detail cannot expose another assignment or act on a missing id', async () => {
  state.jobs = [{ ...job, id: 'other', booking_code: 'OTHER' }];
  await mount('job');
  assert(screenText().includes('Assignment unavailable'));
  assert(!screenText().includes('OTHER'));
  await unmount();
  state.params = {};
  await mount('job');
  assert(screenText().includes('No assignment selected'));
});
await test('home and inbox open dedicated assignment details', async () => {
  state.jobs = [{ ...job }];
  await mount('home');
  await press('Open assignment  ↗');
  assert.deepEqual(state.routes.at(-1), {
    pathname: '/job',
    params: { id: 'booking' },
  });
  await unmount();
  await mount('jobs');
  await press('View assignment details');
  assert.deepEqual(state.routes.at(-1), {
    pathname: '/job',
    params: { id: 'booking' },
  });
});
console.log(
  `\n${passed} partner screen/interaction scenarios passed. Native modules and services were mocked.`,
);
