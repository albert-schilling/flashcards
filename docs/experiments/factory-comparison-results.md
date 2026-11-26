# Results: Factory against simpler setups

Plan: [factory-comparison.md](factory-comparison.md). Issue #58 (Card editor), base commit a02ea15, run on 2026-11-24, all without the person.

## Setups as run

| Setup                             | Issue copy | PR   | Note                                                                                                                              |
| --------------------------------- | ---------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1, Factory, Opus                  | #116       | #124 | As planned.                                                                                                                       |
| 2, Factory, Sonnet only           | #117       | #123 | As planned.                                                                                                                       |
| 3, one agent, Factory phases      | #118       | #121 | As planned; started no agents.                                                                                                    |
| 4, plain prompt                   | #119       | #120 | Not plain: given "Implement issue #119", Opus started the Factory itself and ran all its phases. Kept as a second Factory sample. |
| 4b, plain prompt, Factory blocked | #122       | #125 | Rerun of 4 with `Skill` and `Agent` denied. Started no agents.                                                                    |

All five finished alone: pull request open, CI passing, no question asked.

## Cost and time

From `scripts/session-usage.mjs`. Cost is at API prices.

| Setup | Wall clock | Cost   | Sub-agents | API responses | Tool calls |
| ----- | ---------- | ------ | ---------- | ------------- | ---------- |
| 1     | 33 min     | $9.35  | 11         | 215           | 252        |
| 2     | 24 min     | $13.56 | 10         | 234           | 215        |
| 3     | 15 min     | $4.88  | 0          | 89            | 92         |
| 4     | 34 min     | $9.47  | 11         | 258           | 302        |
| 4b    | 12 min     | $4.09  | 0          | 86            | 100        |

