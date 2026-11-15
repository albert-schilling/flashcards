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
