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

- Feature spec: [docs/portainer-spec.md](docs/portainer-spec.md) (178 requirements `REQ-<AREA>-NN` in 24 areas, written from the upstream docs in RAW-013, amended in COV-007 with 14 deduced requirements `REQ-DED-NN`); testspec: [docs/portainer-testspec.md](docs/portainer-testspec.md) (COV-006, COV-007)
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
| COV-007 | Phase B clarifications decided as proposed: C-01 stack webhooks, C-02 template variables, C-03 K8s scale/patch/rollback/pod restart, C-04 Edge async and C-07 built-in roles in access policies are CE requirements (pull prevention and webhook env vars, YAML editing and the role editor stay BE-only); C-05 SSRF default off, destinations as implemented; C-06 REQ-API-01 documentation only; C-08 external items "not tested in this repo"; C-09 pin today's `POST /auth` errors; C-10 no token revocation on user update; C-11 notification history stored as today, bell 50, unbounded; C-12 BE leftovers in CE are not CE requirements; C-13 accept REQ-DED-01, no maximum; L-01 to L-13 pinned as observed (REQ-DED-02 to REQ-DED-14), no new caps; L-14 implementation details. Applied to `docs/portainer-spec.md` and `docs/portainer-testspec.md`. | Skill phase B: the user decides requirement questions; spec and test spec follow. | user | Do not add caps for uploads or other limits without a new user decision. Keep the C-12 surfaces out of CE tests. Test names for new phase C tests use these IDs (`TestREQ_DED_01_…`). |
| COV-008 | Phase C steps 1 to 3: measure the reference test set once with `nix develop -c make test` and plan from that report. Baseline 48.8 % of statements (Go 40.8 %, client 68.5 % of loaded files), measured on the code of `394275708`; overshoot 92.2 %; plan = 127 packages by missed statements, largest first (test strategy section 9). No tests added. | Skill phase C needs one authoritative measurement and a package plan before tests are added. | agent | Re-run the same command for the step 8 measurement. The client number counts only files that tests load; whether to add `coverage.include` is open for the user. |
| COV-009 | Frontend coverage counts every `app/**` source: `coverage.include: ["app/**"]` in `vitest.config.mts` (generated-api exclude kept, COV-004). Package plan is vision-aware: Priority (local Docker containers/images/volumes/networks, local compose stacks, local docker endpoints, migrator, docker proxy, settings that stay, crypto, and similar kept surfaces, including volume UI now in the measurement) then Deferred (Kubernetes/Helm, Swarm, Edge, registries, backup/restore, user-management and login/auth-for-users). Remeasurement on `7476f68ef`: project 32.7 % (22,118 of 67,714; Go 40.8 %, client 25.2 %). Overshoot 95.5 % (needs 42,549 more covered). Priority alone cannot reach overshoot (max about 67.4 %); bar unchanged; Deferred tests not started in this slice. Details in test strategy section 9. | User decided both open points from COV-008 on 2026-11-09 (Europe/Berlin). | user | Keep `coverage.include`; do not invent further excludes. Work Priority largest-first (volume tie-break); leave Deferred in the denominator but after Priority. Do not lower the 85 % bar. |
| COV-010 | Phase C first package batch for Priority `api/http/handler/stacks`: added compose stop (`TestREQ_STK_05_*`), inspect (`TestREQ_STK_01_Inspect*`), associate (`TestREQ_STK_10_*`) and response-helper tests. Package coverage 33.0 % → 40.3 % (missed 1,159 → 1,034). Package not finished. | Skill phase C step 4–6: one whole package at a time; stacks is the largest Priority package. | agent | Continue `api/http/handler/stacks` until remaining missed methods are tested or recorded uncoverable; then take the next Priority package. |
| COV-011 | Phase C second batch for Priority `api/http/handler/stacks`: compose create (`TestREQ_STK_02_*`), migrate (`TestREQ_STK_07_*`), list HTTP (`TestREQ_STK_01_List*`), git update/redeploy guards (`TestREQ_STK_03_*`/`TestREQ_STK_04_*`). Package coverage 40.3 % → 52.0 % (697 → 900 of 1,731; missed 1,034 → 831). Package not finished. | Skill phase C: continue the current Priority package. | agent | Keep working `api/http/handler/stacks` until remaining methods are tested or recorded uncoverable; then next Priority package. |
| COV-012 | After Priority packages are exhausted (tests or honestly uncoverable), end the covered stage below the project-wide 85 % bar. Do not test Deferred packages to chase the 85 % / 95.5 % overshoot. No new percentage bar and no 85 %-of-Priority target unless a later decision sets one. Covered exit still needs user confirmation when Priority is done. | User decided on 2026-11-09 (Europe/Berlin): writing tests for code the tailored stage will remove is wasteful; Priority alone maxes at about 67.4 %. | user | Close the COV-009 open point in the test strategy. Work Priority only. Do not start Deferred. Do not open a skill PR for this. |
| COV-013 | Phase C third batch for Priority `api/http/handler/stacks`: compose git create/upload (`TestREQ_STK_02_*`/`TestREQ_STK_09_*`), git update/redeploy success and edge paths (`TestREQ_STK_03_*`/`TestREQ_STK_04_*`), compose HTTP update, handler authz helpers, start/create routing guards. Package coverage 52.0 % → 64.5 % (900 → 1,116 of 1,731; missed 831 → 615). Package not finished; remaining top gaps include swarm/k8s create (Deferred-leaning) and leftover compose update/delete/start paths. | Skill phase C: continue the current Priority package; prefer compose/local-Docker and git paths. | agent | Keep working `api/http/handler/stacks` until remaining methods are tested or recorded uncoverable; then next Priority package. |
| COV-014 | Phase C fourth batch for Priority `api/http/handler/stacks`: compose delete/start/stop/file/migrate/update/git edges, async `stackDeploy`, swarm migrate/update HTTP (preferred files). Package coverage 64.5 % → 68.1 % (1,116 → 1,179 of 1,732; missed 615 → 553; +63). Compose-focused; short of +200 aim because preferred leftovers are mostly hard error-injection paths. Largest remaining gaps are deferred-leaning `create_swarm_stack.go` (96), `create_kubernetes_stack.go` (68), `update_kubernetes_stack.go` (38). Package not finished. | Skill phase C: prefer compose/local-Docker over swarm/k8s create. | agent | Next slice: cover or honestly record create_swarm/create_kubernetes/update_kubernetes while finishing stacks; then next Priority package. |
| COV-015 | Move `securityStoreNonAdmin` from `api/http/handler/stacks/stack_test_helper.go` (non-`_test.go`, compiles into the production package) into `stack_security_test.go`. Restore `stack_test_helper.go` to the pre-COV-014 content (`8071babaa`). No behaviour change; package tests pass. | Phase C allows test files only; upstream already had mock helpers in a non-test file, and COV-014 added more. | agent | Never add helpers to a non-`_test.go` file even when upstream already has one. |
| COV-016 | Close Priority work on `api/http/handler/stacks`. Do not deepen tests for `create_swarm_stack.go`, `create_kubernetes_stack.go`, or `update_kubernetes_stack.go`: record them as **deferred-within-package** (testable, skipped by COV-012 vision-aware policy, not uncoverable). Remaining compose leftovers after COV-014 are mostly hard error-injection paths; stop grinding those. Package left at 68.1 % (1,179 of 1,732; 553 missed). Next Priority package: `api/http/handler/endpoints`. | COV-012: do not test Deferred-feature code the tailored stage will remove; apply the same skip inside a mixed package. | agent | Apply deferred-within-package for swarm/k8s (and similar) files inside Priority packages; move to the next Priority package. |
| COV-017 | Phase C first batch for Priority `api/http/handler/endpoints`: local-Docker inspect, settings update (HOST-04), snapshot, unique-name/hideFields, delete/batch, docker update rename/publicURL. Package coverage 38.5 % → 46.9 % (633 → 772 of 1,646; missed 1,013 → 874; +139). Prefer local Docker over kube/edge/agent-only; those remain deferred-within-package candidates. Package not finished. | Skill phase C: next Priority package after stacks closed (COV-016). | agent | Continue `api/http/handler/endpoints` prefer local-Docker; apply deferred-within-package for kube/edge-only files. |
| COV-018 | Phase C second batch for Priority `api/http/handler/endpoints`: filter helpers (group/name/status/search/tags), local-Docker create (unsecured + TLS skip-verify), storeTLSFiles, deeper update (group/gpus/TLS/access policies), dockerhub status (disabled check + guards). Package coverage 46.9 % → 60.7 % (772 → 999 of 1,646; missed 874 → 647; +227). Also recorded `createAzureEndpoint`/`createKubernetesEndpoint`, `endpoint_status_inspect.go`, `endpoint_update_relations.go` as deferred-within-package. Package not finished. | Skill phase C: continue current Priority package; prefer local-Docker. | agent | Continue `api/http/handler/endpoints`; next local gaps include filterEndpointsByQuery/list paths, remaining update branches, dockerhub token/limits (HTTP). |
| COV-019 | Phase C third batch for Priority `api/http/handler/endpoints`: list/filter (paginate, name/status/group/tags/search/ids), create Validate + tag save path + TLS file create, update TLS/URL/proxy/team policies, delete TLS/tags/relation/registry + deprecated batch. Package coverage 60.7 % → 64.6 % (999 → 1,063 of 1,646; missed 647 → 583; +64). Diminishing returns vs COV-017/018; remaining local-preferable gaps look thin/hard. Package not finished. | Skill phase C: continue current Priority package on local-Docker leftovers. | agent | Consider closing endpoints for Priority purposes next (like stacks) if another batch stays thin; do not hop to migrator until closed. |
| COV-020 | Close Priority work on `api/http/handler/endpoints`. Remaining local-preferable leftovers after COV-019 are thin/hard (agent-TLS/`createEndpoint` leftovers, remaining TLS/proxy edge branches, `deleteEndpoint` workflow/edge-job cleanup, k8s detection in inspect, `endpoint_create_global_key`). Deferred-within-package list unchanged (force_update, update_edge_relations, association_delete, registry_access, registries_list, createAzure, createKubernetes, status_inspect, update_relations; no live dockerhub token/limits; no edge filter helpers). Package left at 64.6 % (1,063 of 1,646; 583 missed). Next Priority package: `api/datastore/migrator`. | Same close pattern as COV-016 for stacks after diminishing returns. | agent | Apply deferred-within-package and thin-local close; move to migrator. |
| COV-021 | Phase C first batch for Priority `api/datastore/migrator`: local-Docker endpoint/stack/settings/user migrations (DB18 access policies, DB24 stacks/settings, DB25 endpoint security, DB27 stack resource controls, DB34 git entrypoint, DB50 password length, DB60 GPUs, DB90 GPU flags/theme, DB100 docker-desktop flag, DB110 templates URL, DB111 pending-actions cleanup) plus migrator core helpers (`NeedsMigration`, `Migrate` same-version, `runMigrations`). Package coverage 25.5 % → 42.6 % (298 → 497 of 1,168; missed 870 → 671; +199). Edge/kube/registry-only migrator files deferred-within-package. Package not finished. | Skill phase C: next Priority after endpoints closed (COV-020); migrations as backwards-compatibility. | agent | Continue migrator prefer local-Docker DB rewrites; skip edge/kube/registry-only files. |
| COV-022 | Phase C second batch for Priority `api/datastore/migrator`: volume resource-control rewrite (DB32 local slice; registry/kube/helm slices in that file deferred-within-package), tags/endpoint-tag conversion (DB23), resource-control/users/roles (DB22), settings/schedules/users (DB20), tunnel seed→key (DB100 non-edge), `migrate_2_43_sources` UAC helpers, NeedsMigration MigratorCount branches, plus smaller local leftovers (DB19 settings default, DB30 OAuth clear, DB36 token authz, DB130 pending-action marshal). Package coverage 42.6 % → 61.2 % (497 → 715 of 1,168; missed 671 → 453; +218). Package not finished. | Skill phase C: continue Priority migrator; local-Docker DB rewrites; migrations as backwards-compatibility. | agent | Continue migrator prefer local-Docker; skip edge/kube/registry-only (incl. DB31 registry/kube/helm slices, DB32 kubectl, DB100 edge-stack status, DB110 overcommit). |
| COV-023 | Phase C third batch for Priority `api/datastore/migrator`: `toRepoConfig`/`gitSourceKey`, `migrate_ce` version-gap/same-version count mismatch/invalid-version errors, NeedsMigration stale-count when latest≠API, `migrateDBVersionToDB50` wrapper, 2.43 ownership error paths, local 2.44 clear/invalid-duration/deleted-stack refs, local 2.45 EnvID orphan + prune empty workflow. Recorded `migrate_dbversion34` (dockerhub-only wrapper) and `migrate_dbversion140` (kube registry SA) as deferred-within-package. Package coverage 61.2 % → 63.5 % (715 → 742 of 1,168; missed 453 → 426; +27). Diminishing; local leftovers thin/hard. Package not finished. | Skill phase C: continue Priority migrator; 2.44/2.45 are local stack/source/workflow rewrites (not edge-only). | agent | Consider closing migrator for Priority purposes (like endpoints after thin dent). |
| COV-024 | Close Priority work on `api/datastore/migrator`. After COV-023 dent (+27) remaining local-preferable leftovers are thin/hard (error-injection in 2.43/2.44/2.45/migrate_ce, thin DB20/22/19/26/25/23/130 wrappers). Deferred-within-package unchanged plus DB34 dockerhub wrapper and DB140 kube registry SA. Package left at 63.5 % (742 of 1,168; 426 missed). Next Priority package: `app/portainer/services/api`. | Same close pattern as COV-016/COV-020 after diminishing returns. | agent | Apply deferred-within-package and thin-local close; move to frontend api services. |
| COV-025 | Phase C first batch for Priority `app/portainer/services/api`: local-Docker EndpointService (createLocal unix/npipe, remote tcp, update/TLS, snapshot/delete/access/security), StackService compose client (stack/file/composeStacks/unionStacks/remove/associate), SettingsService, TagService, GroupService, StatusService, SSLService, backup.service getBackupStatus. Package Vitest coverage 0 % → 28.3 % (0 → 195 of 690; missed 690 → 495; +195). Deferred-within-package: registryService, dockerhubService, user/team admin surfaces, Azure/Kubernetes create on EndpointService, updateKubeGit/swarm-heavy StackService paths. Package not finished. | Skill phase C: next Priority after migrator closed (COV-024); Vitest; prefer local-Docker API client. | agent | Continue `app/portainer/services/api` prefer local-Docker; skip registry/user-admin/kube/edge surfaces. |
| COV-026 | Move `app/portainer/services/api/angularFactoryTestUtils.js` (imported vitest helpers counted under `coverage.include: ['app/**']`) into `angularFactoryHelpers.test.js` so helpers live only in a Vitest test module. Imports updated; old file removed. Package coverage unchanged at 28.3 % (195 of 690). | COV-009 include counts non-`*.test.*` app files; do not add coverage.exclude. | agent | Keep shared Angular factory stubs in `*.test.js` only. |
| COV-027 | Phase C second batch for Priority `app/portainer/services/api`: ResourceControlService, AccessService, WebhookService, CustomTemplateService, deeper StackService compose create/lifecycle/git, GroupService membership helpers. Recorded `backup.service` / `backupService.js` as deferred-within-package (vision removes backup/restore; existing getBackupStatus test left). Package Vitest coverage 28.3 % → 50.4 % (195 → 348 of 690; missed 495 → 342; +153). Package not finished. | Skill phase C: continue current Priority; prefer local-Docker API clients. | agent | Continue `app/portainer/services/api`; skip registry/user-admin/backup/kube/swarm-heavy leftovers. |
| COV-028 | Phase C third batch for Priority `app/portainer/services/api`: TemplateService (app templates + Docker Hub/registry mapping, templateFile), SupportService, thin settings/tag/customTemplate error branches. Recorded remaining StackService swarm create/associate/kube paths as deferred-within-package (compose leftovers already covered). Package Vitest coverage 50.4 % → 55.4 % (348 → 382 of 690; missed 342 → 308; +34). Local leftovers thin. Package not finished. | Skill phase C: continue Priority api services; prefer local-Docker. | agent | Consider closing for Priority purposes next. |
| COV-029 | Close Priority work on `app/portainer/services/api`. After COV-028 (+34) remaining misses are dominated by deferred surfaces (registry/user/team/backup/dockerhub, StackService swarm/kube, EndpointService azure/k8s/registry). Thin local leftovers only (access override branches, group/index). Package left at 55.4 % (382 of 690; 308 missed). Next Priority package: `api/http/proxy/factory/docker`. | Same close pattern as COV-016/020/024 after diminishing returns. | agent | Apply deferred-within-package close; move to Docker proxy factory. |
| COV-030 | Phase C first batch for Priority `api/http/proxy/factory/docker`: volume list/inspect/create-response/ResourceID/body restrictions/proxy list+inspect/delete denial (VOL-01/02/03/05), stack-label RC id helper, container label selectors + blacklist filter + list operation (CTR-01). Prefer volume/network/container over kube/edge/swarm-only proxy paths (secrets/configs/registry/swarm/tasks remain deferred-within-package candidates). Package coverage 44.8 % → 54.6 % (499 → 608 of 1,114; missed 615 → 506; +109). Package not finished; local leftovers still meaty. | Skill phase C: next Priority after api services closed (COV-029); volume tie-break. | agent | Continue docker proxy prefer volume/network/container; defer secrets/configs/registry/swarm/tasks/edge. |
| COV-031 | Phase C second batch for Priority `api/http/proxy/factory/docker`: `findResourceControl` depth (direct/service/swarm/compose/portainer labels), inherited volume/network/container labels + `getInheritedResourceControlFromServiceOrStack` (local types only), container inspect/update device-mapping (HOST-04), `getDockerID` snapshot/remote/swarm-cluster, volume list non-admin filter + prune admin-only, container list blacklist via `rewriteOperationWithLabelFiltering`, system network RC, NewTransport/RoundTrip. Deferred-within-package unchanged (secrets/configs/registry/swarm/tasks/edge). Package coverage 54.6 % → 65.3 % (608 → 727 of 1,114; missed 506 → 387; +119). Package not finished; local leftovers still meaty. | Skill phase C: continue Priority docker proxy; prefer volume/network/container. | agent | Continue docker proxy prefer local volume/network/container; do not hop. |
| COV-032 | Phase C third batch for Priority `api/http/proxy/factory/docker`: container creation security leftovers (privileged/pid/devices/sysctl/security-opt/capabilities/VolumesFrom), volume create existence-check + decorate, `restrictedResourceOperation` for local container/network/volume-browse, `interceptAndRewriteRequest` + local `buildOperation` (empty/json/multipart; not registry-auth), generic creation/decorate, network list filter + system inspect, admin volume delete RC cleanup, referencedVolumeNames. Recorded `decorateRegistryAuthenticationHeader` / `replaceRegistryAuthenticationHeader` / `createRegistryAccessContext` / `proxyImageRequest` registry-auth slice as **deferred-within-package** (vision removes registries). Package coverage 65.3 % → 70.3 % (727 → 783 of 1,114; missed 387 → 331; +56). Preferred surfaces largely covered; remaining local leftovers look thinner/harder (mostly error-injection). Package not finished. | Skill phase C: continue Priority docker proxy. | agent | Next slice: if another batch stays thin, close like COV-016/020/024/029; do not hop yet. |
| COV-033 | Close Priority work on `api/http/proxy/factory/docker`. After COV-032 (+56) remaining local leftovers are thin/hard (error-injection on create/restricted/build/`createPrivateResourceControl`; container/volume leftover error branches). Deferred-within-package unchanged: secrets/configs/registry/swarm/tasks/edge/services-heavy plus registry-auth transport (`decorateRegistryAuthenticationHeader`, `replaceRegistryAuthenticationHeader`, `createRegistryAccessContext`, `proxyImageRequest` registry-auth). Package left at 70.3 % (783 of 1,114; 331 missed). Next Priority package: `api/filesystem`. | Same close pattern as COV-016/020/024/029 after diminishing returns. | agent | Apply deferred-within-package and thin-local close; move to filesystem. |
| COV-034 | Phase C first batch for Priority `api/filesystem`: stack compose store/update/rollback/backup + versioned paths (STK-02/03/04), TLS file lifecycle (SET-04), custom template store (TPL-03), Copy/Rename/WriteJSON/CreateFile, key-pair PEM store/load, SSL cert path/store, serialize LoadDir/PersistDir/FilterDir/Decode*, SafeMoveDirectory, path helpers. Deferred-within-package: Edge stack/job paths, registry-management store, Chisel key, MTLS cert helpers. Package coverage 23.1 % → 68.4 % (147 → 435 of 636; missed 489 → 201; +288). Package not finished. | Skill phase C: next Priority after docker proxy closed (COV-033); prefer local-Docker compose/TLS/template storage. | agent | Continue `api/filesystem` prefer local stack/TLS/template; skip edge/registry/chisel/MTLS. |
| COV-035 | Close Priority work on `api/filesystem`. After COV-034 (+288) preferred local surfaces (stack store/update/rollback, TLS, templates, serialize, SafeMoveDirectory, path helpers) are largely covered. Remaining 201 misses dominated by deferred-within-package (Edge stack/job, registry-management store, Chisel private key, mTLS cert helpers, CopySSLCertPair/CopySSLCACert) plus thin error branches on already-tested Copy/CopyDir, stack store/update/rollback, TLS delete, GetFileContent, WriteJSON/CreateFile, key-pair PEM, SafeMoveDirectory/restoreBackup, serialize, NewService/JoinPaths. Package left at 68.4 % (435 of 636; 201 missed). Next Priority package: `app/portainer/services` (parent folder; not `services/api`, closed at COV-029). | Same close pattern as COV-016/020/024/029/033 after diminishing returns. | agent | Apply deferred-within-package and thin-local close; move to frontend parent services. |

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
- 2026-11-09. B clarifications decided by the user (COV-007): C-01 to C-13 and L-01 to L-14 recorded in the test spec; spec amended (CE scope for STK-09, TPL-04, K8S-04, K8S-09, EDGE-02, USR-05; SSRF default off; external items not tested in this repo; REQ-DED-01 to REQ-DED-14). No tests added.
- 2026-11-09. C baseline measured once (COV-008), `nix develop -c make test`, exit 0: Go 3,454 tests with subtests, 69 skipped, 0 failed; client 2,282 passed, 5 skipped, 12 todo, 0 failed. Coverage 48.8 % of statements project-wide (22,148 of 45,413; Go 40.8 %, client 68.5 % of loaded files). Overshoot 92.2 %; plan of 127 packages in the test strategy, section 9. No tests added.
- 2026-11-09. C remeasurement with `coverage.include: ['app/**']` and vision-aware Priority/Deferred plan (COV-009), on `7476f68ef`, `nix develop -c make test`, exit 0: Go 3,454 tests with subtests, 69 skipped, 0 failed; client 2,282 passed, 5 skipped, 12 todo, 0 failed. Coverage 32.7 % of statements project-wide (22,118 of 67,714; Go 40.8 %, client 25.2 % of all app sources). Overshoot 95.5 %; Priority alone max about 67.4 % (open point). Plan in the test strategy, section 9. No tests in the remeasurement commit.
- 2026-11-09. C first Priority package batch (COV-010) on `api/http/handler/stacks`: 16 new tests (stop/inspect/associate/response). Package-only `go test -cover` 40.3 % (697 of 1,731; was 33.0 % / 572). Missed statements 1,034 remaining. Mapped in the test spec.
- 2026-11-09. C second Priority batch (COV-011) on `api/http/handler/stacks`: 29 new tests (create/migrate/list/git guards). Package-local `go test -cover` 52.0 % (900 of 1,731; was 40.3 % / 697). Missed 831 remaining. Mapped in the test spec.
- 2026-11-09. User decision (COV-012): finish Priority packages then exit covered below 85 %; do not test Deferred to chase the project-wide overshoot. Open point from COV-009 closed in the test strategy.
- 2026-11-09. C third Priority batch (COV-013) on `api/http/handler/stacks`: 41 new tests (compose git create/upload, git update/redeploy success paths, compose update HTTP, handler authz, start/create guards). Package-local `go test -cover` 64.5 % (1,116 of 1,731; was 52.0 % / 900). Missed 615 remaining. Mapped in the test spec.
- 2026-11-09. C fourth Priority batch (COV-014) on `api/http/handler/stacks`: 49 new tests (compose delete/start/stop/file/migrate/update/git edges, async stackDeploy, swarm migrate/update HTTP). Package-local `go test -cover` 68.1 % (1,179 of 1,732; was 64.5 % / 1,116). Missed 553 remaining. Compose-focused dent +63; create_swarm/k8s still top leftovers. Mapped in the test spec.
- 2026-11-09. COV-015: moved `securityStoreNonAdmin` into `stack_security_test.go`; `stack_test_helper.go` identical to `8071babaa`. Package tests pass.
- 2026-11-09. COV-016: close Priority work on `api/http/handler/stacks`. Swarm/k8s create/update files recorded as deferred-within-package (not uncoverable). Next Priority package: `api/http/handler/endpoints`.
- 2026-11-09. C first Priority batch (COV-017) on `api/http/handler/endpoints`: 26 new tests (inspect/settings/snapshot/unique-name/delete-batch/docker-update). Package-local `go test -cover` 46.9 % (772 of 1,646; was 38.5 % / 633). Missed 874 remaining. Mapped in the test spec.
- 2026-11-09. C second Priority batch (COV-018) on `api/http/handler/endpoints`: 31 new tests (filter/create/update/dockerhub). Package-local `go test -cover` 60.7 % (999 of 1,646; was 46.9 % / 772). Missed 647 remaining. Mapped in the test spec.
- 2026-11-09. C third Priority batch (COV-019) on `api/http/handler/endpoints`: 28 new tests (list/filter, create validate/tags/TLS files, update TLS/URL, delete extras). Package-local `go test -cover` 64.6 % (1,063 of 1,646; was 60.7 % / 999). Missed 583 remaining (+64). Mapped in the test spec.
- 2026-11-09. COV-020: close Priority work on `api/http/handler/endpoints`. Thin/hard local leftovers; deferred-within-package unchanged. Next Priority package: `api/datastore/migrator`.
- 2026-11-09. C first Priority batch (COV-021) on `api/datastore/migrator`: 19 new tests (local Docker endpoint/stack/settings/user migrations + migrator core). Package-local `go test -cover` 42.6 % (497 of 1,168; was 25.5 % / 298). Missed 671 remaining (+199). Mapped in the test spec.
- 2026-11-09. C second Priority batch (COV-022) on `api/datastore/migrator`: 17 new tests (volume RC DB32, tags/endpoints DB23, RC/users/roles DB22, settings/schedules DB20, seed→key DB100, 2.43 UAC helpers, NeedsMigration count branches, DB19/30/36/130 leftovers). Package-local `go test -cover` 61.2 % (715 of 1,168; was 42.6 % / 497). Missed 453 remaining (+218). Mapped in the test spec.
- 2026-11-09. C third Priority batch (COV-023) on `api/datastore/migrator`: 13 new tests (2.43 helpers, migrate_ce branches, DB50 wrapper, 2.44/2.45 local leftovers). Package-local `go test -cover` 63.5 % (742 of 1,168; was 61.2 % / 715). Missed 426 remaining (+27). Mapped in the test spec.
- 2026-11-09. COV-024: close Priority work on `api/datastore/migrator`. Thin/hard local leftovers after COV-023 (+27); deferred-within-package unchanged (+ DB34/DB140). Next Priority package: `app/portainer/services/api`.
- 2026-11-09. C first Priority batch (COV-025) on `app/portainer/services/api`: 30 new tests across Endpoint/Stack/Settings/Tag/Group/Status/SSL/backup services. Package-local Vitest coverage 28.3 % (195 of 690; was 0 % / 0). Missed 495 remaining (+195). Mapped in the test spec.
- 2026-11-09. COV-026: moved Angular factory test utils into `angularFactoryHelpers.test.js`; removed `angularFactoryTestUtils.js` from app source. Coverage unchanged 28.3 % (195 of 690).
- 2026-11-09. C second Priority batch (COV-027) on `app/portainer/services/api`: 33 new tests (ResourceControl/Access/Webhook/CustomTemplate + Stack compose lifecycle + Group helpers). Package-local Vitest coverage 50.4 % (348 of 690; was 28.3 % / 195). Missed 342 remaining (+153). Mapped in the test spec.
- 2026-11-09. C third Priority batch (COV-028) on `app/portainer/services/api`: TemplateService + SupportService + thin error branches. Package-local Vitest coverage 55.4 % (382 of 690; was 50.4 % / 348). Missed 308 remaining (+34). Mapped in the test spec.
- 2026-11-09. COV-029: close Priority work on `app/portainer/services/api`. Deferred surfaces dominate remaining misses; thin local leftovers. Next Priority package: `api/http/proxy/factory/docker`.
- 2026-11-09. C first Priority batch (COV-030) on `api/http/proxy/factory/docker`: volume list/inspect/create-response/proxy + container blacklist filters + stack-label helper. Package-local `go test -cover` 54.6 % (608 of 1,114; was 44.8 % / 499). Missed 506 remaining (+109). Mapped in the test spec. Local leftovers still meaty — do not hop.
- 2026-11-09. C second Priority batch (COV-031) on `api/http/proxy/factory/docker`: findResourceControl depth, inherited vol/net/ctr labels, container inspect/update, getDockerID, volume filter/prune, container list label filtering. Package-local `go test -cover` 65.3 % (727 of 1,114; was 54.6 % / 608). Missed 387 remaining (+119). Mapped in the test spec. Local leftovers still meaty — do not hop.
- 2026-11-09. C third Priority batch (COV-032) on `api/http/proxy/factory/docker`: creation security leftovers, volume existence-check, restrictedResourceOperation, local build intercept, network filter/inspect. Package-local `go test -cover` 70.3 % (783 of 1,114; was 65.3 % / 727). Missed 331 remaining (+56). Registry-auth transport deferred-within-package. Remaining local leftovers look thinner/harder — do not hop; next may close.
- 2026-11-09. COV-033: close Priority work on `api/http/proxy/factory/docker`. Thin/hard local leftovers; deferred-within-package unchanged (+ registry-auth). Next Priority package: `api/filesystem`.
- 2026-11-09. C first Priority batch (COV-034) on `api/filesystem`: stack/TLS/template/serialize/local path helpers. Package-local `go test -cover` 68.4 % (435 of 636; was 23.1 % / 147). Missed 201 remaining (+288). Mapped in the test spec.
- 2026-11-09. COV-035: close Priority work on `api/filesystem`. Thin/hard local leftovers; deferred-within-package (Edge/registry/chisel/mTLS/CopySSL*). Next Priority package: `app/portainer/services` (exclude `api/`).
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
