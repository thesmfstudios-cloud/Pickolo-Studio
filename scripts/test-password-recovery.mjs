import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { create, act } from "react-test-renderer";
// Real components, mocked Auth transport. No real passwords/accounts/emails.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const originalError = console.error;
console.error = (...args) => {
  if (!String(args[0]).includes("react-test-renderer is deprecated"))
    originalError(...args);
};
let state,
  renderer,
  passed = 0;
const user = { id: "recovery-test-user", email: "operator@test.invalid" };
const tokenHash =
  "#type=recovery&access_token=demo-access&refresh_token=demo-refresh";
const testPassword = "synthetic-test-only-password";
const auth = {
  async setSession(value) {
    state.sessions.push(value);
    if (state.sessionThrow) throw Error("offline");
    return { error: state.sessionError ? Error("invalid") : null };
  },
  async getUser() {
    state.verifications++;
    return {
      data: {
        user: state.noUser
          ? null
          : state.changedUser
            ? { ...user, id: "different-user" }
            : user,
      },
      error: null,
    };
  },
  async updateUser(value) {
    state.updates.push(value);
    if (state.wait) await state.wait;
    if (state.updateThrow) throw Error("offline");
    return {
      data: { user: state.emptyUpdate ? null : user },
      error: state.updateError ? { code: state.updateError } : null,
    };
  },
  async resetPasswordForEmail(email, options) {
    state.emails.push({ email, options });
    return { error: state.emailError ? Error("rate limit") : null };
  },
  async signOut(options) {
    state.signOut.push(options);
    return { error: null };
  },
};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const local = (name) =>
    name === "@/lib/password-recovery"
      ? { createRecoveryClient: () => (state.noConfig ? null : { auth }) }
      : name.startsWith("@/")
        ? load(name.slice(2) + ".ts")
        : require(name);
  new Function("require", "module", "exports", code)(
    local,
    module,
    module.exports,
  );
  return module.exports;
}
const Form = load("app/reset-password/reset-password-form.tsx").default;
const Redirect = load("app/recovery-redirect.tsx").default;
const { recoveryRedirect } = load("lib/recovery-link.ts");
const text = (n) =>
  typeof n === "string" ? n : n?.children?.map(text).join("") || "";
const screen = () => text(renderer.toJSON());
const input = (id) =>
  renderer.root.findAllByType("input").find((n) => n.props.id === id);
