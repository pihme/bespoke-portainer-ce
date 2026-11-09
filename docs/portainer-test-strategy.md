# Portainer test strategy

Test strategy for `bespoke-portainer-ce`. Stage `2-covered` keeps this file current. It holds the phase A0 inventory of the test suite (COV-001), the user's decisions on the isolation findings and the fixes made for them (COV-002), the pinned Nix environment the suites run in (COV-003), the generated sources left out of coverage (A1, COV-004), the labeled fuzz and performance tests left out of the reference test set (A2, COV-005), a pointer to the test spec (B, COV-006 and COV-007, section 8), and the phase C coverage baseline and plan (COV-008 remeasured under COV-009, section 9). Mutation and fuzz testing (D) come later.

Inventory taken on 2026-11-09 at `2-covered@a931b322a`; nothing was changed for it. Sections 1 and 2 describe the suite as inventoried; where COV-002 changed something since, the line says so. Section 3 lists the decisions.

## 1. Test structure

### Commands

| Target | Recipe | Notes |
|--------|--------|-------|
| `make test` | `test-server` then `test-client` | Runs both suites. |
| `make test-server` | `go run gotest.tools/gotestsum@v1.13.0 --format pkgname-and-test-fails --format-hide-empty-pkg --hide-summary skipped -- -cover -covermode=atomic -coverprofile=coverage.out ./...` | `TEST_PACKAGES` (default `./...`) narrows the packages. Writes `coverage.out` to the repo root (ignored by git since COV-002, F-14). No `-race`, no `-shuffle`, no `-short`. |
| `make test-client` | `pnpm run test $(ARGS) --coverage` (`vitest run`) | Coverage provider v8, reporters text/json/html into `./coverage/` (ignored by git since COV-002, F-14). |
| `pnpm run typecheck`, `make lint` | `tsc --noEmit`, eslint, golangci-lint | Static checks, not tests. `make lint-server` reads `.golangci-version`, which does not exist in this tree. |
| `pnpm run storybook` | Storybook dev server | 85 `*.stories.*` files. No test runner is attached to them. |

There is no CI at this pin (no `.github/workflows`), so no command is enforced anywhere. There is no end-to-end suite (no Playwright, Cypress or similar), and no build tag or task for integration, fuzz, mutation or performance tests. Since COV-005 the build tags `fuzz` and `performance` and the targets `make test-fuzz` and `make test-performance` exist; see section 7.

### Backend (Go)

- Framework: standard `testing` with `testify` (`assert`/`require`), run by `gotestsum`. HTTP handlers are tested with `net/http/httptest` (157 files). Many tests run against a real temporary BoltDB store from `datastore.MustNewTestStore` (138 files).
- Location: `*_test.go` next to the code. 424 test files in 138 directories; the biggest areas are `api/http` (176 files), `api/kubernetes` (31), `pkg/libhelm` (20), `api/dataservices` (14) and `api/datastore` (13). Fixtures sit in `testdata/` under `api/git`, `api/filesystem` and `api/archive`.
- Counted statically: 1,641 `func Test…`, 24 `func Benchmark…` (not run without `-bench`), 1 `func Fuzz…` (`FuzzParseForwardedHeaderProto` in `api/http/middlewares/proxy_headers_test.go`; its seed corpus ran as an ordinary test at inventory; labeled `fuzz` since COV-005), no `Example…`, no `TestMain`. 375 of the 424 files call `t.Parallel()`.
- Tags and gates: one build tag (`//go:build unix`). Integration tests are gated at runtime, not by tag: `pkg/testhelpers.IntegrationTest(t)` (env `INTEGRATION_TEST` or flag `-integration`) and `pkg/libhelm/test.EnsureIntegrationTest(t)` (env `INTEGRATION_TEST`), plus direct `os.LookupEnv("INTEGRATION_TEST")` checks. They are used in 11 files (`api/exec`, `api/git` Azure/GitHub, `pkg/libhelm/sdk`, `pkg/libhelm`, `pkg/libstack/compose`, `pkg/libstack/swarm`). One test checks `testing.Short()` (`api/dataservices/stack/tests/stack_test.go`).
- What the tests need:
  - File system: almost all, through `t.TempDir()` (64 files) and the BoltDB test store. Some build fixed `/tmp/...` paths as strings only. `api/archive` and `api/http/handler/backup` shell out to `tar`.
  - Docker daemon: `pkg/libstack/compose/composeplugin_test.go` (not gated at inventory; gated since COV-002, see F-02), plus the gated integration tests in `api/exec`, `pkg/libstack/compose` and `pkg/libstack/swarm`.
  - Network: the gated `api/git` GitHub and Azure tests (real remote repositories, including a private one); `pkg/networking` DNS probe (not gated at inventory; gated since COV-002, F-03); `pkg/libhelm/sdk` tests that appear to wait for unreachable hosts (F-04). Other files mention external URLs only as fixture strings or against `httptest` servers.
  - Clock: `time.Sleep` in 12 files (for example `api/jwt` 2 s, `api/adminmonitor` 2 s, `api/http/offlinegate` 1 s, `api/http/security` 1 s, `api/chisel`, `api/concurrent`, `api/gitops/scheduling`); `time.Now()` in 27 files. No fake clock is used.
  - Display: none.
  - Environment variables: `t.Setenv` in 15 files; `os.Unsetenv` without restore in 2 at inventory (F-08, fixed in COV-002).

### Frontend (TypeScript/React and AngularJS)

- Framework: Vitest 4 (`vitest.config.mts`) with `environment: 'jsdom'`, `globals: true`, React Testing Library (`testIdAttribute: 'data-cy'`), `@testing-library/user-event`, `jest-dom`, and MSW 2 as the network layer (`onUnhandledRequest: 'error'`, `server.resetHandlers()` after each test). `vitest-fail-on-console` fails a test on any console log/info/warn/error (except the unmounted-state-update message). `toastr` and `axios-progress-bar` are stubbed; CodeMirror and `Range`/`getSelection` are mocked. `bail: 2` stopped a run after two failures; since COV-002 (F-13) it is `bail: 0`, so a run reports every failure.
- Setup files: `app/setup-tests/` (`setup-websocket.ts`, `setup-rtl.ts`, `setup-msw.ts`, `stub-modules.ts`, `setup.ts`, `setup-codemirror.ts`, `setup-fail-on-console.ts`), global MSW handlers in `server-handlers.ts` and `setup-handlers/*.ts`. Helpers in `app/react/test-utils/` and `app/react-tools/test-mocks`. The coverage exclude lists `app/setup-tests/global-setup.js`, which does not exist.
- Location: `app/**/*.test.{ts,tsx,js}` next to the code. 312 files (237 `.tsx`, 74 `.ts`, 1 `.js`): `app/react/portainer` 82, `app/react/docker` 66, `app/react/kubernetes` 63, `app/react/components` 63, `app/react/edge` 9, the rest small. Two snapshot files (`__snapshots__`).
- Counted by the run: 2,299 tests in 869 suites (2,282 passed, 5 skipped, 12 todo). Statically: 15 `skip`/`todo` markers in 10 files, no `.only`.
- What the tests need: no display (jsdom), no real network (MSW rejects unhandled requests), no real file system. Clock: `vi.useFakeTimers` in 5 files; `Date.now()`/`new Date()` in 3 files; `localizeDate` is mocked to en-US/UTC. `localStorage` is used in 8 files. Each test file runs in its own isolated module context (Vitest default), so state leaks stay inside one file.

## 2. Runs on 2026-11-09

Host: the agent box, 8 CPUs, 15 GB RAM, Go 1.27.3 (tree: `go 1.26.10`), Node v24.22.1 (tree: `^22.22.1`), pnpm 10.26.2. No access to the Docker socket. `make` is not installed on the box and could not be installed, so the recipes above were run directly with the same flags; only the Go `-coverprofile` path and the JSON output files were redirected outside the repo. `pnpm install --frozen-lockfile` was refused (`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`: `pnpmfileChecksum` differs; the lockfile also still lists husky and lint-staged after RAW-014). The install ran with `--no-frozen-lockfile`, and the rewritten `pnpm-lock.yaml` was reverted, not committed.

| Run | Command | Result |
|-----|---------|--------|
| Go 1 | `make test-server` recipe | 2 min 30 s (first build). Top-level tests: 1,595 passed, 38 skipped, 7 failed; with subtests 3,424 passed, 63 skipped, 10 failed. Failing: `api/http/middlewares` (F-01), `pkg/networking` (F-03), `pkg/libstack/compose` (F-02). |
| Go 2 | same, with `GOFLAGS="-shuffle=on -count=1"` | 58 s. Top-level: 1,596 passed, 38 skipped, 6 failed. `TestWithPanicLoggerRePanicsErrAbortHandler` passed this time; the F-02 and F-03 failures repeated. The per-package shuffle seeds are in the test output. |
| Client 1 | `make test-client` recipe | 77 s. 311 files passed, 1 skipped; 2,282 tests passed, 5 skipped, 12 todo, 0 failed. |
| Client 2 | same, `--sequence.shuffle --sequence.seed=20261109` | Stopped by `bail: 2` after 1 failure (`LicenseNodePanel.test.tsx`), 832 of 2,299 tests run. |
| Client 3 | same as client 2, plus `--bail=0` | 4 failed, 2,278 passed: `LicenseNodePanel.test.tsx` (1), `RemoveAccessButton.test.tsx` (2), `Datatable.test.tsx` (1). See F-09 to F-11. |

