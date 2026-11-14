# Security Specification for D&D Campaign Session Scheduler

This document outlines the security rules, invariants, and edge-case validation specs for the Campaign Session Scheduler application.

## 1. Data Invariants

1. **User Profiles (`/users/{userId}`)**:
   - A user profile can only be created by the authenticated owner (`request.auth.uid == userId`).
   - Private attributes like Gmail syncing can only be updated by the resource owner.

2. **Campaign metadata (`/campaigns/{campaignId}`)**:
   - A campaign can only be updated by its creator/DM (`resource.data.dmUserId == request.auth.uid`).
   - The user creating the campaign must be the designated DM (`request.resource.data.dmUserId == request.auth.uid`).

3. **Player Availabilities (`/campaigns/{campaignId}/availabilities/{userId}`)**:
   - A user can only write (create or update) their own availability schedule (`request.auth.uid == userId`).
   - A user's availability must belong to an existing, valid campaign.
   - Values must strictly match the allowed status enum: `PLAY`, `SKIP`, `MAYBE`, `LATE 1 HR`, `LATE 30 MIN`, `NO-VOTE`.

4. **Game Sessions (`/campaigns/{campaignId}/sessions/{sessionId}`)**:
   - Only the designated DM of the parent campaign can create, update, or delete sessions.

---

## 2. The "Dirty Dozen" Payloads (Anti-Spoofing & Privilege Escalation)

Below are 12 specific JSON payloads designed to break our security invariants, which are strictly blocklisted / denied by Firestore Rules.

1. **Identity Spoofing: Overwrite Another User Profile**
   - Attempting to overwrite user profile `userId_A` while authenticated as `userId_B`.
2. **Campaign Theft: DM Impersonation**
   - User `player_A` attempting to edit the metadata of a campaign owned by `dm_B`.
3. **Ghost Player: Self-Assigning to Campaign Roster**
   - User `attacker` directly writing to `/campaigns/{campaignId}` to inject their ID into the `playerUids` list bypassing DM approval.
4. **Schedule Vandalism: Overwrite Someone Else's Availability**
   - User `player_A` attempts to write availability for `player_B` in `/campaigns/{campaignId}/availabilities/player_B`.
5. **Session Injection: Player Scheduling Games**
   - User `player_A` (who is not the DM) attempts to create or schedule a session in `/campaigns/{campaignId}/sessions/{sessionId}`.
6. **Value Poisoning: Corrupting Availability Enum**
   - Attempting to set an availability selection to a malicious high load string (e.g., 1MB text) or `HACKED`.
7. **Negative session counter: DM Privilege Escalation**
   - DM setting the session counter of their campaign to a negative value or invalid typing like a boolean.
8. **Immutable Violation: Modification of Campaign ID**
   - DM attempts to update a campaign document with a modified `id` field.
9. **Spam IDs: High Payload Character ID**
   - Attempting to create a campaign or session with document IDs exceeding 128 characters or containing unsafe punctuation.
10. **Temporal Bypass: Spoofing Creation Timestamps**
    - Client attempts to submit a hardcoded yesterday's timestamp for `createdAt` instead of using the mandatory `request.time` server timestamp.
11. **Anonymity Escalation: Unverified Account Writes**
    - Unauthenticated or anonymous user attempting to write a new campaign.
12. **PII Scraping: Listing Private User Settings**
    - User `player_A` attempting to query and download the Gmail Sync settings list of all users.

---

## 3. Test Cases (TDD Rules Validation)

All above cases must evaluate to `PERMISSION_DENIED` at the Firestore Rule level. The production security rules file `firestore.rules` enforces these conditions mathematically.
