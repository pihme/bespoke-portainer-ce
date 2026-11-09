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

- Upstream commit: 7382c727c46cf7c61701e09c8b61eb6432f0d91a
- Built from: 1-raw@7382c727c46cf7c61701e09c8b61eb6432f0d91a
- Skill: increase-test-coverage
- Gate: <command(s) that must pass at the end of this stage>
- Details: test strategy and A0 inventory in [docs/portainer-test-strategy.md](docs/portainer-test-strategy.md); test spec in [docs/portainer-testspec.md](docs/portainer-testspec.md)

### Decisions

| ID | Decision | Reason | Decided by | Replay hint |
|----|----------|--------|------------|-------------|
| COV-001 | Record the phase A0 test-suite inventory (structure, isolation findings F-01 to F-15, two runs per suite including a shuffled one) in `docs/portainer-test-strategy.md`. | Skill step A0 requires the inventory before any test is added; there was no test strategy yet. | agent (inventory) | Keep later coverage work (A1, A2, B, C, D) on this file. Findings F-01 to F-15 were decided in COV-002. |
| COV-002 | Isolation findings package: fix F-01 (global logger), F-08 (environment and package state), F-09, F-10, F-11 (order-dependent client tests), F-13 (`bail: 0`) and F-14 (`.gitignore` coverage output) in tests and test config; move F-02 (Docker) and F-03 (DNS) behind the existing `testhelpers.IntegrationTest` gate; label F-05 `performance` and F-06 `fuzz` in A2; leave F-04, F-07, F-12 and F-15. | The user accepted the proposed action for every finding on 2026-11-09. Fixes touch tests and test config only. | user | See the Decision and Status columns in [docs/portainer-test-strategy.md](docs/portainer-test-strategy.md) section 3. Do not enable shuffle by default; apply the F-05 and F-06 labels in A2. F-07 needs production code and stays open. |
| COV-004 | Phase A1: treat the `@hey-api/openapi-ts` client `app/react/portainer/generated-api/**` as the only generated code and exclude it from Vitest coverage (`coverage.exclude` in `vitest.config.mts`). swag/openapi YAML in `api/docs/` is not instrumented; the Go tree has no generated sources, and Go cover has no per-file exclude. | Skill step A1: generated sources stay outside the measurement where the tool allows, and get no tests. | agent (inventory) | Re-run the search after `make generate-api` or any new generator; keep new generated paths in `coverage.exclude`. Details and limits in [docs/portainer-test-strategy.md](docs/portainer-test-strategy.md) section 6. |
| COV-005 | Phase A2: label slow tests with Go build tags and keep them out of the reference test set. F-05 `Test_encryptAndDecrypt_withTheSamePassword` moved unchanged to `api/crypto/aes_performance_test.go` (`//go:build performance`); F-06 `FuzzParseForwardedHeaderProto` moved unchanged to `api/http/middlewares/proxy_headers_fuzz_test.go` (`//go:build fuzz`). New targets `make test-fuzz` (seed corpus; `FUZZTIME=` fuzzes) and `make test-performance` (tagged tests and the 24 existing benchmarks); `COVERPROFILE` variable for `test-server`. Reference-set run and coverage stay `nix develop -c make test`. No mutation tests exist; no frontend fuzz or performance tests. | Skill step A2, applying the user's COV-002 labels for F-05 and F-06; the search found no other fuzz, property, mutation or performance test apart from the benchmarks, which `go test` runs only with `-bench`. | agent (following user labels from COV-002) | Put a new fuzz or performance test in a `*_fuzz_test.go` / `*_performance_test.go` file with the matching `//go:build` line; the Makefile finds it. `api/crypto` coverage drops from 70.0 % to 59.3 %, to be recovered with small-input tests in phase C. Details in [docs/portainer-test-strategy.md](docs/portainer-test-strategy.md) section 7. |
| COV-006 | Phase B: map every requirement of `docs/portainer-spec.md` (178 IDs) to the existing Go and Vitest tests in `docs/portainer-testspec.md`, under their current upstream names (no renames); record 13 requirement clarifications (C-01 to C-13), 14 resource-limit clarifications (L-01 to L-14), one proposed deduced requirement (REQ-DED-01) and the behaviour without an ID for the backwards-compatibility tests. The open clarifications are the user's to decide. | Skill step B; the spec already existed (RAW-013), so phase B adds the test spec and the questions and leaves the requirement list unchanged. Result: 57 direct, 39 partial, 18 loose, 29 untested, 30 BE-only absent, 5 external. | agent (mapping); user (C-01 to C-13, L-01 to L-14, REQ-DED-01: open) | New tests in phase C use `TestREQ_<AREA>_<NN>_<Behaviour>`; do not rename upstream tests. After the user answers, update the spec, the test spec and this row. Details in [docs/portainer-testspec.md](docs/portainer-testspec.md) and [docs/portainer-test-strategy.md](docs/portainer-test-strategy.md) section 8. |

