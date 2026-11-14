# TODO

Execution-ready task list for Campaign-Scheduler.

Use the structure from `/mnt/c/git/defaults/dev/TODO_MANAGEMENT.md` for full rules.

## Current Priorities (as of 2026-06-08)

### High
- [ ] Complete Gemini server-side integration (actual `generateContent` calls for availability analysis, summary drafting, and optimal-day suggestions). Currently capability is declared but implementation is partial.
- [ ] Flesh out remaining UI components (full AvailabilityTable polish, Create Campaign flow, User Management).
- [ ] Deploy and validate full Firestore rules + the 12 Dirty Dozen test cases against a real Firebase project.
- [ ] Add proper Express server routes for any server-side Gemini + Gmail flows (currently heavy client + direct Google API calls).
- [ ] Production-ready error handling and rate limiting around Google APIs and Gemini.

### Medium
- [ ] Calendar sync improvements (two-way? player-side event creation).
- [ ] Better week range parsing / timezone handling (current logic is date-based).
- [ ] Export / reporting features (Markdown campaign recaps, CSV availability).
- [ ] Mobile responsiveness and accessibility audit.
- [ ] Seed data expansion and DM onboarding flow.

### Low / Nice-to-Have
- [ ] RSS feed improvements (currently static in index.html).
- [ ] Dark mode / theme toggle.
- [ ] Integration hooks for Foundry VTT (session notes import/export).
- [ ] Discord/Telegram bot bridge for notifications and quick votes.
- [ ] Analytics / historical session success rates powered by Gemini.

## Backlog
(See `README.md` Features section and `security_spec.md` for context.)

Add new items at the top of the relevant section. Mark completed items with date and move to a "Done" section or Changelog.

## Agent Notes
- When working on this project, always start `npm run dev` first.
- Security changes must update `SECURITY.md`, `security_spec.md`, `firestore.rules`, and tests together.
- AI work must be documented with example prompts in the README.