async function fill(id, value) {
  await act(async () => input(id).props.onChange({ target: { value } }));
}
async function submit() {
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
}
async function mount(
  hash = "",
  overrides = {},
  Component = Form,
  strict = false,
) {
  state = {
    sessions: [],
    verifications: 0,
    updates: [],
    emails: [],
    signOut: [],
    history: [],
    navigation: [],
    ...overrides,
  };
  globalThis.window = {
    location: {
      hash,
      origin: "https://local.test.invalid",
      replace: (url) => state.navigation.push(url),
    },
    history: {
      replaceState: (...args) => {
        state.history.push(args);
        window.location.hash = "";
      },
    },
  };
  await act(async () => {
    renderer = create(
      strict
        ? React.createElement(
            React.StrictMode,
            null,
            React.createElement(Component),
          )
        : React.createElement(Component),
    );
  });
}
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("PASS " + name);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    renderer = null;
  }
}
await test("homepage forwards recovery fragment without exposing tokens in a query", async () => {
  await mount(tokenHash, {}, Redirect);
  assert.deepEqual(state.navigation, ["/reset-password" + tokenHash]);
});
await test("normal homepage and email confirmation are unchanged", async () => {
  assert.equal(recoveryRedirect(""), null);
  assert.equal(recoveryRedirect("#type=signup&access_token=demo"), null);
});
await test("expired email shows recovery request, not a homepage dead end", async () => {
  assert.match(
    recoveryRedirect("#error_code=otp_expired"),
    /^\/reset-password#/,
  );
  await mount("#error_code=otp_expired");
  assert(input("recovery-email"));
  assert.equal(state.sessions.length, 0);
});
await test("valid link is scrubbed and identity verified before the update form", async () => {
  await mount(tokenHash);
  assert(input("recovery-password"));
  assert.equal(state.history[0][2], "/reset-password");
  assert.equal(state.verifications, 1);
});
await test("StrictMode does not consume a link twice", async () => {
  await mount(tokenHash, {}, Form, true);
  assert.equal(state.sessions.length, 1);
  assert(input("recovery-password"));
});
await test("ordinary app session or missing refresh token cannot unlock recovery", async () => {
  await mount("#type=recovery&access_token=demo");
  assert(input("recovery-email"));
  assert.equal(state.verifications, 0);
});
await test("invalid token fails closed", async () => {
  await mount(tokenHash, { sessionError: true });
  assert(input("recovery-email"));
  assert.equal(state.verifications, 0);
});
await test("unverified identity fails closed", async () => {
  await mount(tokenHash, { noUser: true });
  assert(input("recovery-email"));
});
await test("connection error on verification is recoverable", async () => {
  await mount(tokenHash, { sessionThrow: true });
  assert.match(screen(), /Could not verify/);
});
await test("email request trims email and uses the configured site origin", async () => {
  await mount();
  await fill("recovery-email", " operator@test.invalid ");
  await submit();
  assert.deepEqual(state.emails, [
    { email: user.email, options: { redirectTo: window.location.origin } },
  ]);
  assert.match(screen(), /If this email has/);
});
await test("rate limit cannot produce a success notice", async () => {
  await mount("", { emailError: true });
  await fill("recovery-email", user.email);
  await submit();
  assert.match(screen(), /Unable to send/);
  assert.doesNotMatch(screen(), /has been requested/);
});
await test("missing connection cannot request email", async () => {
  await mount("", { noConfig: true });
  await submit();
  assert.match(screen(), /not configured/);
  assert.equal(state.emails.length, 0);
});
await test("short or mismatched passwords do not call Auth", async () => {
  await mount(tokenHash);
  await fill("recovery-password", "short");
  await fill("recovery-confirm", "short");
  await submit();
  assert.match(screen(), /12 and 128/);
  await fill("recovery-password", testPassword);
  await submit();
  assert.match(screen(), /must match/);
  assert.equal(state.updates.length, 0);
});
await test("identity swap refuses password mutation", async () => {
  await mount(tokenHash);
  state.changedUser = true;
  await fill("recovery-password", testPassword);
  await fill("recovery-confirm", testPassword);
  await submit();
  assert.equal(state.updates.length, 0);
  assert(input("recovery-email"));
});
await test("successful update clears inputs and signs out only recovery session", async () => {
  await mount(tokenHash);
  await fill("recovery-password", testPassword);
  await fill("recovery-confirm", testPassword);
  await submit();
  assert.match(screen(), /Password updated/);
  assert.equal(state.verifications, 2);
  assert.deepEqual(state.signOut, [{ scope: "local" }]);
  assert.equal(input("recovery-password"), undefined);
});
await test("provider rejection is not success", async () => {
  await mount(tokenHash, { updateError: "weak_password" });
  await fill("recovery-password", testPassword);
  await fill("recovery-confirm", testPassword);
  await submit();
  assert.match(screen(), /stronger/);
  assert.equal(state.signOut.length, 0);
});
await test("empty update response is not success", async () => {
  await mount(tokenHash, { emptyUpdate: true });
  await fill("recovery-password", testPassword);
  await fill("recovery-confirm", testPassword);
  await submit();
  assert.match(screen(), /not confirmed/);
});
await test("duplicate submits make one password update", async () => {
  let release;
  await mount(tokenHash);
  state.wait = new Promise((r) => (release = r));
  await fill("recovery-password", testPassword);
  await fill("recovery-confirm", testPassword);
  await act(async () => {
    const form = renderer.root.findByType("form");
    const first = form.props.onSubmit({ preventDefault() {} });
    await Promise.resolve();
    await form.props.onSubmit({ preventDefault() {} });
    release();
    await first;
  });
  assert.equal(state.updates.length, 1);
});
console.error = originalError;
console.log(
  `${passed} recovery component/redirect scenarios passed; Auth transport mocked, no live credential changes.`,
);
