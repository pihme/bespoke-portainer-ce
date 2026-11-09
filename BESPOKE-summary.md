# BESPOKE summary

> Readable summary of [BESPOKE.md](BESPOKE.md), which stays the authoritative protocol. Every stage updates both files.

## What this project is

- A tailored fork of <upstream repo>, following <branch> at upstream commit <short sha>.
- Vision: <one or two sentences from BESPOKE.md>.
- Constraints: <the Do-not-touch items, short>.

## Current state at a glance

Only facts recorded in BESPOKE.md or verified in the repo. Say when a number was not re-measured.

- Coverage: <number, where it was measured>
- Tests: <counts per suite, at which stage>
- Build and CI: <how it builds; which gates CI runs>
- Run: <command>

## Stages

Per stage, 2 to 4 sentences on what changed in the content (what was added, tested, removed, customized, trimmed or packaged), with the decision ID range in parentheses. No process details here.

**1-raw** (RAW-001 to RAW-007). Forked Portainer Community Edition 2.45.3 as `bespoke-portainer-ce`. Removed upstream agent instructions, contribution and security/conduct files, GitHub issue, pull-request and discussion templates, README contacts and Business Edition advertising, and the Husky pre-commit hook.

**2-covered** (COV-001 to COV-nnn). <...>

**3-tailored** (TAI-001 to TAI-nnn). <...>

**4-customized** (CUS-001 to CUS-nnn). <...>

**5-trimmed** (TRM-001 to TRM-nnn). <...>

**6-bespoke** (BSP-001 to BSP-nnn). <...>

## What changed for users

Removed:

- <user-visible feature>

Customized:

- <user-visible change>

## Open points

Process issues only: commits without a decision ID, a gate that CI no longer runs, commits after a stage's exit, anything the protocol and the repo disagree on. Name the commit or decision.

- This commit of portainer/portainer has no `.github/workflows`, no FUNDING file, no CODEOWNERS, and no Dependabot config, so there was nothing in those classes for the first pass to keep or drop.
- `README.md` still links to official documentation at docs.portainer.io and still loads the banner image from portainer/portainer on `develop`. Those were not part of the contact/BE-advertising drop.
