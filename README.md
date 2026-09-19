# Pickolo Studio

**Pickolo App by SMF Studios**  
On-demand photography marketplace for short-duration, location-based photography assignments.

> **Project status:** MVP Foundation → Integration  
> **Pilot model:** Controlled local-first launch within a 5 KM operating radius  
> **Initial supply target:** 20–25 verified photographers / studios  
> **Primary validation milestone:** First 100 paid bookings

---

## 1. Product Objective

Pickolo is being developed as a controlled marketplace connecting customers who need short photography assignments with verified photography partners.

The product is built around a complete transaction and fulfillment loop:

**Request → Price → Payment → Partner Assignment → Shoot → Data Delivery → Customer Confirmation → Payout → Review**

The MVP intentionally starts narrow. The initial objective is to prove reliable local fulfillment and measurable booking economics before expanding geography, services, or product complexity.

---

## 2. Product Architecture

Pickolo consists of three coordinated product surfaces:

| Product | Primary Responsibility |
|---|---|
| **Customer App** | Create bookings, pay, track assignment, confirm delivery, review |
| **Partner App** | Verification, availability, job acceptance, shoot workflow, delivery, earnings |
| **Admin Panel** | Partner approval, booking control, assignment, refunds, payouts, disputes, operations |

Shared backend services:

- Authentication
- PostgreSQL database
- Booking / assignment business logic
- Payments
- Notifications
- Media / delivery storage
- Performance and reputation data

### Core booking state machine

`REQUESTED → PAYMENT_CONFIRMED → SEARCHING_PARTNER → PARTNER_ASSIGNED → ON_THE_WAY → SHOOT_STARTED → SHOOT_COMPLETED → DATA_PENDING → DATA_SUBMITTED → CUSTOMER_CONFIRMED → PAYOUT_RELEASED → COMPLETED`

All future workflow development should preserve this transaction model unless a documented product decision changes it.

---

## 3. Current MVP Scope

### Customer
- Authentication foundation
- Photography service selection
- Date and time
- Location
- Duration
- Service level
- Price review
- Booking creation foundation
- Booking status foundation
- Delivery and review architecture

### Partner
- Partner profile
- Verification foundation
- Availability foundation
- Job inbox foundation
- Accept / decline workflow foundation
- Shoot completion workflow
- Delivery workflow
- Earnings / payout architecture
- Performance architecture

### Admin
- Operations dashboard foundation
- Booking monitoring
- Partner verification
- Manual assignment / reassignment
- Pricing configuration architecture
- Payment / payout visibility
- Cancellation / refund workflow architecture
- Dispute and operational controls

### Initial service levels

1. **Basic**
2. **Standard**
3. **Professional**

Premium is intentionally deferred until sufficient supply and performance data exist.

---

## 4. Development Roadmap

### Phase 1 — Foundation
**Status: In Progress**

- [x] Repository and project initialization
- [x] Next.js application shell
- [x] TypeScript configuration
- [x] Customer / Partner / Admin application surfaces
- [x] Supabase client foundation
- [x] Core booking state definitions
- [ ] Supabase project connection
- [ ] Database schema deployment
- [ ] Authentication
- [ ] Row Level Security policies

### Phase 2 — Customer Booking
**Status: Planned / Next**

- [ ] Customer authentication
- [ ] Service selection
- [ ] Date / time / duration
- [ ] Location capture
- [ ] Service-level selection
- [ ] Dynamic price calculation
- [ ] Booking creation API
- [ ] Booking history
- [ ] Status tracking

### Phase 3 — Partner Workflow
**Status: Planned**

- [ ] Partner authentication
- [ ] Partner onboarding
- [ ] Verification workflow
- [ ] Availability management
- [ ] Eligible job discovery
- [ ] Accept / decline
- [ ] On-the-way status
- [ ] Shoot start / completion
- [ ] Delivery submission
- [ ] Earnings

### Phase 4 — Admin Operations
**Status: Planned**

- [ ] Partner approvals
- [ ] Booking dashboard
- [ ] Manual assignment
- [ ] Reassignment
- [ ] Cancellation handling
- [ ] Refund controls
- [ ] Payout visibility
- [ ] Dispute workflow
- [ ] Audit trail

### Phase 5 — Payments, Delivery & Notifications
**Status: Planned**

- [ ] Customer payment integration
- [ ] Payment-confirmed booking state
- [ ] Payout workflow
- [ ] Media delivery architecture
- [ ] Push / SMS / in-app notifications
- [ ] Delivery confirmation

### Phase 6 — Trust & Performance
**Status: Planned**

