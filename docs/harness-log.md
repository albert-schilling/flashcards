# Harness log

Entries for each pull request, added in that pull request: what the coding agent got wrong or needed to be told, and what changed in the harness so it won't happen again.

## Entries

| PR  | What went wrong                                                                                                                    | Harness change                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| #11 | The `factory` skill can't be started by an agent, so an agent couldn't orchestrate several issues.                                 | Local `factory-dark` copy; removed once albert-schilling/skills#33 let agents start `factory`.   |
| #11 | The implementer amended the branch's base commit, adding a stray generator README.                                                 | Orchestrator rebased; albert-schilling/skills#25 adds a base-commit check.                       |
| #11 | Generator placeholders (`@org/source`, MIT license) got committed.                                                                 | Gotcha in `tooling.md`.                                                                          |
| #11 | The plan assumed `pnpm exec` fails without an install; it installs.                                                                | Gotcha in `tooling.md`.                                                                          |
| #11 | Both test passes saw "every change comes with tests" as broken by a tooling-only change.                                           | `pull-requests.md` allows red/green validate runs as proof.                                      |
| #13 | The implementer's hook blocked deleting the generator's placeholder spec.                                                          | Gotcha in `tooling.md`; albert-schilling/skills#28.                                              |
| #13 | Generator extras nothing uses (`@swc/helpers`, coverage, `vite`) got committed; review removed them.                               | Gotcha in `tooling.md`.                                                                          |
| #15 | `gh` can't attach screenshots to a PR.                                                                                             | `pull-requests.md`: push them to `pr-assets` and link.                                           |
| #15 | Headless Firefox wrote no screenshot without a profile.                                                                            | Gotcha in `tooling.md`.                                                                          |
| #15 | Test files were named `.spec` in one project and `.test` in another.                                                               | Naming rule in `code.md`; #14 renames.                                                           |
| #15 | `validate.sh` dropped arguments, so reviewers couldn't skip the Nx cache through it.                                               | `validate.sh` passes arguments to Nx.                                                            |
| #18 | A test helper typed as the whole Card union failed typecheck; Card types had no own names.                                         | One exported schema per Card type; `Z`/`T` naming rule in `code.md`.                             |
| #18 | The implementer's test-file hook blocked edits to non-test files.                                                                  | albert-schilling/skills#31.                                                                      |
| #18 | The plan estimated ~260 lines; the PR came out at 592, found only at review.                                                       | #19: warn on oversized diffs.                                                                    |
| #20 | Headless Firefox can't pick files, so the PR had no screenshot of the filled Card list.                                            | #21: Playwright screenshots of interactive states.                                               |
| #24 | The plan named `session.ts` and `Session.tsx`, which collide on a case-insensitive file system.                                    | File naming rule in `code.md` (purpose suffixes); #23 renames older files.                       |
| #24 | The database moved to version 2, which a revert can't undo; nothing said to flag it.                                               | `pull-requests.md`: a raised IndexedDB version is a one-way door.                                |
| #24 | The plan estimated ~310 lines; the PR came out at 550, mostly tests.                                                               | #19 (size warning).                                                                              |
| #29 | The issue named `git diff -M` to prove a move; it doesn't show code moved between files that stay.                                 | `pull-requests.md`: moves are shown with `--color-moved`.                                        |
| #34 | Research missed seven existing tests the repeat changed, so the first plan for #8 was far too small.                               | albert-schilling/skills#32: research lists tests the issue changes.                              |
| #37 | A test from #5 was flaky in CI; reviews of #18 hadn't caught that overlapping uploads race.                                        | Deterministic race test and fix; #36 for the upload/delete race.                                 |
| #40 | Agents re-ran checks to read failures, because `validate.sh` printed only Nx's summary.                                            | `validate.sh` uses `--output-style=static`.                                                      |
| #43 | An inherited `NX_WORKSPACE_ROOT_PATH` made `validate` in a worktree check the main checkout's code.                                | `validate.sh` sets it to its own checkout; gotcha in `tooling.md`.                               |
| #43 | The approved plan said ~405 lines; the PR came out at 512, with extra tests and screenshots.                                       | #19 (size warning).                                                                              |
| #61 | The implementer had no prototype CSS (no Figma MCP), guessed styles from screenshots: 8 spec findings.                             | `docs/design/prototype/` holds the prototype's CSS and code; the v2 issues point at it.          |
| #61 | Planned ~645 lines, came out at 980: CSS written rule for rule from the prototype was underestimated.                              | #19 (size warning); plan CSS by counting the prototype's rules.                                  |
| #64 | The Stop hook blocked the orchestrator's turns while the implementer worked in the background (tests first, so validate failed).   | albert-schilling/skills#35.                                                                      |
| #64 | Copying the header CSS rule for rule also copied a prototype bug: open menu, then widen, stacked the nav.                          | `docs/design/README.md`: check states the prototype doesn't show.                                |
| #64 | Planned ~440 lines, came out at 1,020: the first tests took ~410 (planned ~150), the implementation ~560 (planned ~290).           | #19 (size warning).                                                                              |
| #66 | The plan adapted two tests that expected Start Session with no Cards but missed a third, so the implementer stopped.               | albert-schilling/skills#36 (the planner lists every test that queries a removed element).        |
| #66 | The tokens-only style test rejected the prototype's `repeat(2, 1fr)`, another Stop.                                                | `docs/conventions/code.md` lists the raw values styles may use.                                  |
| #73 | Tests came out at ~280 lines against ~110 planned: every close path checked through the app, with a reload and in German.          | #19 (size warning).                                                                              |
| #73 | A hand edit failed `validate` on formatting, costing a round.                                                                      | `tooling.md`: run `pnpm format` before `validate`.                                               |
| #75 | The plan made a test helper return Home but missed a test that queried Delete all right after it, so the implementer stopped.      | albert-schilling/skills#36 (comment: trace a changed helper's callers).                          |
| #75 | Planned ~445 lines, came out at 662: second-pass tests and the helpers' navigation.                                                | #19 (size warning).                                                                              |
| #75 | The orchestrator pointed the researcher at an issue comment, which the researcher's rules forbid; it answered from the code.       | None: the Factory already says research gets the questions alone.                                |
| #80 | The implementer put a `@media` rule above the base rule with the same selector, so the base rule won and the desktop gap was lost. | `styles.test.ts` checks that a media rule comes after its base rule; `docs/conventions/code.md`. |
| #80 | The test writer added Files panel tests that only checked mock calls, which App tests already covered through real uploads.        | `docs/conventions/pull-requests.md`: test the effect, not the mock call.                         |
| #82 | Planned ~270 lines, came out at 483: tests 326 against 130 planned.                                                                | #19 (size warning).                                                                              |
| #82 | The implementer took a screenshot without waiting for the filtered list; the spec review caught it.                                | None: every other shot in the script waits for its text.                                         |
| #84 | The implementer added `flushSync` to app code only because a test blurred outside `act()`, instead of stopping to report the test. | albert-schilling/skills#37 (stop instead of bending code to a test).                             |
| #84 | Planned ~290 lines, came out at 372; tests ran over for the third run in a row (planned 90, written 157).                          | albert-schilling/skills#38 (estimate tests per test).                                            |
| #87 | Planned ~410 lines, came out at 784: tests 461 against 165 planned, the fourth overrun in a row.                                   | albert-schilling/skills#38 (estimate tests per test).                                            |
| #95 | Planned ~793 lines, came out at 988: tests 368 against 234, even with a per-test estimate.                                         | albert-schilling/skills#38 (comment with this data).                                             |
| #95 | The implementer added a second `.type-label` rule identical to an existing one; the standards review caught it.                    | #96 (check style sheets for duplicate rules).                                                    |

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
| #30 | #7    | medium    | 2 / 3             | 1             | 0              | none                |
| #31 | #28   | medium    | 1 / 1             | 2             | 0              | none                |
| #33 | #8    | medium    | 2 / 4             | 2             | 0              | none                |
| #34 | #32   | medium    | 1 / 2             | 2             | 0              | none                |
| #37 | #35   | medium    | 2 / 2             | 1             | 0              | none                |
| #40 | #9    | medium    | 2 / 6             | 2             | 0              | none                |
| #42 | #10   | medium    | 2 / 2             | 2             | 0              | none                |
| #43 | #41   | medium    | 2 / 3             | 2             | 0              | none                |
| #61 | #47   | medium    | 2 / 5             | 2             | 5              | none                |
| #64 | #48   | medium    | 3 / 5             | 3             | 2              | none                |
| #66 | #49   | medium    | 3 / 4             | 2             | 2              | none                |
| #73 | #69   | medium    | 2 / 5             | 2             | 2              | none                |
| #75 | #70   | medium    | 3 / 5             | 2             | 2              | none                |
| #80 | #71   | medium    | 1 / 1             | 2             | 2              | none                |
| #82 | #51   | medium    | 1 / 2             | 2             | 2              | none                |
| #84 | #52   | medium    | 2 / 3             | 2             | 2              | none                |
| #87 | #53   | medium    | 2 / 6             | 2             | 5              | none                |
| #89 | #54   | medium    | 1 / 3             | 1             | 3              | none                |
| #90 | #55   | medium    | 1 / 2             | 2             | 2              | none                |
| #95 | #56   | medium    | 3 / 8             | 3             | 5              | none                |
