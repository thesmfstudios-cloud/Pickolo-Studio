# Isolated partner approval repair

Branch: `codex/approval-hotfix`, based on the production password-recovery release.

The former application route used a user-authenticated upsert against `partners`, but the live table has no admin INSERT policy. Fresh partner creation therefore failed under RLS. Document review could save successfully, but feedback was hidden at the top of the page and only pending files were listed.

## Scope and security

- Two SECURITY INVOKER transactions, executable only by the server service role. No table grants or RLS policies changed; no automatic live approvals.
- API verifies the caller through Auth and checks the authoritative database admin role. The SQL transaction checks the operator again and protects owner/admin accounts from role conversion.
- Application, partner, service links, profile role, audit and in-app notification commit together. Initial Basic level is preserved; existing non-null partner level is not downgraded.
- Application approval requires one manually approved identity document with a real private Storage object. Missing files must be reuploaded. This is not automated identity verification.
- Row locking and expected status prevent duplicate/stale reviews. Document review also locks the actual Storage row during approval.
- Local accessible progress/error feedback, persistent success notice, reviewed-document history, retryable load errors and mobile action wrapping.
- No payout, assignment, pricing or customer flow changes; no main merge.

## Verification

`npm run test:approval`: 20 checks using the actual handlers, transaction SQL and React page on disposable Postgres/mocked transport. Includes positive partner creation with both services, owner/non-admin/expired-session blocks, missing-file gate, duplicate submissions and rollback after late audit failure.

Password recovery (18 checks), customer regression suite, repository validation, TypeScript and production build also pass.

Live verification checks function presence, server-only ACLs, RLS remaining enabled and safe unauthorized/nonexistent-record probes. Real document contents were not accessed and real applications were not approved as test fixtures.

## Owner acceptance

1. Refresh `/admin` on the production domain after the release.
2. Review the actual document; approve only if the owner is satisfied. Existing approved files are visible.
3. Approve the application. Expect a saved-success notice and an entry in the approved directory.
4. Partner app: check verification status again or reopen the dashboard.

Older missing upload records require the partner to upload again. An unrelated pre-existing security-advisor report contains callable trigger functions and disabled leaked-password protection; this narrowly scoped fix does not change those settings.

Rollback application deployment: restore production commit `40797d9`. The added RPCs can remain unused safely (no public execution); dropping them is unnecessary for an application rollback.
