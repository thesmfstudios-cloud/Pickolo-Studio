# Phase 3 — Partner Workflow

**Status:** IN_PROGRESS

## Implemented

- Partner signup
- Partner application
- Admin verification
- Partner profile
- Partner base location
- Availability windows
- Partner job inbox
- Role-specific lifecycle transitions
- Partner cancellation
- No-show recovery
- Emergency reassignment
- Delivery submission
- Performance counters
- Payout visibility
- Partner notifications

## Assignment eligibility

A candidate partner must satisfy:
- approved verification
- sufficient service level
- overlapping availability
- 5 KM pilot radius
- booking not already concurrently assigned

## Recovery

Partner cancellation / no-show:
→ incident log
→ clear failed assignment
→ SEARCHING_PARTNER
→ eligible backup assignment

## Remaining

- Live Supabase verification
- KYC/document verification policy
- richer portfolio
- automated assignment ranking
- real payout provider
- production push credentials
- Android/iOS end-to-end device tests

## Exit criteria

A verified partner can receive, accept, execute and deliver a booking; operational failure can be recovered without losing the booking; customer confirmation is recorded; performance data is updated.