Setup 2 cost the most because of the Stop hook, not because of the model. Its orchestrator started the phase agents in the background, though the adapter says to start them in the foreground, and ended its turn while it waited. Each turn end ran the Stop hook against the worktree, where the first-pass tests were still red. The hook passed on the whole `validate` output, about 242,000 characters, 17 times. Re-reading that context cost about $10 of the $13.56; without it the run would have cost about $3 to $4. Fix: [skills#47](https://github.com/albert-schilling/skills/issues/47).

### Where the cost of setup 1 goes

From the sub-agents' own transcripts:

| Part                            | Model  | Cost  | Time   |
| ------------------------------- | ------ | ----- | ------ |
| Orchestrator (main session)     | Opus   | $2.46 | ~8 min |
| Review, 3 rounds of 2 reviewers | Opus   | $2.84 | 10 min |
| Tests, first pass               | Opus   | $1.59 | 6 min  |
| Planner                         | Opus   | $0.89 | 5 min  |
| Tests, second pass              | Opus   | $0.65 | 2 min  |
| Implementer                     | Sonnet | $0.58 | 3 min  |
| Researcher                      | Sonnet | $0.34 | 1 min  |

Review rounds 2 and 3 cost $1.43 and about 5 minutes, and produced one structural commit. In setup 4, round 1 fixed behaviour (the gap error on a German cloze text, a red border lost under the pointer) and round 2 changed only tests.

## Objective checks

| Setup | Changed lines (PR) | New tests | Tests failing without the code  |
| ----- | ------------------ | --------- | ------------------------------- |
| 1     | +1585 −24          | 77        | 35, and 1 file that can't load  |
| 2     | +1901 −17          | 108       | 54, and 1 file that can't load  |
| 3     | +1323 −26          | 52        | 21, and 2 files that can't load |
| 4     | +1470 −28          | 81        | 22, and 2 files that can't load |
| 4b    | +1035 −24          | 43        | 15, and 2 files that can't load |

All five pass CI. All five are far above the 300-line limit; the issue was too big for one pull request, whatever the setup. Acceptance criteria were not checked by hand in the running app.

## Blind review

Three fresh Opus sessions each reviewed all five changes as A to E, in different orders, with the plan's rubric and only the base and the changes to read. Mean score over the seven criteria, then the rank each reviewer gave:

| Setup | Mean of the three reviewers | Ranks   | Mean rank | Must-fix found, and confirmed                                                                                                  |
| ----- | --------------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1     | 4.43                        | 1, 2, 1 | 1.3       | None                                                                                                                           |
| 4b    | 4.10                        | 2, 4, 2 | 2.7       | None                                                                                                                           |
| 4     | 4.14                        | 4, 1, 4 | 3.0       | None                                                                                                                           |
| 3     | 4.00                        | 3, 5, 3 | 3.7       | Uses the ID `"new"` to mean "create", so Create Card opens the stored Card with that ID (2 of 3 reviewers; confirmed in code)  |
| 2     | 3.48                        | 5, 3, 5 | 4.3       | Stores the lesson and English texts untrimmed, behind a test named "trims the ID, the Lesson and the Tags" (2 of 3; confirmed) |

One reviewer also counted the size rule as a must-fix for every change; it is left out above, because it applies to all five.

Findings several setups share: a failed save loses what was typed (1, 3, 4, 4b); the Card type can be changed while editing (1, 3, 4b); copying the schema's ID and gap rules by hand instead of using the schema (3, 4b). Setup 3 also raises the version on a save with no change. Setup 2 departs most from the prototype and adds the most the issue didn't ask for.

The reviewers agreed on the top and the bottom, but not in between: setup 4 was ranked first by one reviewer and fourth by the other two.

## What it shows

- **The Factory on Opus wrote the best change**, ranked first by two of three reviewers, with no must-fix. It cost about twice as much as a single agent and took two to three times as long.
- **A plain Opus agent came second**, with no must-fix, for 44% of the cost and 36% of the time of setup 1.
- **The plan made the difference, not the reviews.** Both Factory runs on Opus researched first, and their Alignment Documents named the code to reuse: the schema (`ZCard`) to check input, and `sameContent` to keep the version when nothing changed. The reviewers praised exactly that. The single-agent setups 3 and 4b copied the schema's ID and gap rules by hand, and setup 3 raised the version on an unchanged save. Setup 2's plan didn't name `sameContent`.
- **The Factory on Sonnet only was worst on quality**: lowest score and a confirmed bug. Its high cost came from the Stop hook (above), not from the model.
- **Following the phases without sub-agents didn't help.** Setup 3 cost about as much as the plain agent, scored lower, and had a confirmed bug.
- **Two Factory runs on Opus differed** (setups 1 and 4: ranks 1.3 and 3.0). One run per setup can't separate a setup's effect from run-to-run noise.
- **Left alone, Opus picks the Factory.** The repository's instructions point to it, and a plain prompt was enough to start it.

## Limits

- One issue, one run per setup, as the plan warned. Setups 1 and 4 show that the noise is about as large as the differences.
- No person: the Factory ran without its Stops, which are one of its safeguards.
- Reviewers didn't run the code or see screenshots; correctness and prototype fidelity are judged from code. The two confirmed bugs were checked by reading the code, not by running it.
- All reviewers are Opus.

## Next

- Don't run the Factory with Sonnet in every phase. Keep research on Sonnet and planning on Opus: the plan is where the quality came from, for about $1.20.
- Cut the Stop hook's output to a summary: [skills#47](https://github.com/albert-schilling/skills/issues/47).
- Keep the reviewers fixing and committing, run another round only after a behavioural fix, and let it review only the fix commits: [skills#48](https://github.com/albert-schilling/skills/issues/48). In setup 1 that would save about $1.40 and 5 minutes.
- Smaller tests and smaller issues: the first test pass is the most expensive agent, and all five pull requests were over 1,000 lines. A test budget in the plan: [skills#38](https://github.com/albert-schilling/skills/issues/38).
- Estimate, not measured: with #47 and #48, a run like setup 1 costs about $7 and takes 25 to 28 minutes.
- To decide between the Factory and a plain agent, run a second and third issue with setups 1 and 4b only. Prefer issues small enough for one pull request.
- Done: #124 merged; the other experiment pull requests, issue copies, branches and worktrees are closed or removed.
