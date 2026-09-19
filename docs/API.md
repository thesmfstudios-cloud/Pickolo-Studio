# Pickolo Studio — API Contract

## Current state
No production API contract is frozen yet.

## Planned MVP domains
- Authentication
- Services
- Booking creation
- Booking retrieval
- Booking state transition
- Partner availability
- Partner assignment
- Delivery submission
- Customer confirmation
- Reviews
- Payments and payouts

## Contract standard
Every production endpoint must document:
- Method and path
- Authentication
- Authorization
- Request schema
- Response schema
- Validation errors
- Business-rule errors
- Idempotency requirements
- Audit/logging behavior


## Implemented — Booking API

### POST /api/bookings
**Status:** CODED / LIVE TEST PENDING

Authenticated customer creates a booking in REQUESTED state.

Required fields: service_id, service_level_id, scheduled_start, duration_minutes, location_text.

Duration is restricted to 30, 60 or 120 minutes for the MVP.

Customer identity is taken from the authenticated Supabase user, not a client-supplied customer id.

### GET /api/bookings
**Status:** CODED / LIVE TEST PENDING

Returns the authenticated customer's bookings ordered newest first.

### Security
The route forwards the caller's Authorization header to Supabase and relies on authenticated access plus database RLS. No client is trusted to choose another customer's identity.


## 2026-09-19 — Booking validation hardening
POST /api/bookings now additionally validates:
- scheduled_start is a valid future timestamp
- service exists and is active
- service level exists and is active

These checks happen server-side before the booking insert.


## Pricing API

### GET /api/pricing?level=Basic|Standard|Professional&duration=30|60|120
**Status:** IMPLEMENTED / LIVE TEST PENDING

Returns the server-calculated development booking estimate.

### Important
The current pricing values are development configuration. Commercial rates and commission must be approved and validated before production payment launch.

## Booking lifecycle

### POST /api/bookings/[id]/transition
**Status:** IMPLEMENTED / LIVE TEST PENDING

Validates target state against the server booking state machine and records the transition history.

Customer/assigned-partner authorization is enforced in the current route. Privileged operational actions will move to role-protected admin/server operations before production.
