# Portainer test strategy

Test strategy for `bespoke-portainer-ce`. Stage `2-covered` keeps this file current. This first version holds only the phase A0 inventory of the test suite (COV-001). The reference test set (A1/A2), the test spec (B), coverage (C), and mutation and fuzz testing (D) come later.

Inventory taken on 2026-11-09 at `2-covered@a931b322a`. Nothing was added or changed in tests, test config, build or production code.

## 1. Test structure

### Commands

| Target | Recipe | Notes |
|--------|--------|-------|
| `make test` | `test-server` then `test-client` | Runs both suites. |
| `make test-server` | `go run gotest.tools/gotestsum@v1.13.0 --format pkgname-and-test-fails --format-hide-empty-pkg --hide-summary skipped -- -cover -covermode=atomic -coverprofile=coverage.out ./...` | `TEST_PACKAGES` (default `./...`) narrows the packages. Writes `coverage.out` to the repo root. No `-race`, no `-shuffle`, no `-short`. |
| `make test-client` | `pnpm run test $(ARGS) --coverage` (`vitest run`) | Coverage provider v8, reporters text/json/html into `./coverage/`. |
| `pnpm run typecheck`, `make lint` | `tsc --noEmit`, eslint, golangci-lint | Static checks, not tests. `make lint-server` reads `.golangci-version`, which does not exist in this tree. |
| `pnpm run storybook` | Storybook dev server | 85 `*.stories.*` files. No test runner is attached to them. |

There is no CI at this pin (no `.github/workflows`), so no command is enforced anywhere. There is no end-to-end suite (no Playwright, Cypress or similar), and no build tag or task for integration, fuzz, mutation or performance tests.

### Backend (Go)

- Framework: standard `testing` with `testify` (`assert`/`require`), run by `gotestsum`. HTTP handlers are tested with `net/http/httptest` (157 files). Many tests run against a real temporary BoltDB store from `datastore.MustNewTestStore` (138 files).
- Location: `*_test.go` next to the code. 424 test files in 138 directories; the biggest areas are `api/http` (176 files), `api/kubernetes` (31), `pkg/libhelm` (20), `api/dataservices` (14) and `api/datastore` (13). Fixtures sit in `testdata/` under `api/git`, `api/filesystem` and `api/archive`.
- Counted statically: 1,641 `func Test…`, 24 `func Benchmark…` (not run without `-bench`), 1 `func Fuzz…` (`FuzzParseForwardedHeaderProto` in `api/http/middlewares/proxy_headers_test.go`; its seed corpus runs as an ordinary test), no `Example…`, no `TestMain`. 375 of the 424 files call `t.Parallel()`.
- Tags and gates: one build tag (`//go:build unix`). Integration tests are gated at runtime, not by tag: `pkg/testhelpers.IntegrationTest(t)` (env `INTEGRATION_TEST` or flag `-integration`) and `pkg/libhelm/test.EnsureIntegrationTest(t)` (env `INTEGRATION_TEST`), plus direct `os.LookupEnv("INTEGRATION_TEST")` checks. They are used in 11 files (`api/exec`, `api/git` Azure/GitHub, `pkg/libhelm/sdk`, `pkg/libhelm`, `pkg/libstack/compose`, `pkg/libstack/swarm`). One test checks `testing.Short()` (`api/dataservices/stack/tests/stack_test.go`).
- What the tests need:
  - File system: almost all, through `t.TempDir()` (64 files) and the BoltDB test store. Some build fixed `/tmp/...` paths as strings only. `api/archive` and `api/http/handler/backup` shell out to `tar`.
  - Docker daemon: `pkg/libstack/compose/composeplugin_test.go` (not gated, see F-02), plus the gated integration tests in `api/exec`, `pkg/libstack/compose` and `pkg/libstack/swarm`.
  - Network: the gated `api/git` GitHub and Azure tests (real remote repositories, including a private one); `pkg/networking` DNS probe (not gated, F-03); `pkg/libhelm/sdk` tests that appear to wait for unreachable hosts (F-04). Other files mention external URLs only as fixture strings or against `httptest` servers.
  - Clock: `time.Sleep` in 12 files (for example `api/jwt` 2 s, `api/adminmonitor` 2 s, `api/http/offlinegate` 1 s, `api/http/security` 1 s, `api/chisel`, `api/concurrent`, `api/gitops/scheduling`); `time.Now()` in 27 files. No fake clock is used.
  - Display: none.
  - Environment variables: `t.Setenv` in 15 files; `os.Unsetenv` without restore in 2 (F-08).

### Frontend (TypeScript/React and AngularJS)

- Framework: Vitest 4 (`vitest.config.mts`) with `environment: 'jsdom'`, `globals: true`, React Testing Library (`testIdAttribute: 'data-cy'`), `@testing-library/user-event`, `jest-dom`, and MSW 2 as the network layer (`onUnhandledRequest: 'error'`, `server.resetHandlers()` after each test). `vitest-fail-on-console` fails a test on any console log/info/warn/error (except the unmounted-state-update message). `toastr` and `axios-progress-bar` are stubbed; CodeMirror and `Range`/`getSelection` are mocked. `bail: 2` stops a run after two failures.
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

Each finding below needs a user decision: move, label, fix, or leave. None is decided yet. Decisions are recorded as `COV-nnn` in `BESPOKE.md`.

