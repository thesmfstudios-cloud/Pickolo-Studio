# Admin rollout safety — test-only phase

The professional admin workspace remains on a dedicated branch. This document
does not authorize database changes, production promotion, main merges or live
payments. RazorpayX access is pending support ticket **21231775**.

## Read-only database inspection

Use `scripts/admin-rollout-preflight.sql` with the owner's authorized database
access. It starts a read-only transaction, bounds execution to ten seconds and
rolls back. It returns check names, severity and aggregate counts only: no names,
phone numbers, UPI values, identity files, object paths or credentials.

Run first against separately configured staging. Before inspecting production,
verify the selected project and access. No service key belongs in chat or a
public client. This is not a migration, application route or scheduled job; it
does not remediate data or automatically connect to any environment.

| Result              | Meaning                                                         |
| ------------------- | --------------------------------------------------------------- |
| `pass`              | This particular check found no issue in the current snapshot.   |
| `blocker`           | Stop rollout; inspect and agree a correction.                   |
| `review`            | Owner must review legacy records. Do not silently rewrite them. |
| SQL error / timeout | Inspection incomplete; stop rollout, never treat as pass.       |

The historical 0001–0029 tables are required. A missing base table fails closed.
Before admin rollout, `required_rpc_missing` is expected to block. Apply only a
separately approved migration plan and repeat inspection afterwards.

Checks cover the active Basic default, three private media buckets, RLS on eleven
operational tables, thirteen admin/delivery RPC signatures and their execute
grants, duplicate provider references, non-approved partners left online, and
legacy approval/file/level/payout discrepancies. Counts are not backups or a full
security audit. RLS enabled does not prove policy correctness. Storage metadata
checks do not scan documents or prove identity.

## Migration inventory and release order

1. Record the target project, applied versions/checksums and current approval RPC
   definitions. The isolated live hotfix uses
   `20261003090015_partner_approval_hotfix.sql`; this full-admin branch uses
   `20261002170200_admin_operations_safety.sql`. They have distinct RPCs/version
   histories. Reconcile inventory before applying anything; do not blindly push
   the directory or renumber applied migrations.
2. Verify a recoverable database and private-object backup. This source change
   did not create one.
3. Review duplicate payout references before the unique-index rollout. Never
   delete records or generate replacement transfers to clear an inspection.
4. Install `0030_partner_delivery_integrity.sql` only if absent, before the new
   delivery handler. Install the reviewed admin safety migration before its APIs.
   The edited admin migration is pending rollout, not a live patch. If that
   version has already been applied anywhere, leave its history unchanged and
   generate/review a forward migration for that target instead.
5. Re-run inspection, resolve blockers and document owner disposition of review
   items. A clean snapshot is not deployment permission and does not prevent
   concurrent changes.
6. Deploy only an authorized staging/preview revision with separate staging
   Supabase configuration. Verify isolation and use disposable test fixtures.
7. Exercise real login → application → upload → document review → approval →
   explicit service/level eligibility → availability → assignment → accept/pass
   → OTP → shoot → handoff/backup → customer confirmation, with authorized staging
   users/data only.
8. Test provider payouts after RazorpayX Test Mode access is restored. Use a
   synthetic partner/dummy UPI in the isolated sandbox, not business bookings.
   Queued is not paid. Live payout routes remain unconditionally paused.

## Preserved enrollment policy

- Camera, phone or both; photography, videography or both remain selectable.
- One clear private identity document; no equipment invoices or extra lenses.
- New approved partners start at **Basic**, consistent with the deployed hotfix.
- Earned level is preserved. A legacy null level receives Basic on deliberate
  reapproval, not an automatic bulk update.
- Reject/suspend forces offline; reapproval does not automatically go online.
- This workspace retains explicit operator control of job service eligibility.
  Preferences alone do not silently promote a partner or grant more jobs.
- Bhopal's existing **15 KM** pilot-radius rule is unchanged.

## Verification boundary

`npm run test:rollout` executes the actual inspection SQL on disposable PGlite
PostgreSQL, including absent schema/RPCs, unsafe grants/storage/RLS, legacy review
conditions and duplicate payout references. Actual admin approval SQL tests cover
Basic defaults, missing-level repair, suspension/offline, earned-level retention,
missing documents, rollback and null decisions.

CI runs these checks plus recovery, payment sandbox, customer, partner, web build
and mobile regressions for `codex/**` branches. This is not live Supabase/provider/
device evidence or an APK/AAB build.

Supabase guidance shaped RLS inspection and explicit grants:
[RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).
