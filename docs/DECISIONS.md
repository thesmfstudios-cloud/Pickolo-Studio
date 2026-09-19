# Pickolo Studio — Architecture & Product Decisions

## D-001 — Local-first MVP
**Date:** 2026-09-19  
**Decision:** Start with a controlled 5 KM operating radius and short photography assignments.  
**Reason:** Validate fulfillment density and transaction economics before geographic expansion.  
**Status:** ACTIVE

## D-002 — Three product surfaces
**Decision:** Customer App, Partner App and Admin Panel share one backend.  
**Reason:** Marketplace, supply and operational workflows need separate interfaces with shared transaction state.  
**Status:** ACTIVE

## D-003 — Manual intervention is first-class
**Decision:** Admin can manually assign and reassign jobs and handle failures.  
**Reason:** Early marketplace automation must remain recoverable and debuggable.  
**Status:** ACTIVE

## D-004 — Deterministic assignment before AI
**Decision:** MVP assignment uses explicit eligibility, radius, availability and performance rules.  
**Reason:** Predictability is more valuable than opaque optimization at small scale.  
**Status:** ACTIVE

## D-005 — Booking state machine is authoritative
**Decision:** Backend controls valid booking state transitions.  
**Reason:** Payment, assignment, delivery and payout require an auditable lifecycle.  
**Status:** ACTIVE

## D-006 — Delivery is part of fulfillment
**Decision:** Shoot completion does not equal final completion until agreed data delivery is confirmed.  
**Reason:** A photography transaction is incomplete when captured data is not delivered.  
**Status:** ACTIVE

## D-007 — Documentation is part of implementation
**Decision:** Meaningful features are incomplete until implementation, testing and documentation are updated together.  
**Reason:** The repository must preserve engineering knowledge independently of chat history.  
**Status:** ACTIVE


## D-008 — Android + iOS cross-platform mobile
**Date:** 2026-09-19  
**Decision:** Customer and Partner experiences will be built as cross-platform React Native applications targeting Android and iOS. The Admin Panel remains a Next.js web application.  
**Reason:** Maintain one mobile codebase across both platforms while sharing the same backend, API contracts and business rules.  
**Status:** ACTIVE

## D-009 — Mobile codebase structure
**Decision:** Keep mobile application code separate from the Next.js admin/web application. Customer and Partner experiences may share common mobile UI/domain modules while retaining role-specific screens and workflows.  
**Reason:** Avoid coupling the mobile runtime to the web admin application and make Android/iOS release testing explicit.  
**Status:** ACTIVE


## D-010 — Separate Customer and Partner mobile applications
**Date:** 2026-09-19  
**Decision:** Customer and Partner are separate Expo applications targeting Android and iOS.  
**Reason:** Their navigation, permissions and operational workflows differ; separate app boundaries reduce role leakage and simplify release management.  
**Status:** ACTIVE

## D-011 — Shared mobile backend/client contract
**Date:** 2026-09-19  
**Decision:** Both mobile apps share Supabase services, backend APIs, booking state definitions and validation rules.  
**Reason:** Business rules must remain consistent across customer and partner experiences.  
**Status:** ACTIVE