The 38 skipped Go tests are the gated integration tests (`api/git` GitHub/Azure, `pkg/libhelm/sdk`, `pkg/libhelm`, `pkg/libkubectl`, `pkg/libstack/compose`, `pkg/libstack/swarm`, `api/exec`). The Go suite was not run with `-race`. The coverage numbers printed by both suites are not the authoritative measurement; that is defined in phase A and measured in phase C.

Slowest Go tests in run 1: `api/crypto` `Test_encryptAndDecrypt_withTheSamePassword` 22.5 s, `pkg/libhelm/sdk` `TestLoginToOCIRegistry` 14.1 s and `Test_InitActionConfig` 10.2 s, two `pkg/libkubectl` eviction tests 6 s each. Every other test took 2 s or less.

## 3. Isolation findings

The user decided every finding on 2026-11-09 (move, label, fix, or leave); the package is COV-002 in `BESPOKE.md`. The fixes touch tests and test config only. F-04, F-07, F-12 and F-15 have no code change. The labels for F-05 and F-06 were applied in A2 (COV-005, section 7).

| ID | Finding | Evidence | Decision (COV-002) | Status |
|----|---------|----------|--------------------|--------|
| F-01 | Shared global logger in parallel tests. `api/http/middlewares/panic_logger_test.go` (two `t.Parallel()` tests) and `api/http/logger_test.go` assign the global `log.Logger` to a test buffer without restoring it, while other parallel tests in the package write to the same global logger. | `TestWithPanicLoggerRePanicsErrAbortHandler` failed in Go run 1 (its buffer held deprecation and HTTP-error lines from other tests) and passed in run 2. Flaky. | fix | done: the logger tests run serially and restore `log.Logger` in `t.Cleanup` (`api/http/middlewares/panic_logger_test.go`, `api/http/logger_test.go`) |
| F-02 | Docker daemon tests in the ordinary run without a gate. `pkg/libstack/compose/composeplugin_test.go`: `Test_UpAndDown`, `Test_UpAndDownWithInjection`, `TestRun`, `Test_DeployWithRemoveOrphans`, `Test_DeployWithIgnoreOrphans`. They need `/var/run/docker.sock`, pull `alpine:latest` from Docker Hub, and create real containers. | Failed in both runs here (`permission denied` on the Docker socket). | move | done: the five tests call `testhelpers.IntegrationTest(t)`, like `compose_test.go`; they skip without `INTEGRATION_TEST` or `-integration` |
| F-03 | Real DNS in the ordinary run. `pkg/networking/diagnostics_test.go` `TestProbeDNSConnection/Invalid_domain` expects `nonexistent.domain.invalid` not to resolve. | Failed in both runs here: the host resolver answers every name. The result depends on the network. | move | done: `TestProbeDNSConnection` calls `testhelpers.IntegrationTest(t)`. The gate covers the whole test, because its "Valid domain" case resolves a real host name too |
| F-04 | Suspected outbound network and timeouts in the ordinary run: `pkg/libhelm/sdk` `TestLoginToOCIRegistry` (14 s) and `Test_InitActionConfig` (10 s, uses `https://kubernetes.default.svc`). Inferred from duration and host names, not traced. | Passed both runs, but they account for most of the package's 24 s. | leave | left as is; recorded only |
| F-05 | Large-data test in the ordinary run: `api/crypto` `Test_encryptAndDecrypt_withTheSamePassword` encrypts about 100 MB (22 s). Performance-like. | Slowest Go test. | label `performance` | done in A2 (COV-005): moved unchanged to `api/crypto/aes_performance_test.go` with `//go:build performance`; runs only from `make test-performance` |
| F-06 | Generated and random inputs in the ordinary run: the seed corpus of `FuzzParseForwardedHeaderProto` runs as a normal test (cheap); `api/database/boltdb` `Test_MarshalObjectUnencrypted` uses `uuid.New()` in subtest names and `api/datastore` `TestBackup` puts the temp path in subtest names, so names differ between runs. | Seen when comparing run 1 and run 2 by test name. | label `fuzz` | done in A2 (COV-005): `FuzzParseForwardedHeaderProto` moved unchanged to `api/http/middlewares/proxy_headers_fuzz_test.go` with `//go:build fuzz`; runs only from `make test-fuzz`. The UUID and temp-path subtest names stay in the reference set (not fuzz tests) |
| F-07 | Files left behind: each Go run leaves three empty `/tmp/azure-git-repo-*.zip` files from the `api/git` Azure tests. The temp file is created in production code (`api/git/azure.go`, `os.CreateTemp` without removal on the error path). | 6 files after two runs. | leave | left as is; a fix would change production code |
| F-08 | Process environment and package state changed without restore: `api/internal/upgrade/upgrade_docker_test.go` calls `os.Unsetenv(updaterImageEnvVar)`; `pkg/featureflags/featureflags_test.go` calls `os.Unsetenv("PORTAINER_FEATURE_FLAGS")` and `Parse` fills the package-level `featureFlags` map. | Not seen failing. | fix | done: `upgrade_docker_test.go` sets the variable with `t.Setenv` before unsetting it, so it is restored; `featureflags_test.go` drops the unrestored `os.Unsetenv` and restores the package-level `featureFlags` map in `t.Cleanup` |
| F-09 | Order dependence inside a frontend file: `app/react/portainer/HomeView/LicenseNodePanel.test.tsx`. The "more nodes than allowed" test fails when the "less nodes" test runs first. | Reproduced alone with seeds 20261109 and 3; passes in file order and with seeds 1 and 2. | fix | done: cause was the module-level license info cache in `license.service.ts` (30 s); the test calls its exported `resetState()` before each test |
| F-10 | DOM left behind between tests: `app/react/portainer/access-control/AccessManagement/AccessDatatable/RemoveAccessButton.test.tsx` (two "disabled state" tests). Under shuffle a confirm dialog from an earlier test is still in the document ("Found multiple elements with the role button and name /remove/i"). | Client run 3. | fix | done: cause was the confirm dialog from the click test, mounted by `openModal` outside the RTL container, so `cleanup()` did not remove it; the click test now closes it with Cancel and waits until it is gone |
| F-11 | `app/react/components/datatables/Datatable.test.tsx` "renders the table with correct data" fails under shuffle ("Unable to find … Jane Smith"). Cause not analysed; suspected state from another test in the same file. | Client run 3. | fix | done: cause was the search text typed by the "indeterminate state" test, which `useSearchBarState` persists in `sessionStorage` under the shared `test-table` key; the `Datatable` tests clear `sessionStorage` before each test |
| F-12 | Shared mutable mock state: the global MSW handler `POST /api/tags` in `app/setup-tests/server-handlers.ts` pushes into a module-level `tags` array that `server.resetHandlers()` does not reset. Tests also set `window.ddExtension` (`SettingsSidebar.test.tsx`) and redefine `window.location` (`KubectlShellView.test.tsx`). Per-file isolation limits all of these to one file. | Not seen failing. | leave | left as is; not seen failing |
| F-13 | Shuffle and stop settings: `vitest.config.mts` has `bail: 2`, which ends a run after two failures and hid three of the four order-dependent failures in client run 2. Neither suite runs in a random order by default (Go has no `-shuffle`, Vitest has no `sequence.shuffle`). | Client run 2 against run 3. | fix | done: `bail: 0` in `vitest.config.mts`; shuffle stays off by default |
| F-14 | Artifacts left in the repo: `make test-server` writes `coverage.out` and `make test-client` writes `coverage/` in the repo root; neither is in `.gitignore`. | `git check-ignore` matches neither. | fix | done: `/coverage.out` and `/coverage` added to `.gitignore` |
| F-15 | Unhandled error noise in a passing run: client run 1 prints `Error: Uncaught [Error: Invalid query param value for tab]` from jsdom, and the run still passes because `vitest-fail-on-console` does not see jsdom-reported errors. The emitting test was not identified. | Client run 1 log. | leave | left as is; the emitting test is still unknown |

Environment notes. These are not isolation findings:

- The tree pins Node `^22.22.1` and Go `1.26.10`; the A0 runs used Node 24.22.1 and Go 1.27.3. Since COV-003 the pinned Nix shell (section 4) provides the tree's versions.
- `pnpm-lock.yaml` cannot be installed frozen here. Still open; COV-002 and COV-003 did not touch the lockfile.
- `.golangci-version` is missing, so `make lint-server` cannot check the linter version. Still open.

## 4. Pinned environment (COV-003)

`flake.nix` and `flake.lock` in the repo root define a Nix dev shell, so test and build tooling no longer depends on what the host has installed. Enter it with `nix develop`, or run one command in it, for example `nix develop -c make test`. Nix with flakes enabled is the only host requirement.

