# Mobile dependency compatibility patch

The scoped `query-string → decode-uri-component@0.5.0` override installs the official fixed decoder. This version exports an ESM default; `query-string@7.1.3` still imports the old CommonJS function. `query-string+7.1.3.patch` changes only that import to `.default`. It does not replace the decoder implementation or disable URI decoding.

`npm ci` from `mobile/` applies the committed patch through `patch-package --error-on-fail`. Do not use `--ignore-scripts` or omit dev dependencies for Expo builds. CI/EAS use Node 22.13.0; the mobile manifest requires at least that version for Node's ESM/CommonJS interoperability. A dependency update must fail loudly if the patch no longer applies.

Verification: dependency tests run under Node 22.13.0 and the local runtime, including Hindi/Unicode, repeated query keys, encoded slashes, normal round-trips and bounded malformed-input regressions. Both customer and partner Android Metro/Hermes exports are checked because they share this dependency. These checks do not replace actual Android runtime QA.

Remove the override and patch together only after the upstream router/query dependency supports a patched decoder without this adaptation. Reinstall from a clean lockfile and rerun both apps' exports and dependency tests. Do not use the audit-suggested unrelated major Expo downgrade.

References: [decoder advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [official 0.5.0 implementation](https://github.com/SamVerschueren/decode-uri-component/blob/v0.5.0/index.js), [patch-package](https://github.com/ds300/patch-package).
