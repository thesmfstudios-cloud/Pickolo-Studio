# Pickolo Studio — Bug & Issue Log

## Status
OPEN / INVESTIGATING / FIXED / VERIFIED / WONT_FIX / DEFERRED

## B-001 — GitHub repository write access
**Status:** FIXED / VERIFIED

**Symptom:** Initial development could not write to the newly created Pickolo repository.

**Root cause:** The connected GitHub identity initially lacked write access to the repository owner context.

**Resolution:** Repository permissions were corrected.

**Verification:** GitHub now reports admin, maintain, pull, push and triage permissions, and foundation files have been committed successfully.

---

## B-002 — Pickolo Supabase project visibility
**Status:** OPEN / BLOCKED

**Symptom:** The connected Supabase integration currently returns the Aahana AI Influencer project but not the newly created Pickolo project.

**Impact:** Real schema deployment and database verification cannot yet be completed through the connected Supabase integration.

**Next action:** Confirm the Pickolo project belongs to the connected Supabase organization/account, then refresh access.

**Workaround:** Keep schema/application integration isolated until the correct project is verified.

---

## Rule for new bugs

Every bug entry must contain:
**Context → Symptom → Reproduction → Investigation → Root Cause → Fix → Verification → Regression Risk → Related Commit**