| Tool | Version in the shell | Pin in the tree | Source |
|------|----------------------|-----------------|--------|
| Go | 1.26.10 | `go 1.26.10` (`go.mod`) | `go_1_26` from nixpkgs `f4a03c008967841f2a0b3cb7c436fc6fc31671f6` (nixos-unstable, 2026-11-07). The shell sets `GOTOOLCHAIN=local`, so Go never downloads another toolchain. |
| Node.js | 22.22.1 | `^22.22.1` (`package.json` engines) | `nodejs_22` from a second input, nixpkgs `33b45ad1d45f5556220ed307d6f4c202ccffea1a` (2026-03-19), because current nixpkgs has 22.23.4. Served from cache.nixos.org for x86_64-linux. |
| pnpm | 10.26.2 | `pnpm@10.26.2` (`packageManager`) | `pnpm_10` from the first input, overridden to the 10.26.2 npm tarball (current nixpkgs has 10.34.7), running on the Node 22.22.1 above. |
| GNU make | 4.4.1 | none | first input |
| git | 2.56.0 | none | first input |

`flake.lock` pins both inputs by revision and `narHash`; it was generated on the agent box with Nix 2.35.4 (`nix flake lock`). `nix flake update` moves the first input; the second input is pinned to a revision in `flake.nix` and stays put until the Node pin changes. The shell is declared for x86_64-linux, aarch64-linux and aarch64-darwin, but was only built and run on x86_64-linux. `gotestsum` is still fetched by `go run gotest.tools/gotestsum@v1.13.0` from the Makefile, pinned by its version.

## 5. Runs after COV-002, 2026-11-09

All runs inside `nix develop` (Go 1.26.10, Node 22.22.1, pnpm 10.26.2, GNU make 4.4.1) at `2-covered@61d395793`, the commit with the Nix shell on top of the COV-002 fixes. No Docker socket, no `INTEGRATION_TEST`. `node_modules` was the one from the A0 install (no new `pnpm install`). Coverage output was moved out of the repo.

| Run | Command | Result |
|-----|---------|--------|
| Go focused | `go test -count=1 -v` on `api/http/middlewares`, `api/http`, `pkg/libstack/compose`, `pkg/networking`, `pkg/featureflags`, `api/internal/upgrade` | All 6 packages ok. The five F-02 tests and `TestProbeDNSConnection` (F-03) skip. |
| Go focused, shuffled | same, `-shuffle=on` | Same result. Before Nix, on the host Go 1.27.3, the four non-Docker packages also passed 30 times in a row with `-count=30 -shuffle=on`. |
| Go full | `make test-server` | 90.6 s, 3,493 tests with subtests, 69 skipped, 0 failed (A0 run 1: 10 failed, 63 skipped). |
| Client, three files | `vitest run` on `LicenseNodePanel`, `RemoveAccessButton`, `Datatable` tests, `--sequence.shuffle`, seeds 20261109, 3, 1, 2 | 27 of 27 passed for every seed. Without the fixes the same command failed 4 tests with seed 20261109 and 5 with seed 3. |
| Client full | `make test-client` | 311 files passed, 1 skipped; 2,282 tests passed, 5 skipped, 12 todo, 0 failed. |
| Client full, shuffled | `vitest run --sequence.shuffle --sequence.seed=20261109` (bail now 0) | Same counts, 0 failed (A0 run 3: 4 failed). |

The first attempt of the Go runs in the Nix shell failed to build with `no space left on device` (the shared box disk was full); after `go clean -cache` they ran as above.

## 6. Generated sources (A1, COV-004)

Searched on 2026-11-09 at `2-covered@643ef1ba6` for generator markers (`Code generated ... DO NOT EDIT`, `@generated`, `auto-generated`), `go:generate` directives, generator configs and the Makefile/`package.json` generate targets.

| Source | Generator | Language | Instrumented by | Excluded |
|--------|-----------|----------|-----------------|----------|
| `app/react/portainer/generated-api/portainer/**` (16 files: `client.gen.ts`, `sdk.gen.ts`, `types.gen.ts`, `zod.gen.ts`, `client/*`, `core/*`) | `@hey-api/openapi-ts` 0.99.0 from `api/docs/openapi.yaml`, config `openapi-ts.config.ts`, run by `make generate-api` / `pnpm generate-api` | TypeScript | Vitest v8 coverage (`make test-client`) | Yes, `coverage.exclude` in `vitest.config.mts` |
| `api/docs/swagger.yaml`, `api/docs/openapi.yaml` | `swag` v1.16.6 (`-ot yaml`, no `docs.go`) and `swagger2openapi`, `make docs-build` | YAML | nothing | Not needed: no code, not instrumented |
| `tsconfig.generated.json` | none (hand-written tsconfig that type-checks the generated client) | config | nothing | Not needed |

Not generated, and therefore left in the measurement: the Go test doubles `api/exec/exectest/kubernetes_mocks.go` and `pkg/libhelm/test/mock.go` are hand-written (no generator marker, no mockgen/mockery/counterfeiter); the frontend `__mocks__/`, `app/__mocks__/` and `*.mocks.ts` files are hand-written test helpers. The tracked Go code has no `Code generated` file and no `go:generate` directive.

### Exclude applied

`vitest.config.mts`:

```ts
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'app/setup-tests/global-setup.js',
        // Generated by @hey-api/openapi-ts (openapi-ts.config.ts, `make generate-api`); not hand-written, not a test target (COV-004).
        'app/react/portainer/generated-api/**',
      ],
    },
```

Vitest 4.1.8 without `coverage.include` reports only files the tests load; the generated client is loaded through `app/react/portainer/gitops/sources/**` (`payload.ts`, `useUpdateSourceMutation.ts`, `useTestSourceConnectionMutation.ts`).

### Limits

- Go: `go test -cover` / `-coverprofile` has no per-file exclude; it instruments whole packages selected by `TEST_PACKAGES` (default `./...`). No generated Go source exists today, so nothing is lost. If one appears, the options are dropping its package from the measured package list or filtering `coverage.out` afterwards; neither is set up.
- No generated sources are left inside any instrumentation. Phase C adds no tests for the sources in the table above.

### Verification

Inside `nix develop` (Node 22.22.1), `pnpm exec vitest run` on `ItemView/SettingsTab/EditForm/payload.test.ts` and `CreateView/steps/ConnectionTest.test.tsx` under `app/react/portainer/gitops/sources/`, with `--coverage --coverage.reporter=json-summary`, report written to `/workspace/a0-runs/a1/` outside the repo. 9 of 9 tests passed in both runs.

| Config | Files in coverage report | Of those under `generated-api/` |
|--------|--------------------------|---------------------------------|
| before (`643ef1ba6`) | 112 | 13 |
| after (exclude added) | 99 | 0 |

The full suites were not re-run for A1: only the coverage exclude list changed, no test or test setup.

## 7. Slow tests and the reference test set (A2, COV-005)

Searched on 2026-11-09 at `2-covered@a2f0e7811` for fuzz and property, mutation, and performance tests: `func Fuzz…` and `func Benchmark…` in `*_test.go`, `testing/quick`, rapid, gopter and other property libraries in `go.mod` and the Go sources, Go mutation tools (go-mutesting, gremlins, ooze), `testing.Short()` gates, large inputs (`1024*1024`), and on the frontend `fast-check`, Stryker, `*.bench.*` files and `bench` in `package.json` and `vitest.config.mts`. jqwik is a Java library and does not occur.

### Found

| Kind | Test | Where | Before A2 | Label |
|------|------|-------|-----------|-------|
| fuzz | `FuzzParseForwardedHeaderProto` (27 seed inputs from the `tests` table) | `api/http/middlewares` | seed corpus ran in every `go test`, so in `make test-server` and its coverage (F-06) | build tag `fuzz` |
| performance | `Test_encryptAndDecrypt_withTheSamePassword` (9 subtests, about 100 MB each, 13 to 22 s) | `api/crypto` | ran in `make test-server` and its coverage (F-05) | build tag `performance` |
| performance | 24 Go benchmarks (`func Benchmark…`) in `api/database/boltdb` (4), `api/http/handler/endpointedge` (4), `api/http/handler/endpoints` (2), `api/http/utils/filters` (4), `api/internal/edge` (4), `api/slicesx` (2), `pkg/libkubectl` (4, need a kubeconfig and skip without one) | see left | never ran: `go test` runs benchmarks only with `-bench` | Go's `Benchmark` prefix (tool annotation); no tag added |
| mutation | none | | | `mutation` is reserved for phase D1; no target until a tool is chosen |

Frontend: no fuzz, property, mutation or performance test, no such dependency, no `bench` file; nothing labeled, `vitest.config.mts` unchanged by A2.

Not labeled: `api/dataservices/stack/tests` `TestService_StackByWebhookID` skips under `-short` ("~1s"); one second is not a performance test, and `-short` is not used anywhere. F-04 (`pkg/libhelm/sdk`, about 24 s) stays unlabeled (COV-002, leave). The F-06 subtests with UUID or temp-path names (`api/database/boltdb` `Test_MarshalObjectUnencrypted`, `api/datastore` `TestBackup`) are ordinary tests and stay in the reference set. F-02 and F-03 are integration tests behind `testhelpers.IntegrationTest` (COV-002), not A2 labels.

