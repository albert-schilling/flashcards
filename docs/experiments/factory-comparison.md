# Experiment: Factory against simpler setups

Status: decided, ready to run.

## Question

Does the Factory's result justify its time and tokens, compared with simpler ways of using the same agent? We run one issue through four setups, each up to an open pull request, and compare cost, time, the person's effort and the quality of the result.

## Setups

| #   | Setup                     | Models                                                                                                       | Phases                                              | Sub-agents |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ---------- |
| 1   | Factory as is             | Orchestrator Opus; planner, test writer and reviewers Opus; researcher and implementer Sonnet (as installed) | All                                                 | Yes        |
| 2   | Factory, no Opus          | Orchestrator and every phase agent Sonnet; efforts unchanged                                                 | All                                                 | Yes        |
| 3   | One agent, Factory phases | Opus                                                                                                         | All, done by the one agent in order                 | No         |
| 4   | One agent, plain          | Opus                                                                                                         | None: "Implement issue #N and open a pull request." | No         |

Setup 1 already mixes models: only the researcher and the implementer run on Sonnet. Setup 2 changes the `model:` line of the other five agents in `.claude/agents/` to `sonnet`, in its own worktree only, never committed, and starts the session with `/model sonnet`.

All four keep the repository as it is: `CLAUDE.md`, the conventions, `./scripts/validate.sh` and the Stop hook that runs it. These are part of the repository, not of the Factory.

## Ticket

Issue #58, the Card editor for qa, cloze and true_false Cards. It is UI and logic, follows the prototype, and has no open product questions.

## Fairness

- **Same start.** Every setup starts from the same base commit, recorded in the results. Nothing the experiment adds to `main` (this file, the script) is in that base, so the setups can't read about the experiment.
- **Own issue per setup.** The Factory keeps its state in issue comments, so four runs on one issue would collide. #58 is copied four times, with the same title and body, each labelled ready. Each setup gets its own copy. #58 stays untouched and is closed by the pull request that is merged.
- **Own session and worktree per setup.** Each setup runs in a fresh Claude Code session that the person starts in its own worktree, made from the base commit. No session from before the experiment is reused.
- **Same answers.** Setups 1 to 3 stop to ask the person. The person answers each question as they would in real work, and gives the same answer to the same question in every setup. Answers go into an answer sheet outside the worktrees as they come, so later setups reuse them. If a setup proposes a split, the answer is "one pull request". Setup 4 asks nothing; that is part of what we compare.
- **Same end.** A setup is done when its pull request is open, CI passes, and its body says what it did. No retro: only the Factory has one, and it changes the harness, not the result. Harness commits are left out of the quality review.
- **One at a time.** The setups run one after another, so rate limits and machine load don't distort time. The Mac stays awake (`caffeinate -dims`) during a run.
- **Order.** 4, 3, 2, 1. The setups with the fewest questions come first, so the structured setups don't profit from a person who has already thought the issue through.

## Running a setup

1. In a terminal: `caffeinate -dims` (leave it running).
2. In a second terminal: `cd .claude/worktrees/experiment-58-setup-<n>` and `claude`.
3. Setup 2 only: `/model sonnet`.
4. Send the setup's prompt (below), with its issue copy's number.
5. Answer questions as described under Fairness, and note in the answer sheet the minutes spent and any time you stepped in unasked.
6. When the pull request is open and CI passes, note the session id (`/status`) and end the session.

## Prompts

N is the setup's issue copy.

- Setup 1 and 2, in one message: `/factory N` followed by "This run's worktree already exists: the current directory, on its own branch. Reuse it; don't create another."
- Setup 3: "Implement issue #N yourself, following the Factory's phases in `.claude/skills/factory/SKILL.md` in order: research, Alignment Document, stop for my review, tests first, implementation, second test pass, spec review, standards review, verify, pull request. Don't start any agents. Keep the issue comments the skill describes. Work in the current worktree. Skip the retro."
- Setup 4: "Implement issue #N and open a pull request."

## What we measure

### Efficiency

| Metric                                                               | Source                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Wall-clock time, first prompt to PR ready                            | Transcript timestamps                                                           |
| Agent time: wall clock minus time waiting for the person             | Transcript: from a question to its answer, and from a reply to the next message |
| Tokens by kind (input, cache write, cache read, output) and by model | `usage` in the session transcript and its `subagents/` transcripts              |
| Cost in USD, at API prices                                           | Tokens times the price per model and kind                                       |
| API responses and tool calls                                         | Transcript                                                                      |

`node scripts/session-usage.mjs <session.jsonl>` reports all of these. Claude Code stores each session as `~/.claude/projects/<project>/<session-id>.jsonl` and its sub-agents under `<session-id>/subagents/`. The script counts the sub-agents, dedupes responses logged once per content block, and prices them from a table in the script. Check that table against Anthropic's pricing page before the run.

### The person's effort

| Metric                                               | Source                |
| ---------------------------------------------------- | --------------------- |
| Questions asked, and Stops                           | Transcript            |
| Minutes spent answering and reviewing during the run | The person notes them |
| Corrections: times the person had to step in unasked | The person notes them |

### Quality

**Objective checks**, per pull request:

- CI and `./scripts/validate.sh` pass.
- Each acceptance criterion is met, checked by hand in the running app at 375 and 1280 px: yes, partly or no.
- Changed lines, code and tests apart (`git diff --shortstat <base>...`, harness commits left out).
- New tests: how many, and whether each one fails without the change. Revert the code commits and run the tests.
- Screenshots in the PR: present and true to the prototype.

**Blind review.** For each setup, export the diff from the base, without harness commits, and the PR body, with names, branch names and phase markers removed. Label them A to D at random and keep the key apart.

Three fresh Opus sessions review each one, with the rubric below and no other context than the repository at the base commit. Each scores 1 to 5 per criterion and lists findings, marked "must fix before merge" or "could be better". The person doesn't review.

| Criterion          | 5 means                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Correctness        | Meets every acceptance criterion; no bugs found                                                      |
| Design             | Deep modules, clear seams, no needless layers or duplication                                         |
| Readability        | Names and comments a newcomer follows; small functions with one job                                  |
| Tests              | Test behaviour through the right seam; would catch a regression; no mock-only or snapshot-only tests |
| Conventions        | Follows `docs/conventions/`, the glossary and the design tokens                                      |
| Prototype fidelity | Matches `docs/design/` at 375 and 1280 px                                                            |
| Scope              | Does what the issue asks, no more                                                                    |

**Rework.** For the best-scored pull request: the minutes and changed lines needed to fix its "must fix" findings.

## Comparing

One table, one column per setup: cost, agent time, wall-clock time, the person's minutes, questions, mean score per criterion, must-fix findings, acceptance criteria met, rework. The results go in `docs/experiments/factory-comparison-results.md`.

The decision question: is the Factory's gain in quality and in the person's trust worth its extra cost and time, and does a cheaper setup get close enough?

Then merge one pull request (the best, if it is mergeable) and close the others. Delete their branches, worktrees and the issue copies.

## Limits

- One ticket, one run per setup. Agent runs vary from run to run, so small differences mean little. If the results are close, run a second ticket before deciding.
- The person learns the issue during the first runs. The order and the answer sheet reduce this but can't remove it.
- All reviewers are Opus and may favour code written by Opus. The objective checks are the counterweight.
- Setup 3 reads the Factory skill and may still call agents if it misreads it; the transcript shows whether it did.
- Cost is at API prices. On a subscription the money spent differs, but the comparison between setups holds.
