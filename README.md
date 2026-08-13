<!-- markdownlint-disable MD013 -->

# Campaign Session Scheduler

Plan TTRPG sessions across several campaigns without turning availability into another group-chat argument.

![Status](https://img.shields.io/badge/status-pre--release-orange)
![Project](https://img.shields.io/badge/project-TTRPG%20scheduling-7C3AED)
![License](https://img.shields.io/badge/license-not%20yet%20declared-lightgrey)

Campaign Session Scheduler is an early-stage project for collecting player availability, helping a GM lock the next game date, and sharing the result through familiar calendar tools. The goal is one clear weekly view for the whole group, including late arrivals, uncertain players, and campaigns that do not share the same roster.

<!-- Product proof needed: capture the campaign selector and availability grid with a locked game day and GM controls visible. -->

## Current Status

- The public repository currently contains the project overview only.
- No installable application or versioned release has been published yet.
- The local prototype and its Firebase security model still need review before the source is ready for public use.
- The repository does not yet include a license file.

## Planned Capabilities

- **Availability beyond yes or no.** Record `PLAY`, `SKIP`, `MAYBE`, no vote, and several late-arrival windows for each session.
- **Several campaigns in one place.** Keep separate rosters, scheduling weeks, notes, and GM controls without juggling spreadsheets.
- **A date the GM can actually lock.** Move from player votes to a chosen day and start time, with the decision visible to everyone.
- **Portable calendar events.** Download a scheduled game as an `.ics` file without granting access to a Google account.
- **Optional Google workflows.** Add Calendar events and send Gmail notices only when the group chooses to connect those services.
- **Useful change notifications.** Alert players when rosters, votes, dates, or session status change while avoiding duplicate noise.
- **Clear security boundaries.** Restrict campaign administration to GMs and keep players limited to their own availability and notes.

## Before the First Release

The first public build needs:

1. A reviewed source snapshot with reproducible setup instructions.
2. Firebase rules that deny anonymous access and enforce GM and player roles.
3. Emulator coverage for spoofing, cross-campaign access, unsafe IDs, and privilege escalation.
4. Documented Google OAuth scopes and data-handling behavior.
5. A real license, changelog, screenshot, and tagged release.

Do not treat the current repository as deployable software. In particular, no public claim is made yet that its planned Firebase or Google integrations are safe for real campaign data.

## Feedback

Ideas and workflow examples are welcome through [GitHub Issues](https://github.com/apoapostolov/Campaign-Scheduler/issues). Useful reports explain the campaign size, how often the group plays, what makes availability difficult, and which calendar or notification workflow the group already uses.

Campaign Session Scheduler is an unofficial tabletop project and is not affiliated with Google, Firebase, Wizards of the Coast, or any game publisher.