### Labels and patterns

| Label | Mechanism | Pattern | Seen by |
|-------|-----------|---------|---------|
| `fuzz` | Go build tag: the file starts with `//go:build fuzz` | `*_fuzz_test.go`, today `api/http/middlewares/proxy_headers_fuzz_test.go` | the Go compiler: without `-tags fuzz` the file is not compiled, so `go test`, `-cover` and `gotestsum` never see it |
| `performance` | Go build tag: the file starts with `//go:build performance` | `*_performance_test.go`, today `api/crypto/aes_performance_test.go` | same, with `-tags performance` |
| `performance` (benchmarks) | Go `func Benchmark…` | any `*_test.go` | `go test`: runs them only with `-bench` |
| `mutation` | none yet | | |

The tagged tests were moved unchanged into their own files; the other tests in `aes_test.go` and `proxy_headers_test.go` (`TestParseForwardedHeaderProto`, `TestIsHTTPSRequest`, the small-file and passphrase crypto tests) stay in the reference set. The `fuzz` file reuses the `tests` table from `proxy_headers_test.go` as its seed corpus; the `performance` file reuses `randBytes`, `encryptFunc`, `decryptFunc` and `legacyAesEncrypt` from `aes_test.go`. No exclude pattern is needed besides the tag, because the build tag is applied by the same toolchain that runs the tests and the coverage. A new fuzz or performance test goes into a `*_fuzz_test.go` or `*_performance_test.go` file with the tag; the targets below find it by its `//go:build` line.

### Reference test set and commands

The reference test set is every Go test compiled without build tags (minus the integration tests that skip without `INTEGRATION_TEST`) plus every Vitest test under `app/**/*.test.*`. It contains no fuzz, performance or benchmark test.

| Purpose | Command |
|---------|---------|
| Ordinary run and coverage of the reference set (single command) | `nix develop -c make test`: `test-server` (`gotestsum … -- -cover -covermode=atomic -coverprofile=$(COVERPROFILE) ./...`, default `coverage.out`) then `test-client` (`vitest run --coverage`, report in `coverage/`). To keep the output outside the repo: `nix develop -c make test COVERPROFILE=/path/coverage.out ARGS=--coverage.reportsDirectory=/path/coverage` |
| Fuzz | `nix develop -c make test-fuzz` runs the seed corpus of every `fuzz`-tagged `Fuzz…` target (`go test -tags fuzz -run '^(FuzzParseForwardedHeaderProto)$' ./api/http/middlewares`). `make test-fuzz FUZZTIME=30s` then fuzzes each target in turn for that time (`go test -tags fuzz -run '^$' -fuzz '^<name>$' -fuzztime 30s <package>`). New inputs go to the Go fuzz cache; a crasher is written to `testdata/fuzz/` in the package |
| Performance | `nix develop -c make test-performance` runs every `Test…` in `performance`-tagged files (`go test -tags performance -run '^(Test_encryptAndDecrypt_withTheSamePassword)$' ./api/crypto`), then the benchmarks of the seven packages above (`go test -run '^$' -bench . -benchmem -benchtime $(BENCHTIME)`, default `1s`) |
| Mutation | none until phase D1 picks a tool |

`COVERPROFILE` is new in COV-005 (default unchanged, `coverage.out`). The test lists in `-run` and the package lists are derived in the Makefile from the `//go:build` lines and `func Fuzz…`/`func Test…`/`func Benchmark…` names, so a new tagged file needs no Makefile change.

### Effect on coverage

`api/crypto` in the reference set: 59.3 % of statements without the performance test, 70.0 % with it (`go test -tags performance -cover ./api/crypto`). The 100 MB test is the only one that calls `AesEncrypt`, `AesDecrypt`, `aesDecrypt` (header check, FIPS/non-FIPS mismatch) and `aesDecryptOFB` (legacy); in the reference set they are at 0 % (with it: 50 %, 100 %, 68.2 %, 80 %, from `go tool cover -func`). Phase C has to cover them with small inputs in the reference set. The fuzz seed corpus added nothing that `TestParseForwardedHeaderProto` does not already run with the same table.

### Verification, 2026-11-09

Inside `nix develop` (Go 1.26.10), output in `/workspace/a0-runs/a2/` outside the repo.

| Check | Result |
|-------|--------|
| `go test -list '.*' ./api/crypto ./api/http/middlewares` (no tag) | lists neither `Test_encryptAndDecrypt_withTheSamePassword` nor `FuzzParseForwardedHeaderProto`; `TestParseForwardedHeaderProto`, `TestIsHTTPSRequest` and the other crypto tests are listed |
| `go vet` with no tag, `-tags fuzz`, `-tags performance`; `gofmt -l` | clean |
| `make test-server COVERPROFILE=/workspace/a0-runs/a2/coverage.out` with a gotestsum JSON file | 56 s, 3,454 tests with subtests, 69 skipped, 0 failed (before: 3,493, 69 skipped). The JSON has no event for either labeled test; `api/crypto` 0.6 s (was about 22 s) |
| `make test-fuzz FUZZTIME=5s` | seed corpus: gotestsum reports 29 tests (the target and its seed inputs), all passed; 5 s fuzzing, 13,249 execs, no failure |
| `make -n test-performance`; `go test -tags performance -run '^(Test_encryptAndDecrypt_withTheSamePassword)$' -v ./api/crypto` | target selects exactly that test and the seven benchmark packages; the test passed in 13.5 s. The benchmarks were listed with `-list '^Benchmark'`, not run |
| Frontend | no file changed; the client suite was not re-run for A2 |

## 8. Test spec (B, COV-006)

[portainer-testspec.md](portainer-testspec.md) maps all 178 requirements of [portainer-spec.md](portainer-spec.md) to the existing tests, by test name and file, on 2026-11-09 at `2-covered@af382f49d`. It was built by reading the tests; no test was run, added, renamed or changed, and no production code was touched.

- Result: 57 requirements are checked directly and 39 partially (96 with tests); 18 have only loosely related tests, 29 have none, 30 are BE-only with nothing to test in CE, and 5 live outside this repository. Per-area counts are in the test spec summary.
- Layers used by the mapped tests are the ones in section 1: Go unit and handler tests (`testing` + `testify`, `httptest`, temporary BoltDB) and Vitest/jsdom component and hook tests with MSW, both in the reference test set (section 7, `nix develop -c make test`). Gated integration tests (`INTEGRATION_TEST`) are marked in the test spec and are not part of the reference set. There is still no end-to-end layer, so requirements that need a running server (for example REQ-SRV-01 ports, REQ-SRV-08 `--base-url`) can only be checked partly.
- Naming: existing upstream tests keep their names (no mass rename in a fork); new phase C tests carry the ID, `TestREQ_<AREA>_<NN>_<Behaviour>` in Go and `describe('REQ-<AREA>-<NN> …')` in Vitest.
- Clarifications decided (COV-007, 2026-11-09): the user answered C-01 to C-13 and L-01 to L-14 as proposed. CE scope was widened for stack webhooks, template variables, Kubernetes scale/patch/rollback/pod restart, Edge async mode and built-in roles; the SSRF default off is pinned; REQ-API-01 is documentation only; external items are "not tested in this repo"; REQ-DED-01 is accepted and L-01 to L-13 are pinned as observed as REQ-DED-02 to REQ-DED-14, without new caps; L-14 stays an implementation detail. The test spec carries the decisions, the spec the amended requirements. Behaviour without an ID is listed under "Behaviour without a requirement ID" for the phase C backwards-compatibility tests.
- Phase B is done: every requirement is mapped, every clarification is decided, and the spec and the test spec match those decisions.

## 9. Coverage baseline and plan (C, COV-008, remeasured COV-009)

### Measurement

COV-008 measured once on 2026-11-09 without `coverage.include` (48.8 % project-wide; client 68.5 % of loaded files only). COV-009 (user, 2026-11-09) set `coverage.include: ['app/**']` in `vitest.config.mts` (generated-api exclude kept from COV-004) and remeasured. This section holds the remeasurement.

One run of the authoritative command on 2026-11-09, 16:18 to 16:22 (Europe/Berlin), inside `nix develop` (Go 1.26.10, Node 22.22.1), on `2-covered@7476f68ef` (the `coverage.include` commit; this section recorded in `0769c07f2`). Output in `/workspace/a0-runs/c-baseline-include/` on the agent box, outside the repo.

```
nix develop -c make test COVERPROFILE=/workspace/a0-runs/c-baseline-include/coverage.out \
  "ARGS=--coverage.reportsDirectory=/workspace/a0-runs/c-baseline-include/coverage --coverage.reporter=json-summary --coverage.reporter=text-summary"
```