| ID | Finding | Evidence | Options noted (not decided) |
|----|---------|----------|-----------------------------|
| F-01 | Shared global logger in parallel tests. `api/http/middlewares/panic_logger_test.go` (two `t.Parallel()` tests) and `api/http/logger_test.go` assign the global `log.Logger` to a test buffer without restoring it, while other parallel tests in the package write to the same global logger. | `TestWithPanicLoggerRePanicsErrAbortHandler` failed in Go run 1 (its buffer held deprecation and HTTP-error lines from other tests) and passed in run 2. Flaky. | fix in the tests (no parallel run or a local logger), label, leave |
| F-02 | Docker daemon tests in the ordinary run without a gate. `pkg/libstack/compose/composeplugin_test.go`: `Test_UpAndDown`, `Test_UpAndDownWithInjection`, `TestRun`, `Test_DeployWithRemoveOrphans`, `Test_DeployWithIgnoreOrphans`. They need `/var/run/docker.sock`, pull `alpine:latest` from Docker Hub, and create real containers. | Failed in both runs here (`permission denied` on the Docker socket). | move behind the existing `INTEGRATION_TEST` gate, label, leave |
| F-03 | Real DNS in the ordinary run. `pkg/networking/diagnostics_test.go` `TestProbeDNSConnection/Invalid_domain` expects `nonexistent.domain.invalid` not to resolve. | Failed in both runs here: the host resolver answers every name. The result depends on the network. | move behind the gate, fix (stub the resolver), leave |
| F-04 | Suspected outbound network and timeouts in the ordinary run: `pkg/libhelm/sdk` `TestLoginToOCIRegistry` (14 s) and `Test_InitActionConfig` (10 s, uses `https://kubernetes.default.svc`). Inferred from duration and host names, not traced. | Passed both runs, but they account for most of the package's 24 s. | move, label, leave |
| F-05 | Large-data test in the ordinary run: `api/crypto` `Test_encryptAndDecrypt_withTheSamePassword` encrypts about 100 MB (22 s). Performance-like. | Slowest Go test. | label as `performance` in A2, leave |
| F-06 | Generated and random inputs in the ordinary run: the seed corpus of `FuzzParseForwardedHeaderProto` runs as a normal test (cheap); `api/database/boltdb` `Test_MarshalObjectUnencrypted` uses `uuid.New()` in subtest names and `api/datastore` `TestBackup` puts the temp path in subtest names, so names differ between runs. | Seen when comparing run 1 and run 2 by test name. | label the fuzz target as `fuzz` in A2, leave |
| F-07 | Files left behind: each Go run leaves three empty `/tmp/azure-git-repo-*.zip` files from the `api/git` Azure tests. The temp file is created in production code (`api/git/azure.go`, `os.CreateTemp` without removal on the error path). | 6 files after two runs. | fix (touches production code, so it needs the user's agreement), leave |
| F-08 | Process environment and package state changed without restore: `api/internal/upgrade/upgrade_docker_test.go` calls `os.Unsetenv(updaterImageEnvVar)`; `pkg/featureflags/featureflags_test.go` calls `os.Unsetenv("PORTAINER_FEATURE_FLAGS")` and `Parse` fills the package-level `featureFlags` map. | Not seen failing. | fix in the tests (`t.Setenv`), leave |
| F-09 | Order dependence inside a frontend file: `app/react/portainer/HomeView/LicenseNodePanel.test.tsx`. The "more nodes than allowed" test fails when the "less nodes" test runs first. | Reproduced alone with seeds 20261109 and 3; passes in file order and with seeds 1 and 2. | fix in the test, leave |
| F-10 | DOM left behind between tests: `app/react/portainer/access-control/AccessManagement/AccessDatatable/RemoveAccessButton.test.tsx` (two "disabled state" tests). Under shuffle a confirm dialog from an earlier test is still in the document ("Found multiple elements with the role button and name /remove/i"). | Client run 3. | fix in the test, leave |
| F-11 | `app/react/components/datatables/Datatable.test.tsx` "renders the table with correct data" fails under shuffle ("Unable to find … Jane Smith"). Cause not analysed; suspected state from another test in the same file. | Client run 3. | fix in the test, leave |
| F-12 | Shared mutable mock state: the global MSW handler `POST /api/tags` in `app/setup-tests/server-handlers.ts` pushes into a module-level `tags` array that `server.resetHandlers()` does not reset. Tests also set `window.ddExtension` (`SettingsSidebar.test.tsx`) and redefine `window.location` (`KubectlShellView.test.tsx`). Per-file isolation limits all of these to one file. | Not seen failing. | fix in test setup, leave |
| F-13 | Shuffle and stop settings: `vitest.config.mts` has `bail: 2`, which ends a run after two failures and hid three of the four order-dependent failures in client run 2. Neither suite runs in a random order by default (Go has no `-shuffle`, Vitest has no `sequence.shuffle`). | Client run 2 against run 3. | change test config, leave |
| F-14 | Artifacts left in the repo: `make test-server` writes `coverage.out` and `make test-client` writes `coverage/` in the repo root; neither is in `.gitignore`. | `git check-ignore` matches neither. | add to `.gitignore`, leave |
| F-15 | Unhandled error noise in a passing run: client run 1 prints `Error: Uncaught [Error: Invalid query param value for tab]` from jsdom, and the run still passes because `vitest-fail-on-console` does not see jsdom-reported errors. The emitting test was not identified. | Client run 1 log. | fix in the test, leave |

Environment notes. These are not isolation findings, but the user may want to decide them too:

- The tree pins Node `^22.22.1` and Go `1.26.10`; these runs used Node 24.22.1 and Go 1.27.3.
- `pnpm-lock.yaml` cannot be installed frozen here.
- `.golangci-version` is missing, so `make lint-server` cannot check the linter version.

## 4. Open for later phases

- A1: generated sources (for example `openapi-ts` output, `tsconfig.generated.json`, swag docs) and how each coverage tool can exclude them.
- A2: label `fuzz` (F-06), `performance` (F-05, possibly F-04), and integration/Docker/network tests (F-02, F-03), and define the reference test set and its single coverage command.
- B: test spec against `docs/portainer-spec.md`.
