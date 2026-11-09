# BESPOKE summary

> Readable summary of [BESPOKE.md](BESPOKE.md), which stays the authoritative protocol. Every stage updates both files.

## What this project is

- A tailored fork of https://github.com/portainer/portainer, following tag 2.45.3 at upstream commit 0fa764dc81c76bb7914d65d8e62b026d7c746899.
- Vision: A single-user, locally reachable Portainer for Docker on the same machine, without user management, login, Kubernetes, Swarm, edge, registries, or backup/restore, plus a maintenance screen for unused containers and images, and no commercial-edition advertising.
- Constraints: Do not touch the core functionality for managing local Docker resources.

## Current state at a glance

Only facts recorded in BESPOKE.md or verified in the repo. Say when a number was not re-measured.

- Coverage: not measured (tests not run on 2026-11-09)
- Tests: `make test` (`gotestsum` ./... and `vitest run --coverage`); result not measured on 2026-11-09
- Build and CI: `make all` builds server and client; `make build-image` builds `portainerci/portainer-ce:local`. This commit has no GitHub Actions workflows.
- Run: `make dev-server` (container on 8000/9000/9443) and `make dev-client`

## Stages

Per stage, 2 to 4 sentences on what changed in the content (what was added, tested, removed, customized, trimmed or packaged), with the decision ID range in parentheses. No process details here.

**1-raw** (RAW-001 to RAW-015). Forked Portainer Community Edition 2.45.3 as `bespoke-portainer-ce`. Removed upstream agent instructions, contribution and security/conduct files, GitHub issue, pull-request and discussion templates, README contacts, Business Edition advertising, the upstream banner and documentation links, and the Husky pre-commit hook. Removed the leftover lint-staged config and the unused husky and lint-staged dependencies (RAW-014). Removed upstream homepage, bugs, repository and license URL fields from package.json (RAW-015). An optional zlib acknowledgment is scheduled for `6-bespoke` (RAW-009). Added the feature spec `docs/portainer-spec.md`, a numbered list of upstream Portainer features (including Business Edition-only ones, labeled) written from docs.portainer.io (RAW-013).

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