| Suite | Tests | Statements | Covered | Coverage |
|-------|-------|-----------:|--------:|---------:|
| Go (`make test-server`, `-covermode=atomic`, `./...`) | 3,454 with subtests, 69 skipped, 0 failed, 132.9 s | 32,392 | 13,228 | 40.8 % (`go tool cover -func` total) |
| Client (`make test-client`, Vitest v8, `coverage.include: ['app/**']`) | 311 files passed, 1 skipped; 2,282 tests passed, 5 skipped, 12 todo, 0 failed | 35,322 | 8,890 | 25.2 % (statements; Vitest summary 25.16 %; branches 31.5 %, functions 26.3 %, lines 25.1 %) |
| **Project (statement-weighted sum of both)** | | **67,714** | **22,118** | **32.7 %** |

Exit code 0, about 4 min 39 s wall time. The project number is the authoritative count for phase C. Per-suite and per-package numbers are a breakdown only.

How the numbers were read: Go blocks from `coverage.out`, de-duplicated by block, a block counted as covered when its count is above 0; summed per directory (196 Go packages). Client statements from `coverage-final.json`, summed per directory (2,995 files in 810 directories under `app/`).

Limits of this measurement:

- Client now counts every hand-written `app/**` source matching `coverage.include`, including files no test loads. That brings the Docker volume UI (`app/docker/views/volumes/**`, `app/react/docker/volumes/**`, `app/react/docker/containers/CreateView/VolumesTab/**`, and related helpers) into the denominator and the plan. The COV-004 generated-api exclude remains. Compared with COV-008, client coverage fell from 68.5 % (8,920 of 13,021 loaded files) to 25.2 % (8,890 of 35,322); covered statements stayed almost the same.
- The `ARGS=--coverage.reportsDirectory=…` override still does not take effect (recipe appends `--coverage` after `$(ARGS)`); the client report went to `./coverage/` and was moved to `/workspace/a0-runs/c-baseline-include/coverage/` after the run. The Go `COVERPROFILE` override works.
- Several Go packages came from the test cache; their coverage is part of the cached result and the profile.
- `api/internal/testhelpers` (233 statements, 0 %) is hand-written test-support code outside `_test.go` files and counts in the Go total.

### Overshoot

Bar 85 %. Gap 85 − 32.7 = 52.3 points; one fifth is 10.5 points (more than the 1-point minimum), so the plan runs through **95.5 %**. That needs 42,549 more covered statements.

### Missed coverage by module

| Module | Statements | Covered | Missed | Coverage | Packages |
|--------|-----------:|--------:|-------:|---------:|---------:|
| Go `github.com/portainer/portainer` `api/` | 28,594 | 11,366 | 17,228 | 39.7 % | 160 |
| Go `github.com/portainer/portainer` `pkg/` | 3,798 | 1,862 | 1,936 | 49.0 % | 36 |
| Client `@portainer/ce` `app/` (all `app/**`, COV-009) | 35,322 | 8,890 | 26,432 | 25.2 % | 810 |

### Plan order: Priority then Deferred (COV-009)

The skill’s largest-first order is kept **inside** each tier. COV-009 puts packages the later tailored stage will remove in a Deferred tier and works Priority first. Deferred packages stay in the measurement denominator and in the overshoot arithmetic; they are only ordered after Priority.

**Priority (work first):** local Docker containers, images, volumes, networks; local compose stacks; local docker endpoints/hosts; datastore migrator; docker proxy (including volume proxy rules); settings that stay; crypto; filesystem/datastore and similar kept surfaces; client volume UI and other kept `app/**` that is not deferred.

**Deferred (list and measure, work after Priority):** Kubernetes (`api/http/handler/kubernetes`, `api/kubernetes/**`, Helm/`pkg/libhelm/**`, `pkg/libkubectl`, kube client UI), Swarm (`pkg/libstack/swarm`, `app/docker/views/{services,swarm,secrets,configs,nodes,tasks}/**`), Edge (edge handlers, chisel, edge UI), registries, backup/restore, user-management and login/auth-for-users (users, teams, auth, ldap, oauth, jwt, apikey, roles, resourcecontrols, access-control UI).

Volume tie-break among equals still applies inside a tier. No Go package is volume-only at the top; client volume directories enter Priority by their missed counts (largest: `app/agent/components/volume-browser` 75, `app/docker/views/volumes/create` 70, `app/react/docker/containers/CreateView/VolumesTab` 52).

#### Can Priority packages alone reach the overshoot?

No. Priority packages miss 23,516 statements across 527 packages. Covering every Priority miss would raise the project total from 22,118 to 45,634 of 67,714 (**67.4 %**), short of the 95.5 % overshoot by 19,033 statements. The bar (85 %) and overshoot formula are unchanged. This slice does **not** start Deferred (Kubernetes/Swarm/Edge/user/registry/backup) tests; the shortfall is recorded as an open point (writing thousands of tests for code the tailored stage will delete is wasteful; the user chose this order in COV-009).

Taking packages Priority-first then Deferred by missed statements, the overshoot line is crossed after 684 packages (all 527 Priority plus 145 Deferred); together they miss 42,558 statements.

#### Priority packages by missed statements (largest first)

| # | Lang | Package | Statements | Covered | Missed | % |
|--:|------|---------|-----:|-----:|-----:|-----:|
| 1 | Go | `api/http/handler/stacks` | 1,731 | 572 | 1,159 | 33.0 |
| 2 | Go | `api/http/handler/endpoints` | 1,646 | 633 | 1,013 | 38.5 |
| 3 | Go | `api/datastore/migrator` | 1,168 | 298 | 870 | 25.5 |
| 4 | TS/JS | `app/portainer/services/api` | 690 | 9 | 681 | 1.3 |
| 5 | Go | `api/http/proxy/factory/docker` | 1,114 | 783 | 331 | 70.3 |
| 6 | Go | `api/filesystem` | 636 | 435 | 201 | 68.4 |
| 7 | TS/JS | `app/portainer/services` | 481 | 380 | 101 | 79.0 |
| 8 | Go | `api/datastore` | 630 | 423 | 207 | 67.1 |
| 9 | Go | `api/stacks/deployments` | 500 | 255 | 245 | 51.0 |
| 10 | TS/JS | `app/docker/helpers` | 368 | 227 | 141 | 61.7 |
| 11 | Go | `api/http/handler/endpointgroups` | 357 | 275 | 82 | 77.0 |
| 12 | Go | `api/cmd/portainer` | 296 | 202 | 94 | 68.2 |
| 13 | TS/JS | `app/docker/models` | 298 | 153 | 145 | 51.3 |
| 14 | Go | `api/internal/testhelpers` | 233 | 0 | 233 | 0.0 |
| 15 | Go | `api/docker/images` | 328 | 164 | 164 | 50.0 |
| 16 | TS/JS | `app/react/components/SortableList` | 312 | 237 | 75 | 76.0 |
| 17 | Go | `api/http/handler/websocket` | 305 | 157 | 148 | 51.5 |
| 18 | Go | `api/database/boltdb` | 336 | 307 | 29 | 91.4 |
| 19 | Go | `api/git` | 467 | 409 | 58 | 87.6 |
| 20 | TS/JS | `app/docker/helpers/logHelper` | 202 | 202 | 0 | 100.0 |
| 21 | Go | `pkg/libstack/compose` | 302 | 258 | 44 | 85.4 |
| 22 | TS/JS | `app/portainer/models` | 246 | 126 | 120 | 51.2 |
| 23 | TS/JS | `app/react/components/datatables` | 531 | 484 | 47 | 91.1 |
| 24 | Go | `api/http/security` | 370 | 263 | 107 | 71.1 |
| 25 | Go | `api/internal/endpointutils` | 187 | 121 | 66 | 64.7 |

#### Deferred packages by missed statements (largest first; worked after Priority)

| # | Lang | Package | Statements | Covered | Missed | % |
|--:|------|---------|-----:|-----:|-----:|-----:|
| 1 | Go | `api/http/handler/kubernetes` | 2,317 | 607 | 1,710 | 26.2 |
| 2 | Go | `api/kubernetes/cli` | 2,791 | 1,147 | 1,644 | 41.1 |
| 3 | TS/JS | `app/kubernetes/services` | 913 | 0 | 913 | 0.0 |
| 4 | TS/JS | `app/kubernetes/converters` | 776 | 0 | 776 | 0.0 |
| 5 | Go | `pkg/libhelm/sdk` | 1,077 | 424 | 653 | 39.4 |
| 6 | TS/JS | `app/kubernetes/views/applications/create` | 546 | 0 | 546 | 0.0 |
| 7 | TS/JS | `app/docker/views/services/edit` | 455 | 0 | 455 | 0.0 |
| 8 | TS/JS | `app/react/kubernetes/ingresses/CreateIngressView` | 371 | 0 | 371 | 0.0 |
| 9 | TS/JS | `app/kubernetes/helpers/application` | 327 | 0 | 327 | 0.0 |
| 10 | Go | `api/http/handler/users` | 545 | 231 | 314 | 42.4 |
| 11 | Go | `api/http/handler/edgejobs` | 394 | 122 | 272 | 31.0 |
| 12 | TS/JS | `app/docker/views/services/create` | 258 | 0 | 258 | 0.0 |
| 13 | Go | `pkg/libstack/swarm` | 392 | 150 | 242 | 38.3 |
| 14 | TS/JS | `app/react/kubernetes/applications/queries` | 265 | 48 | 217 | 18.1 |
| 15 | TS/JS | `app/kubernetes/ingress` | 203 | 0 | 203 | 0.0 |

