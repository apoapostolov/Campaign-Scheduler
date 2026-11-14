# Security

This project ships with a production-grade security model focused on role separation (DM vs Players) and defense against privilege escalation and spoofing.

## Core Documents
- `security_spec.md` — The authoritative specification (data invariants + "The Dirty Dozen" anti-spoofing payloads that **must** all return `PERMISSION_DENIED`).
- `firestore.rules` — The live, enforceable rules. These are the source of truth for runtime behavior.
- `firebase-blueprint.json` — Schema definitions that the rules and client code must respect.

## Key Invariants (Summary)
- Only the designated DM (`dmUserId`) can create/update/delete campaigns and sessions.
- Players can only write their **own** availability documents (`/campaigns/{campaignId}/availabilities/{theirUserId}`).
- Availability status values are strictly limited to the enum defined in `src/types.ts`.
- All privileged fields (DM identity, session status transitions, calendar event IDs) are protected.
- Unauthenticated or anonymous writes are denied for campaigns/sessions.

## The "Dirty Dozen" (Must-Fail Test Cases)
The full list of 12 attack payloads is in `security_spec.md`. They cover:
1. Identity spoofing / overwriting other users' profiles.
2. Campaign theft (non-DM editing DM-owned metadata).
3. Ghost players injecting themselves into rosters.
4. Schedule vandalism (writing another player's availability).
5. Session injection by non-DMs.
6. Value poisoning / enum corruption.
7. Negative counters and type abuse for privilege escalation.
8. Immutable field tampering (campaign IDs).
9. Overly long or malicious document IDs.
10. Timestamp spoofing.
11. Anonymous writes.
12. PII scraping / bulk private data access.

**All must evaluate to permission denied at the Firestore rules layer.**

## Operational Security
- **Always deploy `firestore.rules`** before exposing a new instance to players.
- Test the Dirty Dozen cases when making security-relevant changes.
- The `handleFirestoreError` helper in `src/firebase.ts` logs rich auth context on every error — use it.
- Google OAuth tokens (Calendar + Gmail) are highly privileged. Scope requests and token handling are in `src/firebase.ts` and `src/utils/googleApis.ts`.
- Gemini prompts must never leak sensitive player notes or PII unless the user has explicitly opted in.

## Reporting & Response
If you discover a bypass:
1. Do **not** create a public issue with exploit details.
2. Contact the maintainer privately.
3. Reference the specific invariant or Dirty Dozen case.

See also the shared `dev/SECURITY.md` from defaults for general repository security practices.

---

**This security model is a core feature of the project.** Changes here should be rare and heavily reviewed.