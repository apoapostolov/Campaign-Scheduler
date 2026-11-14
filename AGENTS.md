# AGENTS.md — Campaign-Scheduler

**Project-specific operating contract.**  
This takes precedence over the shared defaults at `/mnt/c/git/defaults/AGENTS.md`.

## Project Identity
- **Name**: Campaign Session Scheduler (D&D Adventure Scheduler)
- **Domain**: TTRPG campaign coordination, real-time availability, DM tooling, Google Calendar/Gmail automation, server-side Gemini AI.
- **Stack**: React 19 + Vite + TS + Firebase (Firestore + Auth + Google OAuth) + @google/genai + Express (server-side).
- **Key Constraints**: Extremely strict Firestore security (see `security_spec.md` + `firestore.rules`). DM authority must never be bypassable. Player data is self-service only.
- **Deployment Context**: Google AI Studio applet (Cloud Run capable), with injected `GEMINI_API_KEY` and `APP_URL`.

## Source Hierarchy (this project)
1. Explicit user instruction (current session or issue).
2. This `AGENTS.md`.
3. `/mnt/c/git/defaults/AGENTS.md` (shared contract).
4. `README.md`, `TODO.md`, `CHANGELOG.md`, `SECURITY.md`, `security_spec.md`.
5. Source (`src/`, `firebase-blueprint.json`, types, utils).
6. External best practices (only after local patterns understood).

## Project-Specific Rules
- **Security First**: Every change touching data models, writes, or auth must be validated against the "Dirty Dozen" in `security_spec.md`. Update rules + tests/docs together.
- **AI / Gemini**: All Gemini usage is server-side. Document prompts and capabilities in README. Never put player PII or sensitive notes into prompts without explicit consent.
- **Google Integrations**: Calendar and Gmail scopes are privileged. Changes to `googleApis.ts`, notifications, or calendar event logic require extra review.
- **Week & Scheduling Logic**: Auto-rotation, gameWeekDays, time overrides, and sessionCounter are core invariants. Test edge cases (timezones, Bulgarian weekday names, late options).
- **Real-time & Notifications**: onSnapshot listeners + browser Notification + Gmail are sensitive to spam. Use the `isInitial*Load` guards and self-edit filters.
- **Seeding**: `src/utils/dbSeed.ts` must remain safe for first-run and DM-linked seeding.
- **Public Repo Hygiene**: This lives in `git-public`. No secrets in code. Use `.env.example` and AI Studio secrets.

## Standard Work Loop (adapted)
Follow the shared defaults loop in `/mnt/c/git/defaults/AGENTS.md`.

**This project specifics**:
- Always start `npm run dev` early (port 3000, host 0.0.0.0) so HMR reflects UI/table changes immediately.
- When touching Firestore: test with the security rules locally if possible, or use the emulator + the exact "Dirty Dozen" payloads.
- For AI changes: test prompts against real availability data shapes from `types.ts`.
- Update `firebase-blueprint.json` and `security_spec.md` when the data model evolves.
- Seed data uses Bulgarian weekday names — keep that consistent.

## Learning & Skills
- Mine reusable skills for: Firebase security patterns, Gemini server-side usage with OAuth tokens, complex real-time availability grids, Google API (Calendar + Gmail send) flows, notification deduping.
- After significant work (new feature, security hardening, AI prompt engineering), update this file, `TODO.md`, and consider promoting patterns to global skills.

See full shared contract: `/mnt/c/git/defaults/AGENTS.md`

---

**Last updated**: 2026-06-08 (project initialization + source integration)