The full ranking of all packages with missed statements (Priority then Deferred) is in `/workspace/a0-runs/c-baseline-include/all_packages.tsv` on the agent box (not committed). Plan through overshoot: `plan.tsv`.

### Order and status

Phase C works Priority from rank 1 down, one whole package at a time (skill step 4 to 6). Deferred packages stay in the measurement but are not tested (COV-012). Test files only; new tests named `TestREQ_<AREA>_<NN>_…` where a requirement applies and listed under "Backwards compatibility tests" in the test spec otherwise. First Priority package: `api/http/handler/stacks` (1,159 missed at COV-009). COV-010 added a first batch of compose-focused tests (stop, inspect, associate, response helpers): package coverage 33.0 % → 40.3 % (572 → 697 of 1,731; missed 1,159 → 1,034). COV-011 added create/migrate/list/git-guard tests: 40.3 % → 52.0 % (697 → 900 of 1,731; missed 1,034 → 831). COV-013 added compose git create/upload, git update/redeploy success paths, compose update HTTP, handler authz helpers and start/create guards: 52.0 % → 64.5 % (900 → 1,116 of 1,731; missed 831 → 615). COV-014 continued compose/local-Docker edges (delete/start/stop/file/migrate/update/git, async stackDeploy, swarm migrate/update HTTP in preferred files): 64.5 % → 68.1 % (1,116 → 1,179 of 1,732; missed 615 → 553; +63). Compose-quality paths are largely exhausted for large dents. COV-015 moved a non-admin test helper out of production-compiled `stack_test_helper.go`. COV-016 **closes Priority work on this package**: `create_swarm_stack.go`, `create_kubernetes_stack.go`, and `update_kubernetes_stack.go` are **deferred-within-package** (testable, skipped under COV-012 vision-aware policy — not uncoverable). Remaining compose leftovers (redeploy/update/delete error-injection paths) are not ground further. Package left at 68.1 % (1,179 of 1,732; 553 missed). COV-017 started Priority package `api/http/handler/endpoints` (local-Docker inspect, settings update, snapshot, unique-name/hideFields, delete/batch, docker update): 38.5 % → 46.9 % (633 → 772 of 1,646; missed 1,013 → 874; +139). Package not finished. COV-018 continued (filter helpers, unsecured/TLS Docker create, deeper update, dockerhub status guards): 46.9 % → 60.7 % (772 → 999 of 1,646; missed 874 → 647; +227). Package not finished. COV-019 continued (list/filter pagination, create Validate/tags/TLS files, update TLS/URL, delete extras): 60.7 % → 64.6 % (999 → 1,063 of 1,646; missed 647 → 583; +64). Diminishing returns; local leftovers look thin. COV-020 **closes Priority work on endpoints**: remaining local leftovers thin/hard; deferred-within-package unchanged. Package left at 64.6 % (1,063 of 1,646; 583 missed). Next Priority package: `api/datastore/migrator`. COV-021 started Priority `api/datastore/migrator` (local Docker endpoint/stack/settings/user migrations + core helpers): 25.5 % → 42.6 % (298 → 497 of 1,168; missed 870 → 671; +199). Package not finished. COV-022 continued (volume RC DB32 local slice with registry/kube/helm deferred-within-package inside that file; tags/endpoints DB23; RC/users/roles DB22; settings/schedules DB20; seed→key DB100; 2.43 UAC helpers; NeedsMigration count; DB19/30/36/130): 42.6 % → 61.2 % (497 → 715 of 1,168; missed 671 → 453; +218). Package not finished. COV-023 continued (2.43 helpers, migrate_ce version-gap/count/invalid, DB50 wrapper, local 2.44/2.45 leftovers; DB34 dockerhub wrapper + DB140 kube registry SA deferred-within-package): 61.2 % → 63.5 % (715 → 742 of 1,168; missed 453 → 426; +27). Diminishing; local leftovers thin/hard. COV-024 **closes Priority work on migrator**: thin/hard local leftovers; deferred-within-package unchanged (+ DB34/DB140). Package left at 63.5 % (742 of 1,168; 426 missed). Next Priority package: `app/portainer/services/api`. COV-025 started Priority `app/portainer/services/api` (local-Docker Endpoint/Stack/Settings/Tag/Group/Status/SSL/backup clients): 0 % → 28.3 % (0 → 195 of 690; missed 690 → 495; +195). Package not finished. COV-026 moved Angular factory helpers into `angularFactoryHelpers.test.js` (out of app source counted by coverage.include). COV-027 continued (ResourceControl/Access/Webhook/CustomTemplate, Stack compose lifecycle, Group helpers; backup deferred-within-package): 28.3 % → 50.4 % (195 → 348 of 690; missed 495 → 342; +153). Package not finished. COV-028 continued (TemplateService, SupportService, thin error branches; StackService swarm/kube paths deferred-within-package): 50.4 % → 55.4 % (348 → 382 of 690; missed 342 → 308; +34). Local leftovers thin. COV-029 **closes Priority work on `app/portainer/services/api`**: deferred surfaces dominate remaining misses. Package left at 55.4 % (382 of 690; 308 missed). COV-030 started Priority `api/http/proxy/factory/docker` (volume list/inspect/create-response/proxy + container blacklist filters + stack-label helper; secrets/configs/registry/swarm/tasks deferred-within-package candidates): 44.8 % → 54.6 % (499 → 608 of 1,114; missed 615 → 506; +109). COV-031 continued (findResourceControl depth, inherited vol/net/ctr labels, container inspect/update device-mapping, getDockerID snapshot/remote/swarm, volume filter/prune, container list label filtering, system networks): 54.6 % → 65.3 % (608 → 727 of 1,114; missed 506 → 387; +119). COV-032 continued (container creation security leftovers, volume existence-check, restrictedResourceOperation local vol/net/ctr + browse gate, interceptAndRewriteRequest + local buildOperation, network filter/inspect, admin volume delete RC cleanup). Registry-auth transport (`decorateRegistryAuthenticationHeader` / `replaceRegistryAuthenticationHeader` / `createRegistryAccessContext` / image create-push auth) deferred-within-package. Package 65.3 % → 70.3 % (727 → 783 of 1,114; missed 387 → 331; +56). Preferred local surfaces largely covered; remaining local leftovers thinner/harder (error-injection). COV-033 **closes Priority work on `api/http/proxy/factory/docker`**: thin/hard local leftovers; deferred-within-package unchanged (+ registry-auth). Package left at 70.3 % (783 of 1,114; 331 missed). Next Priority package: `api/filesystem`. COV-034 started Priority `api/filesystem` (stack/TLS/template/serialize/local helpers; edge/registry/chisel/MTLS deferred-within-package): 23.1 % → 68.4 % (147 → 435 of 636; missed 489 → 201; +288). Package not finished. COV-035 **closes Priority work on `api/filesystem`**: thin/hard local leftovers; deferred-within-package unchanged (Edge/registry/chisel/mTLS/CopySSL*). Package left at 68.4 % (435 of 636; 201 missed). Next Priority package: `app/portainer/services` (parent folder excluding `services/api`, already closed at COV-029). COV-036 started Priority `app/portainer/services` (exclude api/; LocalStorage/Pagination/FormValidator/Theme/EndpointProvider/NameValidator/StateManager/Authentication/FileUpload + helpers; registry/edge/kube/backup/swarm-upload deferred-within-package): 9.6 % → 79.0 % (46 → 380 of 481; missed 435 → 101; +334). Package not finished. Parallel Priority batch for `app/docker/helpers` (exclude logHelper/) merged from `2-covered-parallel-docker-helpers` (`a2af43995`): 8.15 % → 61.68 % (30 → 227 of 368; missed 338 → 141; +197). COV-037 **closes Priority work on `app/docker/helpers`**: deferred-within-package service/config/secret/task/node helpers + swarm container helpers (135 missed); thin local leftovers (6). Package left at 61.7 % (227 of 368; 141 missed). COV-038 **closes Priority work on `app/portainer/services`**: deferred registry/edge/kube/backup/swarm-upload dominate remaining 101 misses; thin local error branches. Package left at 79.0 % (380 of 481; 101 missed). Parallel Priority batch for `api/stacks/deployments` merged from `2-covered-parallel-deployments` (`590233419`): 29.4 % → 51.0 % (147 → 255 of 500; missed 353 → 245; +108). COV-039 **closes Priority work on `api/stacks/deployments`**: deferred-within-package swarm/k8s configs, DeploySwarm/DeployKubernetes, swarm unpacker cmds, remote swarm/remoteStack (~116); thin local leftovers; remote compose entrypoints mostly uncoverable without a live Docker client. Package left at 51.0 % (255 of 500; 245 missed). Parallel Priority batch for `api/datastore` merged from `2-covered-parallel-datastore` (`5431f5e8d`): 40.0 % → 67.1 % (252 → 423 of 630; missed 378 → 207; +171). COV-040 **closes Priority work on `api/datastore`** (not migrator): deferred-within-package Backup/Restore, Edge/Registry/Team/User/Helm Import loops, TunnelServer Export, encryptDB/NeedsEncryptionMigration; uncoverable encryptDB (log.Fatal); thin local Export/Import/Open/Init/migrate leftovers. Package left at 67.1 % (423 of 630; 207 missed). Parallel Priority batch for `api/http/handler/endpointgroups` merged from `2-covered-parallel-endpointgroups` (`acfad69cd`): 26.6 % → 77.0 % (95 → 275 of 357; missed 262 → 82; +180). COV-041 **closes Priority work on `api/http/handler/endpointgroups`**: deferred-within-package Edge updateEndpointRelations, User/Team access policies + k8s CleanNAP/PendingActions, registry/edge/azure endpoint types; thin/hard local DB error-injection and list/security-context leftovers. Package left at 77.0 % (275 of 357; 82 missed). Parallel Priority batch for `app/docker/models` merged from `2-covered-parallel-docker-models` (`9be2a0b45`): isolated remasure 7.0 % → 51.3 % (21 → 153 of 298; missed → 145; +132; COV-009 full-suite baseline was 17.4 % / 52). COV-042 **closes Priority work on `app/docker/models`**: preferred local models at 100 % statements; deferred-within-package swarm service/node/config/task/secret (145 missed); local leftovers 0. Package left at 51.3 % (153 of 298; 145 missed). Parallel Priority batch for `api/docker/images` merged from `2-covered-parallel-docker-images` (`c21d8348e`): 29.6 % → 50.0 % (97 → 164 of 328; missed 231 → 164; +67). COV-043 **closes Priority work on `api/docker/images`**: deferred-within-package RemoteDigest/RegistryAuth* datastore paths; deferred/BE-absent IMG-08 status helpers (C-12); thin TrimDigest leftover. Package left at 50.0 % (164 of 328; 164 missed). Parallel Priority batch for `api/cmd/portainer` merged from `2-covered-parallel-cmd-portainer` (`34f419da1`): 13.9 % → 68.2 % (41 → 202 of 296; missed 255 → 94; +161). COV-044 **closes Priority work on `api/cmd/portainer`**: deferred-within-package kube deployer, swarm/edge/registry, backup/restore, login/user-management, admin-init/OAuth; uncoverable Fatal/os.Exit arms in main/initCLI/buildServer/initDataStore. Package left at 68.2 % (202 of 296; 94 missed). Parallel Priority batch for `api/http/handler/websocket` merged from `2-covered-parallel-websocket` (`1556798bb`): 27.5 % → 51.5 % (84 → 157 of 305; missed 221 → 148; +73). COV-045 **closes Priority work on `api/http/handler/websocket`**: deferred-within-package pod.go, shell_pod.go, proxy.go (agent/edge tunnels) and thin agent/edge branches in handleAttach/ExecRequest; uncoverable NewRequest/JSON-encode and keepalive warn arms. Package left at 51.5 % (157 of 305; 148 missed). Parallel Priority batch for `api/database/boltdb` merged from `2-covered-parallel-boltdb` (`6cf406bc2`): 38.7 % → 91.4 % (130 → 307 of 336; missed 206 → 29; +177). COV-046 **closes Priority work on `api/database/boltdb`**: no deferred-within-package; remaining ~29 stmts are thin/hard Open/compact/marshal/decrypt/NextSequence/ExportJSON error-injection only. Package left at 91.4 % (307 of 336; 29 missed). Parallel Priority batch for `app/react/components/SortableList` merged from `2-covered-parallel-sortable-list` (`2f4a028a7`): isolated remasure 20.8 % → 76.0 % (65 → 237 of 312; missed → 75; +172; COV-009 full-suite baseline was 26.3 % / 82). COV-047 **closes Priority work on `app/react/components/SortableList`**: non-story production sources at 100 %; leftovers Storybook demo/play branches only; no deferred-within-package (no drag-and-drop; covered sort/filter/pager/item/store). Package left at 76.0 % (237 of 312; 75 missed). Parallel Priority batch for `api/git` merged from `2-covered-parallel-git` (`838ee62b4`): 56.5 % → 87.6 % (264 → 409 of 467; missed 203 → 58; +145). COV-048 **closes Priority work on `api/git`**: deferred-within-package live GitHub/Azure integration auth paths (registry/edge/gitops-only and kube/helm untouched); remaining ~58 stmts thin/hard Azure URL/build*Url/Download/List*/CloneWithBackup/gitClient/newService error arms. Package left at 87.6 % (409 of 467; 58 missed). Parallel Priority batch for `app/docker/helpers/logHelper` (separate from COV-037 top-level helpers) merged from `2-covered-parallel-loghelper` (`3279481f5`): isolated remasure 0.0 % → 100 % (0 → 202 of 202; +202; COV-009 listed 195). COV-049 **closes Priority work on `app/docker/helpers/logHelper`**: statement coverage complete; 2 thin branch leftovers only; deferred callers (swarm/kube/edge logs) outside this package. Package left at 100 % (202 of 202; 0 missed). Parallel Priority batch for `app/portainer/models` merged from `2-covered-parallel-portainer-models` (`0ed8d2947`): isolated remasure 0.0 % → 51.2 % (0 → 126 of 246; missed → 120; +126; COV-009 full-suite baseline was 13.3 % / 29 of 218). COV-050 **closes Priority work on `app/portainer/models`**: preferred local models at 100 %; deferred-within-package user/team/registry/edge (120 missed); local leftovers 0. Package left at 51.2 % (126 of 246; 120 missed). Parallel Priority batch for `pkg/libstack/compose` merged from `2-covered-parallel-libstack-compose` (`473236f90`): 37.1 % → 85.4 % (112 → 258 of 302; missed 190 → 44; +146). COV-051 **closes Priority work on `pkg/libstack/compose`**: deferred-within-package GetExistingEdgeStacks / addServiceLabels EdgeStackID; uncoverable getContainerLogsTail (needs Docker daemon); thin Config/createProject/bind_mount_hash/WaitForStatus leftovers. Package left at 85.4 % (258 of 302; 44 missed). Parallel Priority batch for `api/http/security` merged from `2-covered-parallel-http-security` (`fb693fb5a`): 51.4 % → 71.1 % (190 → 263 of 370; missed 180 → 107; +73). COV-052 **closes Priority work on `api/http/security`**: deferred-within-package team/user filters, registry access/filters, Admin/Restricted/TeamLeader middleware, Edge ops, password-strength leftovers, and JWT/API-key login-auth lookup/RevokeJWT; thin mwUpgradeToRestrictedRequest leftover. Package left at 71.1 % (263 of 370; 107 missed). Parallel Priority batch for `api/internal/endpointutils` merged from `2-covered-parallel-endpointutils` (`5b81b67c9`): 10.7 % → 64.7 % (20 → 121 of 187; missed 167 → 66; +101). COV-053 **closes Priority work on `api/internal/endpointutils`**: deferred-within-package Kubernetes InitialIngressClassDetection / InitialMetricsDetection / storageDetect / InitialStorageDetection; uncoverable InitEndpoint log.Fatal; thin createTLSSecuredEndpoint agent-upgrade leftover. Package left at 64.7 % (121 of 187; 66 missed). Parallel Priority batch for `api/http/handler/webhooks` (not in the top-25 Priority table by missed count at COV-009; worked as a remaining Priority package) merged from `2-covered-parallel-webhooks` (`68e8b5e0a`): 0.0 % → 69.3 % (0 → 113 of 163; missed 163 → 50; +113). COV-054 **closes Priority work on `api/http/handler/webhooks`**: deferred-within-package registry access on create/update and executeServiceWebhook success (swarm-service-only); thin/hard DB error-injection and unreachable mux token-missing leftovers. Package left at 69.3 % (113 of 163; 50 missed). Parallel Priority batch for `api/http/handler/gitops/sources` (not in the top-25 Priority table by missed count at COV-009; worked as a remaining Priority package) merged from `2-covered-parallel-gitops-sources` (`768019776`): 63.8 % → 90.0 % (292 → 412 of 458; missed 166 → 46; +120). COV-055 **closes Priority work on `api/http/handler/gitops/sources`**: deferred-within-package helm source-type listing, edge-stack artifact existence in delete, k8s factory / registry-credential-only paths; thin local security-context/DB/delete/testAndSave/summary/scheduler leftovers. Package left at 90.0 % (412 of 458; 46 missed). Parallel Priority batch for `app/react/components/datatables` merged from `2-covered-parallel-datatables` (`50cc8366a`): isolated remasure 44.1 % → 91.1 % (234 → 484 of 531; missed → 47; +250; COV-009 full-suite baseline was 65.9 % / 350). COV-056 **closes Priority work on `app/react/components/datatables`**: no deferred-within-package (`editable/` and `extend-options/` are separate plan packages); preferred table chrome covered; leftover expandable/story internals thin. Package left at 91.1 % (484 of 531; 47 missed). Parallel Priority batch for `api/http` (parent package only, not `handler/*`; not in the top-25 Priority table by missed count at COV-009) merged from `2-covered-parallel-api-http` (`b9858490c`): 1.8 % → 99.4 % (3 → 162 of 163; missed 160 → 1; +159). COV-057 **closes Priority work on `api/http`**: deferred-within-package kube/edge/registry/team/login-user-management NewHandler wiring arms inside Start; one thin shutdown error-log leftover. Package left at 99.4 % (162 of 163; 1 missed). Parallel Priority batch for `api/dataservices/source` (not in the top-25 Priority table by missed count at COV-009; worked as a remaining Priority package) merged from `2-covered-parallel-dataservices-source` (`a9dcd9c2d`): 37.3 % → 90.6 % (87 → 211 of 233; missed 146 → 22; +124). COV-058 **closes Priority work on `api/dataservices/source`**: deferred-within-package helm/registry source types; thin/hard DB/normalize/sanitize/NewService leftovers. Package left at 90.6 % (211 of 233; 22 missed). Parallel Priority batch for `api/stacks/stackbuilders` (not in the top-25 Priority table by missed count at COV-009; worked as a remaining Priority package) merged from `2-covered-parallel-stackbuilders` (`ae8164c3a`): 42.0 % → 68.1 % (108 → 175 of 257; missed 149 → 82; +67). COV-059 **closes Priority work on `api/stacks/stackbuilders`**: deferred-within-package k8s_* / swarm_* / initSwarmDeployment; preferred compose file+git builders at 100 %; thin director/saveStack/cleanUp/stack_git error leftovers. Package left at 68.1 % (175 of 257; 82 missed). Parallel Priority batch for `app/docker/views/networks/create` (not in the top-25 Priority table by missed count at COV-009; worked as a remaining Priority package) merged from `2-covered-parallel-networks-create` (`335f12670`): isolated 0 % → 95.0 % (0 → 132 of 139; missed 139 → 7; +132). COV-060 **closes Priority work on `app/docker/views/networks/create`**: deferred-within-package overlay+agentProxy managerOperation, macvlan ConfigFrom Scope='swarm', macvlan local multi-node agent create loop; preferred bridge/macvlan/ipvlan form paths covered. Package left at 95.0 % (132 of 139; 7 missed). Parallel Priority batch for `api/exec` (not in the top-25 Priority table by missed count at COV-009; worked as a remaining Priority package) merged from `2-covered-parallel-exec` (`9c73ef57b`): 26.4 % → 53.9 % (47 → 96 of 178; missed 131 → 82; +49). COV-061 **closes Priority work on `api/exec`**: deferred-within-package kubernetes_deploy.go and swarm_stack Deploy/Remove/NormalizeStackName; uncoverable fetchEndpointProxy success (live agent); thin Close arms and hard copyDefaultEnvFile/createEnvFile I/O leftovers. Package left at 53.9 % (96 of 178; 82 missed). Parallel Priority batches for `app/react/docker/containers/CreateView` (includes BaseForm/ and ResourcesTab/; addresses those COV-009 ranking rows) merged from `2-covered-parallel-createview` (`92b5f6d1b` + `e4ba9882c`): isolated 12.5 % → 68.88 % (92 → 507 of 736; missed 644 → 229; +415). COV-062 **closes Priority work on `app/react/docker/containers/CreateView`**: deferred-within-package useCreateMutation / GpuFieldset UI / useInitialValues registry-webhook-from / swarm-agent node selector + Edge webhook BaseForm paths; thin VolumeSelector/PortsMapping/Capabilities/Runtime/Sysctls leftovers. Package left at 68.9 % (507 of 736; 229 missed). Parallel Priority batch for `pkg/snapshot` (not in the top-25 Priority table by missed count at COV-009; worked as a remaining Priority package) merged from `2-covered-parallel-pkg-snapshot` (`367ff1ce9`): 47.1 % → 70.5 % (115 → 172 of 244; missed 129 → 72; +57). COV-063 **closes Priority work on `pkg/snapshot`**: deferred-within-package kubernetes.go arms and deeper swarm service stack-label arms; thin swarm warn/No-such-container/CalculateContainerStats/edge-key probe/StdCopy leftovers. Package left at 70.5 % (172 of 244; 72 missed). Parallel Priority batch for `app/portainer/helpers` (not in the top-25 Priority table by missed count at COV-009; worked as a remaining Priority package) merged from `2-covered-parallel-portainer-helpers` (`45e54a011`): isolated remasure 15.64 % → 98.88 % (28 → 177 of 179; +149; COV-009 full-suite baseline was ~27.9 % / ~129 missed). COV-064 **closes Priority work on `app/portainer/helpers`**: deferred-within-package getExternalStacksFromServices (swarm) and baseEdgeStackWebhookUrl (edge) — 2 stmts; local leftovers none. Package left at 98.9 % (177 of 179; 2 missed). Parallel Priority batch for `api/http/handler/settings` (not in the top-25 Priority table by missed count at COV-009; worked as a remaining Priority package) merged from `2-covered-parallel-settings` (`d6340cb09`): 9.6 % → 77.2 % (13 → 105 of 136; missed 123 → 31; +92). COV-065 **closes Priority work on `api/http/handler/settings`**: deferred-within-package OAuth/LDAP/AD update+validate, EdgePortainerURL/edge flags, LDAP TLS enable, LDAP TeamSync in public settings; thin/hard datastore read/persist and Helm SSRF/ValidateHelmRepositoryURL leftovers. Package left at 77.2 % (105 of 136; 31 missed).