- [ ] Verified Partner ID
- [ ] Reviews linked to completed bookings
- [ ] Reliability metrics
- [ ] Partner performance history
- [ ] XP / progression
- [ ] Service-level eligibility
- [ ] Portfolio evidence

### Phase 7 — Private Pilot
**Status: Future**

- 5 KM controlled operating radius
- 20–25 verified partners
- Short photography assignments
- Real customer transactions
- Operational monitoring
- Contribution-margin measurement

### Phase 8 — Validation & Expansion
**Status: Future**

Expansion decisions will be based on measured fulfillment, repeat demand, contribution economics, and partner utilization rather than calendar targets.

---

## 5. Development Process

Pickolo will be developed as a **living, documented product**.

After every meaningful development milestone, this README and the relevant technical documentation must be updated.

For each milestone, record:

1. **What was built**
2. **Why it was built**
3. **Files / modules affected**
4. **Database changes**
5. **API / workflow changes**
6. **Security considerations**
7. **Testing performed**
8. **Known limitations**
9. **Next development step**
10. **Git commit reference**

This keeps product, engineering, operations, and investor documentation aligned.

### Development rule

**No major feature is considered complete until the implementation, database/business logic, testing status, and documentation are updated together.**

---

## 6. Repository Structure

```text
Pickolo-Studio/
├── app/
│   ├── customer/
│   ├── partner/
│   ├── admin/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   └── supabase.ts
├── types/
│   └── pickolo.ts
├── public/
├── .env.example
├── .gitignore
├── next.config.ts
├── next-env.d.ts
├── package.json
├── tsconfig.json
└── README.md
```

As the project grows, large domain-specific logic should be separated into clear modules rather than accumulating business logic inside UI components.

---

## 7. Environment Configuration

Create a local `.env.local` file from `.env.example`.

Required foundation variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Never commit secrets, service-role keys, payment secrets, API keys, or private credentials to GitHub.**

---

## 8. Quality & Security Principles

Pickolo handles customer information, partner identity, booking information, payments, and photography assets. Development therefore follows these principles:

- Least-privilege access
- Server-side authorization for sensitive actions
- Supabase Row Level Security where applicable
- No trust in client-supplied booking state
- Auditable booking state transitions
- Controlled payout release
- Explicit cancellation / refund logic
- Secure media delivery
- Environment secrets kept outside source control

Production payment, tax, contract, privacy, consumer, insurance, and other applicable compliance requirements must be reviewed before scaled launch.

---

## 9. Testing Standard

Every major workflow should be tested for both the normal path and failure path.

### Booking
- Successful booking
- Invalid / incomplete request
- Payment failure
- Partner unavailable
- Partner rejection
- Partner cancellation
- Reassignment
- Shoot completion
- Delivery failure
- Customer confirmation
- Refund
- Payout
- Review

### Release gate

A feature should not be marked production-ready until:

`Build → Functional Test → Failure Test → Security Review → Documentation → Commit`

has been completed.

---

## 10. Product Decisions / Deferred Scope

The MVP intentionally does **not** prioritize:

- Nationwide launch
- Complex AI matching
- Large wedding-production workflow
- Advanced dynamic bidding
- Large-scale video processing
- Social-network functionality

These may be considered after the local transaction loop is validated.

---

## 11. KPI / Validation Framework

The pilot will track:

- Enquiries per day
- Booking conversion
- Assignment time
- Fulfillment rate
- Cancellation / no-show rate
- On-time arrival
- Data delivery success
- Average booking value
- Contribution margin per completed booking
- Repeat booking rate
- Referral rate
- Jobs per partner per month

The principal validation milestone is the **first 100 paid bookings** with these metrics recorded.

---

## 12. Change Log

### 2026-09-19 — MVP Foundation
**Commit scope:** Initial Pickolo Studio foundation.

Implemented:

- Next.js application shell
- Customer booking UI foundation
- Partner workspace foundation
- Admin control-room foundation
- Supabase client foundation
- Booking state-machine definitions
- TypeScript / project configuration
- Environment template
- Initial development documentation

Next:

**Supabase connection → database schema → authentication → real booking API**

---

## 13. Documentation Rule for Future Commits

Every future feature commit should include a short documentation update in the same development cycle.

Recommended commit format:

```text
feat: add <feature>
fix: correct <issue>
chore: update <infrastructure>
refactor: reorganize <module>
docs: document <feature/process>
test: add <workflow> coverage
```

For substantial features, add a corresponding section to this README or create a focused document under `docs/`.

---

## 14. Source Product Blueprint

