# Harness log

Entries for each pull request, added in that pull request: what the coding agent got wrong or needed to be told, and what changed in the harness so it won't happen again.

## Entries

| PR  | What went wrong                                                                                      | Harness change                                                             |
| --- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| #11 | The `factory` skill can't be started by an agent, so an agent couldn't orchestrate several issues.   | Local `factory-dark` copy; albert-schilling/skills#24.                     |
| #11 | The implementer amended the branch's base commit, adding a stray generator README.                   | Orchestrator rebased; albert-schilling/skills#25 adds a base-commit check. |
| #11 | Generator placeholders (`@org/source`, MIT license) got committed.                                   | Gotcha in `tooling.md`.                                                    |
| #11 | The plan assumed `pnpm exec` fails without an install; it installs.                                  | Gotcha in `tooling.md`.                                                    |
| #11 | Both test passes saw "every change comes with tests" as broken by a tooling-only change.             | `pull-requests.md` allows red/green validate runs as proof.                |
| #13 | The implementer's hook blocked deleting the generator's placeholder spec.                            | Gotcha in `tooling.md`; albert-schilling/skills#28.                        |
| #13 | Generator extras nothing uses (`@swc/helpers`, coverage, `vite`) got committed; review removed them. | Gotcha in `tooling.md`.                                                    |
| #15 | `gh` can't attach screenshots to a PR.                                                               | `pull-requests.md`: push them to `pr-assets` and link.                     |
| #15 | Headless Firefox wrote no screenshot without a profile.                                              | Gotcha in `tooling.md`.                                                    |
| #15 | Test files were named `.spec` in one project and `.test` in another.                                 | Naming rule in `code.md`; #14 renames.                                     |
| #15 | `validate.sh` dropped arguments, so reviewers couldn't skip the Nx cache through it.                 | `validate.sh` passes arguments to Nx.                                      |
| #18 | A test helper typed as the whole Card union failed typecheck; Card types had no own names.           | One exported schema per Card type; `Z`/`T` naming rule in `code.md`.       |
| #18 | The implementer's test-file hook blocked edits to non-test files.                                    | albert-schilling/skills#31.                                                |
| #18 | The plan estimated ~260 lines; the PR came out at 592, found only at review.                         | #19: warn on oversized diffs.                                              |
| #20 | Headless Firefox can't pick files, so the PR had no screenshot of the filled Card list.              | #21: Playwright screenshots of interactive states.                         |
| #24 | The plan named `session.ts` and `Session.tsx`, which collide on a case-insensitive file system.      | File naming rule in `code.md` (purpose suffixes); #23 renames older files. |
| #24 | The database moved to version 2, which a revert can't undo; nothing said to flag it.                 | `pull-requests.md`: a raised IndexedDB version is a one-way door.          |
| #24 | The plan estimated ~310 lines; the PR came out at 550, mostly tests.                                 | #19 (size warning).                                                        |
| #29 | The issue named `git diff -M` to prove a move; it doesn't show code moved between files that stay.   | `pull-requests.md`: moves are shown with `--color-moved`.                  |

## Factory runs

One row for each pull request the Factory opens, added in its retro and updated when something happens later. These numbers decide when a person can stop reading the code of High Risk Tier pull requests.

- **Risk tier**: low, medium or high, as the Alignment Document ended up.
- **Stops / questions**: how often a phase stopped, and how many questions the person answered.
- **Review rounds**: rounds of the spec and standards reviewers before they had no findings left.
- **Review minutes**: the person's active minutes on the Alignment Document and, for High, the code; an estimate.
- **Reverts / incidents**: anything reverted or broken after the merge, each with a root-cause entry in the table above that ends in a harness change.

| PR  | Issue | Risk tier | Stops / questions | Review rounds | Review minutes | Reverts / incidents |
| --- | ----- | --------- | ----------------- | ------------- | -------------- | ------------------- |
| #11 | #2    | high      | 1 / 2             | 3             | 0              | none                |
| #13 | #3    | medium    | 3 / 2             | 2             | 0              | none                |
| #15 | #4    | high      | 1 / 2             | 2             | 0              | none                |
| #18 | #5    | medium    | 4 / 6             | 3             | 0              | none                |
| #20 | #17   | medium    | 1 / 1             | 2             | 0              | none                |
| #24 | #6    | medium    | 4 / 6             | 3             | 0              | none                |
| #25 | #21   | medium    | 1 / 1             | 2             | 0              | none                |
| #26 | #22   | medium    | 1 / 2             | 2             | 0              | none                |
| #29 | #27   | medium    | 1 / 2             | 1             | 0              | none                |