## 10. Open for later phases

- C: Priority package `api/http/handler/stacks` closed (COV-016) with swarm/k8s create/update files deferred-within-package. Priority package `api/http/handler/endpoints` closed (COV-020). Priority `api/datastore/migrator` closed (COV-024) at 63.5 %. Priority `app/portainer/services/api` closed (COV-029) at 55.4 %. Priority `api/http/proxy/factory/docker` closed (COV-033) at 70.3 %. Priority `api/filesystem` closed (COV-035) at 68.4 %. Priority `app/docker/helpers` closed (COV-037) at 61.7 %. Priority `app/portainer/services` closed (COV-038) at 79.0 % (exclude api/). Priority `api/stacks/deployments` closed (COV-039) at 51.0 %. Priority `api/datastore` closed (COV-040) at 67.1 %. Priority `api/http/handler/endpointgroups` closed (COV-041) at 77.0 %. Priority `app/docker/models` closed (COV-042) at 51.3 %. Priority `api/docker/images` closed (COV-043) at 50.0 %. Priority `api/cmd/portainer` closed (COV-044) at 68.2 %. Priority `api/http/handler/websocket` closed (COV-045) at 51.5 %. Priority `api/database/boltdb` closed (COV-046) at 91.4 %. Priority `app/react/components/SortableList` closed (COV-047) at 76.0 %. Priority `api/git` closed (COV-048) at 87.6 %. Priority `app/docker/helpers/logHelper` closed (COV-049) at 100 %. Priority `app/portainer/models` closed (COV-050) at 51.2 %. Priority `pkg/libstack/compose` closed (COV-051) at 85.4 %. Priority `api/http/security` closed (COV-052) at 71.1 %. Priority `api/internal/endpointutils` closed (COV-053) at 64.7 %. Priority `api/http/handler/webhooks` closed (COV-054) at 69.3 %. Priority `api/http/handler/gitops/sources` closed (COV-055) at 90.0 %. Priority `app/react/components/datatables` closed (COV-056) at 91.1 %. Priority `api/http` (parent) closed (COV-057) at 99.4 %. Priority `api/dataservices/source` closed (COV-058) at 90.6 %. Priority `api/stacks/stackbuilders` closed (COV-059) at 68.1 %. Priority `app/docker/views/networks/create` closed (COV-060) at 95.0 %. Priority `api/exec` closed (COV-061) at 53.9 %. Priority `app/react/docker/containers/CreateView` (incl. BaseForm/ResourcesTab) closed (COV-062) at 68.9 %. Priority `pkg/snapshot` closed (COV-063) at 70.5 %. Priority `app/portainer/helpers` closed (COV-064) at 98.9 %. Priority `api/http/handler/settings` closed (COV-065) at 77.2 %. `api/crypto` includes the paths that only the `performance` test reached (section 7, effect on coverage), to be covered with small inputs when that package comes up.
- C, closed by COV-012 (user, 2026-11-09): Priority packages alone cannot reach the 95.5 % overshoot (max about 67.4 %). After Priority is exhausted (tests or honestly uncoverable), end covered below the project-wide 85 % bar. Do not test Deferred packages to chase that bar. No new percentage target unless a later decision sets one. Covered exit still needs user confirmation when Priority is done.
- C: the `ARGS` coverage-directory override in `make test-client` does not work (section 9, Limits); fixing it is a Makefile change.
- C: write the backwards-compatibility tests listed in the test spec, and the boundary tests for accepted limits.