The product roadmap and operating model are based on the Pickolo investor blueprint dated **19 September 2026**.

The blueprint defines the local-first 5 KM pilot, three initial product surfaces, short-duration photography scope, controlled partner assignment, data-delivery protection, transaction-based monetization, and validation through the first 100 paid bookings.

---

**Pickolo App by SMF Studios**  
**Book the right photographer. Complete the job. Build the reputation.**


---

## 15. Permanent Engineering Documentation Protocol

This repository is maintained as a living engineering record from MVP foundation through production launch. Documentation is part of the development process and must be updated proactively after meaningful work. The user should not need to repeatedly request documentation updates.

### What must be recorded

| Event | Record |
|---|---|
| New feature | Scope, reason, implementation, affected files, tests, status |
| Bug discovered | Symptom, reproduction, investigation, root cause, impact |
| Bug fixed | Change made, affected files, verification, regression coverage |
| Database change | Migration, schema impact, RLS/security impact |
| API change | Contract, auth, validation, errors, business rules |
| Security change | Risk, mitigation, verification |
| Architecture decision | Decision, alternatives, reason, consequences |
| UI change | Screen, behavior, responsive considerations |
| Failed attempt | What failed, why, lesson, next action |
| Reverted change | Reason, affected area, follow-up |
| Deployment | Environment, commit, build/runtime result, issues |
| Phase start | Scope, dependencies, acceptance criteria |
| Phase completion | Exit criteria, evidence, remaining risks |

### Required engineering records

The `docs/` directory is the detailed source of truth:

- `PROJECT_LOG.md` — chronological development journal
- `BUG_LOG.md` — bugs, root causes, fixes, regression status
- `DECISIONS.md` — architecture and product decisions
- `TESTING.md` — test strategy, executed tests and release gates
- `DATABASE.md` — schema, migrations and RLS/security notes
- `API.md` — API contracts and backend behavior
- `DEPLOYMENTS.md` — deployment history and environment notes
- `ROADMAP.md` — phase tracking, milestones and exit criteria

### Documentation quality rule

Do not write vague entries such as "fixed bug" or "updated backend". Use:

**Context → Problem → Investigation → Root Cause → Change → Verification → Remaining Risk → Next Step**

### Status terminology

Use these statuses consistently: `PLANNED`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_TEST`, `TESTING`, `VERIFIED`, `RELEASED`, `DEFERRED`, `REVERTED`.

A feature is not considered `VERIFIED` merely because it works once in a happy-path demo.

### Permanent history rule

Important project knowledge must live in the repository, not only in chat history. When a later change alters an earlier decision, preserve the history and document the new decision rather than silently rewriting the past.

This protocol remains active through **MVP → private pilot → production hardening → launch → post-launch fixes → future releases**.


## 2026-09-19 — Development Status Update

**Current source state:** Phase 1 implementation in progress.

Completed source work includes customer authentication foundation, catalog-backed booking form, authenticated booking API, server-side future-time validation, active catalog validation, core database migration and initial RLS policies.

**Verification status:** Live Supabase integration and production build are not yet verified. The connected Supabase integration does not currently expose the Pickolo project, and the available runtime cannot resolve github.com for a clean npm install/build.

The project documentation records these blockers explicitly. No unverified build or database state is marked as passed.


---

## 16. Mobile Platform Requirement

Pickolo's customer and partner experiences are mobile-first and must support both Android and iOS.

### Mobile architecture

The mobile client will use a shared cross-platform React Native codebase, with Expo used for development and build tooling where appropriate.

Target platforms:
- Android
- iOS

The same business logic, API contracts and backend are shared across both mobile platforms.

### Product surfaces

| Surface | Technology direction | Target |
|---|---|---|
| Customer App | React Native / Expo | Android + iOS |
| Partner App | React Native / Expo | Android + iOS |
| Admin Panel | Next.js web application | Desktop + responsive web |

The current Next.js customer/partner pages are foundation prototypes, not the final Android/iOS application.

### Mobile requirements

- Authentication and session persistence
- Push notifications
- Location permissions and location capture
- Deep links
- Camera / media permissions where required
- Network interruption and retry handling
- Secure token storage
- Android back behavior
- iOS navigation conventions
- Responsive phone layouts
- App versioning and minimum-version handling
- Crash/error monitoring
- App Store and Google Play release workflows

### Mobile development rule

Feature behavior must remain platform-consistent unless a platform-specific behavior is intentionally documented in docs/DECISIONS.md.

When Android and iOS differ in implementation, document: difference → reason → user impact → test coverage.
