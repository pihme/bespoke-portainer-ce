# BESPOKE summary

> Readable summary of [BESPOKE.md](BESPOKE.md), which stays the authoritative protocol. Every stage updates both files.

## What this project is

- A tailored fork of https://github.com/portainer/portainer, following tag 2.45.3 at upstream commit 0fa764dc81c76bb7914d65d8e62b026d7c746899.
- Vision: A single-user, locally reachable Portainer for Docker on the same machine, without user management, login, Kubernetes, Swarm, edge, registries, or backup/restore, plus a maintenance screen for unused containers and images, and no commercial-edition advertising.
- Constraints: Do not touch the core functionality for managing local Docker resources.

## Current state at a glance

Only facts recorded in BESPOKE.md or verified in the repo. Say when a number was not re-measured.

- Coverage: 32.7 % of statements project-wide (22,118 of 67,714), measured 2026-11-09 with `nix develop -c make test` after COV-009 (`coverage.include: ['app/**']`); Go 40.8 %, client 25.2 %
- Tests: `make test` (`gotestsum` ./... and `vitest run --coverage`); both suites green on that remeasurement (Go 3,454 tests / 69 skipped / 0 failed; client 2,282 passed / 5 skipped / 12 todo / 0 failed)
- Build and CI: `make all` builds server and client; `make build-image` builds `portainerci/portainer-ce:local`. This commit has no GitHub Actions workflows.
- Run: `make dev-server` (container on 8000/9000/9443) and `make dev-client`

## Stages

Per stage, 2 to 4 sentences on what changed in the content (what was added, tested, removed, customized, trimmed or packaged), with the decision ID range in parentheses. No process details here.

**1-raw** (RAW-001 to RAW-015). Forked Portainer Community Edition 2.45.3 as `bespoke-portainer-ce`. Removed upstream agent instructions, contribution and security/conduct files, GitHub issue, pull-request and discussion templates, README contacts, Business Edition advertising, the upstream banner and documentation links, and the Husky pre-commit hook. Removed the leftover lint-staged config and the unused husky and lint-staged dependencies (RAW-014). Removed upstream homepage, bugs, repository and license URL fields from package.json (RAW-015). An optional zlib acknowledgment is scheduled for `6-bespoke` (RAW-009). Added the feature spec `docs/portainer-spec.md`, a numbered list of upstream Portainer features (including Business Edition-only ones, labeled) written from docs.portainer.io (RAW-013). The user confirmed the raw-stage exit on 2026-11-09, with no CI gate to run and tests not measured.

**2-covered** (COV-001 to COV-nnn). Inventoried the existing Go and Vitest test suites and their isolation problems in [docs/portainer-test-strategy.md](docs/portainer-test-strategy.md) (COV-001). Fixed the order-dependent and state-leaking tests, put the Docker and DNS tests behind the existing integration gate, and stopped Vitest from hiding failures; both suites now pass, the client suite also in a shuffled order (COV-002). Added a pinned Nix shell with the tree's Go, Node, pnpm and make versions (COV-003). Excluded the generated OpenAPI client under `app/react/portainer/generated-api/` from frontend coverage; the Go code has no generated sources (COV-004). Moved the 100 MB crypto test and the fuzz seed corpus out of the ordinary run behind `performance` and `fuzz` build tags, each with its own make target (COV-005). Mapped all 178 requirements of the feature spec to the existing tests in [docs/portainer-testspec.md](docs/portainer-testspec.md): 96 have tests, 82 have none, only loosely related ones, or are Business Edition-only or outside the repo; the user then settled the open questions: webhooks, template variables, Kubernetes scale and restart, Edge async mode and built-in roles count as CE features, the SSRF default stays off, and today's limits are pinned as 14 deduced requirements without new caps (COV-007). The first coverage measurement found 48.8 % of statements covered (Go 40.8 %, frontend 68.5 % of the files tests load) (COV-008). The user then required every `app/**` source in the client measurement and a vision-aware Priority/Deferred package order; remeasurement is 32.7 % project-wide (Go 40.8 %, client 25.2 %), overshoot 95.5 %, and Priority packages alone cannot reach it (COV-009). Priority packages closed through stacks, endpoints, migrator, frontend api services, docker proxy, filesystem, parent services, docker helpers, and stack deployments (COV-010–COV-039; Deferred-within-package applied). The user decided to exit covered after Priority without testing Deferred (COV-012). Project-wide coverage last measured 32.7 % (COV-009); not re-measured this slice. <...>

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
- The raw stage exited on 2026-11-09 without a CI-passing gate (no workflows at this pin) and without a measured test result. The user confirmed that exit.
