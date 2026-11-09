# BESPOKE.md

This project is a tailored version of an upstream open-source project, built with the [Bespoke assembly line](https://github.com/pihme/bespoke/blob/main/ASSEMBLY-LINE.md). Each stage has its own branch (`1-raw` … `6-bespoke`) and one chapter here. Decisions are recorded here first; a stage that outgrows its chapter moves the details to `bespoke/<n>-<stage>.md` and links it. Every commit on a stage branch references a decision or intervention ID from this file. The readable summary is [BESPOKE-summary.md](BESPOKE-summary.md); every stage updates both.

## Source

- Upstream repo: <url>
- Following: <branch or tag>
- Upstream commit: <sha>

## Vision / North Star

<What this tailored version is for: who uses it, for what, and what "done" looks like. Every stage decision is checked against this.>

## Constraints / Do not touch

- <Things no stage may change or remove: behaviour, interfaces, formats, files, licenses, platforms.>

## Spec

- Feature spec: <path, e.g. docs/<project>-spec.md>; testspec: <path>
- Upstream spec: <none / path> – <usable as is / usable with changes / not usable, and why>

## 1 raw

- Upstream commit: <sha>
- Built from: upstream
- Skill: fork
- Gate: <command(s) that must pass at the end of this stage>
- Details: none (or bespoke/1-raw.md)

### Inventory

- Languages and build system:
- Build:
- Tests and result:
- License:
- Direct dependencies:
- Shipped artifacts and size:

### Decisions

| ID | Decision | Reason | Decided by | Replay hint |
|----|----------|--------|------------|-------------|
| RAW-001 | Fork portainer/portainer as public pihme/bespoke-portainer-ce at tag 2.45.3 (commit 0fa764dc81c76bb7914d65d8e62b026d7c746899), and start the raw stage on `1-raw` at that commit. | The user asked for that repo name and that release tag rather than the moving `release/2.45` branch. | user | `gh repo fork portainer/portainer --fork-name bespoke-portainer-ce`, then create `1-raw` at `0fa764dc81c76bb7914d65d8e62b026d7c746899`. Do not use `--default-branch-only`; the default branch was not this tag. |
| RAW-002 | Remove `CLAUDE.md`. | The user asked to drop the upstream agent instruction file. It also pointed at `docs/guidelines/*`, which are not in this tree. | user | Do not restore `CLAUDE.md`. |
| RAW-003 | Remove `CONTRIBUTING.md`. | The user asked to drop the upstream contribution process, which pointed people at portainer/portainer issues. | user | Do not restore `CONTRIBUTING.md`. |
| RAW-004 | Remove `SECURITY.md` and `CODE_OF_CONDUCT.md`. | The user asked to drop them. They pointed reports at security@portainer.io and contribute@portainer.io. | user | Do not restore these files. |
| RAW-005 | Remove `.github/ISSUE_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`, `.github/DISCUSSION_TEMPLATE/`, and `.github/PULL_REQUEST_TEMPLATE.md`. | The user asked to drop the issue, pull-request, and discussion templates. They routed people to upstream discussions and advertised Portainer Business Edition. | user | Do not restore these paths. |
| RAW-006 | Strip upstream contacts and Portainer Business Edition advertising from `README.md`. Keep the Community Edition description, intended-use text that is not a BE upsell, Getting started documentation links, and the licensing section. | The user asked to strip contacts and BE advertising from the README. | user | Do not put back Take3/BE links, contribute@portainer.io, the careers pitch, or links to portainer/portainer issues and releases. |
| RAW-007 | Remove the `.husky` pre-commit hook. | The user asked to drop the hook that forced `pnpm lint-staged` on every commit. | user | Do not restore `.husky`. Leave `lint-staged.config.js` and the husky devDependency; they are unused hook wiring, not this drop. |

### Interventions

Work the user asked for that is not this stage's goal. Same ID series; does not count toward the exit.

| ID | Intervention | Reason | Decided by | Replay hint |
|----|--------------|--------|------------|-------------|

### Last run

- Date, result (passed / failed at decision ID), notes
- Date, exit: <how the stage goal was verified>; gate passed in CI; user confirmed

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
