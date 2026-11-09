# BESPOKE.md

This project is a tailored version of an upstream open-source project, built with the [Bespoke assembly line](https://github.com/pihme/bespoke/blob/main/ASSEMBLY-LINE.md). Each stage has its own branch (`1-raw` … `6-bespoke`) and one chapter here. Decisions are recorded here first; a stage that outgrows its chapter moves the details to `bespoke/<n>-<stage>.md` and links it. Every commit on a stage branch references a decision or intervention ID from this file. The readable summary is [BESPOKE-summary.md](BESPOKE-summary.md); every stage updates both.

## Source

- Upstream repo: https://github.com/portainer/portainer
- Following: tag 2.45.3
- Upstream commit: 0fa764dc81c76bb7914d65d8e62b026d7c746899

## Vision / North Star

A single-user Portainer for a local Docker environment. It runs on the same machine as the Docker daemon and is reachable only locally. It has no user management, no login, no Kubernetes, no Docker Swarm, no edge computing, no registries, and no backup/restore. It adds a maintenance screen so unused containers and images can be removed as quickly as possible. Advertising for the commercial edition is removed.

## Constraints / Do not touch

- Do not change or remove the core functionality for managing local Docker resources.

## Spec

- Feature spec: [docs/portainer-spec.md](docs/portainer-spec.md) (178 requirements `REQ-<AREA>-NN` in 24 areas, written from the upstream docs in RAW-013); testspec: none yet
- Upstream spec: none in the repo. The tree at tag 2.45.3 has no `docs/` directory and no numbered requirements. The product documentation at https://docs.portainer.io/ (index https://docs.portainer.io/llms.txt) is the only feature description. Verdict: not usable as is – it is product documentation, not a requirements list: no IDs, written for Business Edition first with BE-only hints scattered across pages, describing the current 2.45 release rather than exactly this tag, and mixing install guides, FAQs and how-tos with features. It is usable as the source for a spec, so `docs/portainer-spec.md` was written from it, with entry points checked against the router, `api/docs/swagger.yaml` and `api/cli/cli.go`.

## 1 raw

- Upstream commit: 0fa764dc81c76bb7914d65d8e62b026d7c746899
- Built from: upstream
- Skill: fork
- Gate: none at this pin (the tree has no `.github/workflows`; tests were not measured)
- Details: none

### Inventory

- Languages and build system: Go 1.26.10 backend (module `github.com/portainer/portainer`) and a TypeScript/JavaScript frontend that mixes React 17 with AngularJS 1.8.2. The frontend package is `@portainer/ce`, built with webpack 5, pnpm 10.26.2, and Node `^22.22.1`. Client tests use Vitest; server tests use `gotestsum` (`go test` with coverage).
- Build: `make deps` installs client packages with `pnpm install` (CE `server-deps` is empty). `make all` / `make build-all` runs `go mod tidy`, those deps, `make build-server` (`./build/build_binary.sh`) and `make build-client` (`pnpm run build`). `make build-image` then builds a local image tagged `portainerci/portainer-ce:local`. `make dev-server` runs the binary in a `portainer/base` container, publishing ports 8000, 9000 and 9443, and mounting `dist` plus the Docker socket. `make dev-client` runs `pnpm run dev`.
- Tests and result: `make test` runs `make test-server` (`gotestsum` over `./...` with `-cover`) and `make test-client` (`pnpm run test --coverage`, which is `vitest run`). Result: not measured on 2026-11-09. The working copy used for this walk was a sparse checkout, and the inventory host had Node v24.22.1 and Go 1.27.3 (the tree asks for Node `^22.22.1` and Go 1.26.10). This commit has no GitHub Actions workflows to read a CI result from.
- License: zlib. The `LICENSE` file is the zlib text, Copyright (c) 2018 Portainer.io. `ATTRIBUTIONS.md` lists third-party code under CC BY 4.0 (angular-json-tree, caniuse-db, caniuse-lite, Font Awesome icons), CC BY 3.0 (spdx-exceptions), and MIT (UI For Docker, rdash-angular).
- Direct dependencies: 66 direct Go modules in the first `require` block of `go.mod`, including Docker/Compose/containerd, Kubernetes/Helm clients, LDAP, JWT, chisel, bbolt, and AWS ECR. The frontend `package.json` listed 105 runtime dependencies and 101 devDependencies at inventory (RAW-012), including husky ^8.0.0; the `.husky` hook was removed in RAW-007 and the leftover husky and lint-staged dependencies in RAW-014.
- Shipped artifacts and size: this fork has no GitHub release. Upstream portainer/portainer release 2.45.3 (published 2026-10-21T23:20:29Z, 22 Oct 2026, 00:20 Europe/Berlin) ships these tarballs, sizes in bytes: linux-amd64 44,172,112; linux-arm 41,534,633; linux-arm64 40,410,984; linux-ppc64le 40,116,764; windows1809-amd64 44,927,455; windowsltsc2022-amd64 44,927,329; windowsltsc2025-amd64 44,927,428. Docker Hub tag `portainer/portainer-ce:2.45.3` was last updated 2026-10-21T23:28:31Z; the linux/amd64 image size reported there is 44,868,306 bytes.

### Decisions

| ID | Decision | Reason | Decided by | Replay hint |
|----|----------|--------|------------|-------------|
| RAW-001 | Fork portainer/portainer as public pihme/bespoke-portainer-ce at tag 2.45.3 (commit 0fa764dc81c76bb7914d65d8e62b026d7c746899), and start the raw stage on `1-raw` at that commit. | The user asked for that repo name and that release tag rather than the moving `release/2.45` branch. | user | `gh repo fork portainer/portainer --fork-name bespoke-portainer-ce`, then create `1-raw` at `0fa764dc81c76bb7914d65d8e62b026d7c746899`. Do not use `--default-branch-only`; the default branch was not this tag. |
| RAW-002 | Remove `CLAUDE.md`. | The user asked to drop the upstream agent instruction file. It also pointed at `docs/guidelines/*`, which are not in this tree. | user | Do not restore `CLAUDE.md`. |
| RAW-003 | Remove `CONTRIBUTING.md`. | The user asked to drop the upstream contribution process, which pointed people at portainer/portainer issues. | user | Do not restore `CONTRIBUTING.md`. |
| RAW-004 | Remove `SECURITY.md` and `CODE_OF_CONDUCT.md`. | The user asked to drop them. They pointed reports at security@portainer.io and contribute@portainer.io. | user | Do not restore these files. |
| RAW-005 | Remove `.github/ISSUE_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`, `.github/DISCUSSION_TEMPLATE/`, and `.github/PULL_REQUEST_TEMPLATE.md`. | The user asked to drop the issue, pull-request, and discussion templates. They routed people to upstream discussions and advertised Portainer Business Edition. | user | Do not restore these paths. |
| RAW-006 | Strip upstream contacts and Portainer Business Edition advertising from `README.md`. Keep the Community Edition description, intended-use text that is not a BE upsell, Getting started documentation links, and the licensing section. | The user asked to strip contacts and BE advertising from the README. | user | Do not put back Take3/BE links, contribute@portainer.io, the careers pitch, or links to portainer/portainer issues and releases. |
| RAW-007 | Remove the `.husky` pre-commit hook. | The user asked to drop the hook that forced `pnpm lint-staged` on every commit. | user | Do not restore `.husky`. The leftover `lint-staged.config.js` and husky/lint-staged dependencies were removed in RAW-014. |
| RAW-008 | Remove the upstream banner image and the docs.portainer.io Getting started links from `README.md`. | The user asked to drop the remaining upstream README links. | user | Do not restore the banner URL or the documentation links. |
| RAW-009 | Add the optional zlib acknowledgment (that this software is based on Portainer Community Edition by Portainer.io) in the last stage, `6-bespoke` (shrink-wrap). | The user asked to include that courtesy credit at the end of the line, not earlier. | user | Do it in shrink-wrap. Do not add the credit in raw, covered, tailored, customized, or trimmed. Keep `LICENSE` as required by the license notice rule. |
| RAW-010 | Record the vision and the do-not-touch constraint from the user's product-vision message. | The user stated them. Later stages check decisions against these sections. | user | Keep the wording in Vision / North Star and Constraints unless the user changes it. |
| RAW-011 | Extend the vision: backup and restore are also removed. | The user asked to drop backup/restore as well. | user | Keep “no backup/restore” in Vision / North Star unless the user changes it. |
| RAW-012 | Record the raw-stage inventory from the tree and the upstream 2.45.3 release. Tests were not run. | Taking stock is part of the raw stage. | agent | Re-run `make test` on a full checkout with Node ^22.22.1 and Go 1.26.10 before treating the test result as measured. |
| RAW-013 | The feature spec is `docs/portainer-spec.md`. No testspec yet. | Upstream docs at docs.portainer.io are not a numbered-requirements list, so a new spec was written from them (178 requirements, BE-only features labeled, the planned maintenance screen kept out as not upstream). The location and the list are the agent's choice; the user has not yet seen or approved the list. | agent (location) | Keep later stages on this file. Mark removed or changed requirements by ID there instead of renumbering. |
| RAW-014 | Remove `lint-staged.config.js` and the unused `husky` and `lint-staged` devDependencies from `package.json`. | The user asked to drop the leftover hook wiring after RAW-007 removed the hook itself. | user | Do not restore `lint-staged.config.js` or add `husky` or `lint-staged` back to `package.json`. |
| RAW-015 | Remove `homepage`, `bugs`, `repository`, and the `licenses` URL from `package.json`. Keep `author` (`Portainer.io`), the package name (`@portainer/ce`), and the `licenses` type (`Zlib`). | The user asked to drop these upstream contacts. They pointed at portainer.io, the portainer/portainer issue tracker and git remote, and the upstream `develop` LICENSE. | user | Do not put those fields back. Keep `author` and the package name unless the user changes them. |

### Interventions

Work the user asked for that is not this stage's goal. Same ID series; does not count toward the exit.

| ID | Intervention | Reason | Decided by | Replay hint |
|----|--------------|--------|------------|-------------|

### Last run

- 2026-11-09. Inventory recorded (RAW-012). Tests not measured. Feature spec `docs/portainer-spec.md` added (RAW-013) and shown to the user. Second-pass drops: leftover lint-staged and Husky wiring (RAW-014), upstream contacts in package.json (RAW-015).
- 2026-11-09, exit: raw-stage goal met (public fork `pihme/bespoke-portainer-ce` at tag 2.45.3, commit `0fa764dc81c76bb7914d65d8e62b026d7c746899`, plus `BESPOKE.md`, `BESPOKE-summary.md`, `docs/portainer-spec.md` with 178 requirements, and the agent-instruction and upstream-process drops the user accepted through RAW-015). No CI gate to run: this pin has no workflows. Tests not measured. User confirmed the exit.

## 2 covered

- Upstream commit: <sha of 1-raw this run started from>
- Built from: 1-raw@<sha>
- Skill: increase-test-coverage
- Gate: <command(s) that must pass at the end of this stage>
- Details: none (or bespoke/2-covered.md)

### Decisions

| ID | Decision | Reason | Decided by | Replay hint |
|----|----------|--------|------------|-------------|
| COV-001 | | | user / agent | |

### Interventions

Work the user asked for that is not this stage's goal. Same ID series; does not count toward the exit.

| ID | Intervention | Reason | Decided by | Replay hint |
|----|--------------|--------|------------|-------------|

### Last run

- Date, result (passed / failed at decision ID), notes
- Date, exit: <how the stage goal was verified>; gate passed in CI; user confirmed

## 3 tailored

- Upstream commit: <sha of 1-raw this run started from>
- Built from: 2-covered@<sha>
- Skill: remove-features
- Gate: <command(s) that must pass at the end of this stage>
- Details: none (or bespoke/3-tailored.md)

### Decisions

| ID | Decision | Reason | Decided by | Replay hint |
|----|----------|--------|------------|-------------|
| TAI-001 | | | user / agent | |

### Interventions

Work the user asked for that is not this stage's goal. Same ID series; does not count toward the exit.

| ID | Intervention | Reason | Decided by | Replay hint |
|----|--------------|--------|------------|-------------|

### Last run

- Date, result (passed / failed at decision ID), notes
- Date, exit: <how the stage goal was verified>; gate passed in CI; user confirmed

## 4 customized

- Upstream commit: <sha of 1-raw this run started from>
- Built from: 3-tailored@<sha>
- Skill: customize-features
- Gate: <command(s) that must pass at the end of this stage>
- Details: none (or bespoke/4-customized.md)

### Decisions

| ID | Decision | Reason | Decided by | Replay hint |
|----|----------|--------|------------|-------------|
| CUS-001 | | | user / agent | |

### Interventions

Work the user asked for that is not this stage's goal. Same ID series; does not count toward the exit.

| ID | Intervention | Reason | Decided by | Replay hint |
|----|--------------|--------|------------|-------------|

### Last run

- Date, result (passed / failed at decision ID), notes
- Date, exit: <how the stage goal was verified>; gate passed in CI; user confirmed

## 5 trimmed

- Upstream commit: <sha of 1-raw this run started from>
- Built from: 4-customized@<sha>
- Skill: trim
- Gate: <command(s) that must pass at the end of this stage>
- Details: none (or bespoke/5-trimmed.md)

### Decisions

| ID | Decision | Reason | Decided by | Replay hint |
|----|----------|--------|------------|-------------|
| TRM-001 | | | user / agent | |

### Interventions

Work the user asked for that is not this stage's goal. Same ID series; does not count toward the exit.

| ID | Intervention | Reason | Decided by | Replay hint |
|----|--------------|--------|------------|-------------|

### Last run

- Date, result (passed / failed at decision ID), notes
- Date, exit: <how the stage goal was verified>; gate passed in CI; user confirmed

## 6 bespoke

- Upstream commit: <sha of 1-raw this run started from>
- Built from: 5-trimmed@<sha>
- Skill: shrink-wrap
- Gate: <command(s) that must pass at the end of this stage>
- Details: none (or bespoke/6-bespoke.md)

### Decisions

| ID | Decision | Reason | Decided by | Replay hint |
|----|----------|--------|------------|-------------|
| BSP-001 | | | user / agent | |

### Interventions

Work the user asked for that is not this stage's goal. Same ID series; does not count toward the exit.

| ID | Intervention | Reason | Decided by | Replay hint |
|----|--------------|--------|------------|-------------|

### Last run

- Date, result (passed / failed at decision ID), notes
- Date, exit: <how the stage goal was verified>; gate passed in CI; user confirmed