### Interventions

Work the user asked for that is not this stage's goal. Same ID series; does not count toward the exit.

| ID | Intervention | Reason | Decided by | Replay hint |
|----|--------------|--------|------------|-------------|
| COV-003 | Add a Nix dev shell with pinned references (`flake.nix`, `flake.lock`): Go 1.26.10, Node.js 22.22.1, pnpm 10.26.2, GNU make, git. Run tests with `nix develop -c make test`. | The user asked for it after the A0 runs used the host's Go 1.27.3 and Node 24 and the host had no `make`, so runs depend on the machine. | user | Keep `flake.lock` committed. Node comes from a second nixpkgs input pinned to `33b45ad1` because current nixpkgs has a newer 22.x; move it when `package.json` engines change. Details in the test strategy, section 4. |

### Last run

- 2026-11-09. A0 inventory recorded (COV-001) in [docs/portainer-test-strategy.md](docs/portainer-test-strategy.md). Go: 424 test files, run twice (second run shuffled): 7 and 6 top-level failures, caused by a shared global logger (flaky), ungated Docker tests and a DNS-dependent test. Vitest: 312 files, 2,299 tests, all passed in file order; 4 failed in a shuffled run. Recipes run directly because `make` is missing on the host, with Node 24 and Go 1.27. No tests added. Isolation findings F-01 to F-15 wait for user decisions.
- 2026-11-09. Isolation findings decided (COV-002): fixes and gates for F-01, F-02, F-03, F-08 to F-11, F-13, F-14 in tests and test config; F-05/F-06 labels left for A2; F-04, F-07, F-12, F-15 left. Pinned Nix shell added (COV-003). In `nix develop` (Go 1.26.10, Node 22.22.1): `make test-server` 3,493 tests with subtests, 69 skipped, 0 failed; `make test-client` 2,282 passed, 5 skipped, 12 todo, 0 failed, and the same with shuffle seed 20261109.
- 2026-11-09. A1 generated sources recorded (COV-004): the openapi-ts client `app/react/portainer/generated-api/**` (16 files) is excluded from Vitest coverage; no generated Go sources, swag output is YAML only. Probe in `nix develop` on two client test files: coverage report dropped from 112 to 99 files, 0 generated. No tests added. F-05/F-06 labels still due in A2.
- 2026-11-09. A2 slow tests labeled (COV-005): F-05 `performance` and F-06 `fuzz` by build tag, with `make test-performance` and `make test-fuzz`; benchmarks documented, no mutation tests. In `nix develop`: `make test-server` 3,454 tests with subtests, 69 skipped, 0 failed, neither labeled test run (`api/crypto` 0.6 s instead of about 22 s); `make test-fuzz FUZZTIME=5s` passed; the performance test passed alone in 13.5 s. Frontend unchanged. No tests added.
- 2026-11-09. B test spec written (COV-006): all 178 requirements mapped to existing tests in [docs/portainer-testspec.md](docs/portainer-testspec.md), by reading the tests (no run, no new or renamed tests, no production change): 96 with tests (57 direct, 39 partial), 18 loose, 29 untested, 30 BE-only absent, 5 external. 13 requirement and 14 resource-limit clarifications and REQ-DED-01 wait for the user.
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
