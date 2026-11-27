# Tooling

## Commands

- `pnpm install`: install dependencies.
- `./scripts/validate.sh`: everything CI runs (format check, lint, type check, tests and build, through Nx), so CI, people and the Stop hook run the same thing. Extra arguments go to `nx run-many` (e.g. `--skip-nx-cache`).
- `pnpm format`: format the repository with oxfmt.
- `pnpm exec nx run <project>:<target>`: run one target of one project.
- Test count and names: `NX_WORKSPACE_ROOT_PATH=$PWD pnpm --filter @flashcards/web exec vitest run --reporter=json --outputFile=<file>`, then `jq .numTotalTests <file>` and `jq -r '[.testResults[].assertionResults[].title] | sort[]' <file>` (it sorts inside jq: the worktree guard refuses a shell pipe).
- Moved-line count: `git -c color.diff.oldMoved=blue -c color.diff.newMoved=blue -c color.diff.oldMovedAlternative=blue -c color.diff.newMovedAlternative=blue diff origin/main... --color-moved=plain --color-moved-ws=allow-indentation-change --color=always --output=<file>`, then `grep -c $'^\e\\[34m[-+]' <file>`. Run them as two commands: the worktree guard refuses the pipe.

## The Stop hook

At the end of every agent turn, the Stop hook runs `validate` from `.agents/factory.json`. It prints nothing when it passes; when it fails, the agent gets the output and the turn goes on. If the agent's try ends with the same failure, the turn ends anyway and you see the failure: some can't be fixed from the agent's machine.

## The Factory

`/factory <issue>` runs one issue through the Factory, installed by `factory-setup`. Its settings are in `.agents/factory.json`; `factory.schema.json`, next to the Factory's skill, explains each key. Don't edit the Factory's installed files: an update replaces them. Propose changes to it as an issue in the repository it was installed from. An agent may start it too, to run several issues in a row.

## Gotchas

<!-- Tool behaviour that surprised an agent or a person, one line each, with what to do instead. -->

- No corepack here: pnpm is pinned by `packageManager` in `package.json`; install that version yourself.
- pnpm blocks dependency build scripts: allow one in `allowBuilds` in `pnpm-workspace.yaml`.
- `oxlint` exits 1 when it finds no files, so `lint` passes `--no-error-on-unmatched-pattern`; it passes `--deny-warnings` because warnings (like `debugger`) otherwise exit 0.
- `nx run-many` exits 0 when no project has a target, so a lost target passes `validate` silently. The root is a project (with `format:check` and `lint`) only because of `"nx": {}` in `package.json`; keep it.
- A new project under `libs/` or `apps/` needs `pnpm exec nx sync` (adds its reference to `tsconfig.json`), or `validate` fails as "out of sync".
- Nx generators leave placeholders (`@org/...` names, an MIT `license`, an empty `dependencies`, a sample source and spec) and extras nothing uses (`@nx/js:lib` adds `@swc/helpers`, coverage and `vite`): drop them before committing. The implementer's hook can't delete the sample spec; the test writer does.
- `pnpm screenshot <flow> <folder> [width]` builds the web app, runs a Playwright flow in headless Chromium at `width` pixels (default 1280) and writes `<folder>/<flow>-<shot>.png`. The first run downloads Chromium; `validate` and CI don't run it. The folder is required (until #63), so write it in plans and test plans too: `pnpm screenshot search <folder> 375`. Give each phase and each width its own folder; a second width in the same folder overwrites the first. Run flows one at a time: each run builds `apps/web/dist` and starts its own preview, so parallel runs fail.
- `validate` checks formatting but doesn't fix it: after editing files by hand, run `pnpm format` first.
- `pnpm exec` installs missing or outdated dependencies itself (`verifyDepsBeforeRun` defaults to `install`); to make it fail instead, pass `--config.verify-deps-before-run=error`.
- In a worktree under `.claude/worktrees/`, the guard refuses a shell command it can't prove stays in the worktree: a loop, `$(…)` or heredoc whose text mentions `git` anywhere (a `github.com` URL counts), and heredoc appends or multi-line `sed` that write files. A plain command, or a short `&&` chain, still runs. Run git as plain separate commands, put scripts in files, and edit files with Edit/Write.
- An inherited `NX_WORKSPACE_ROOT_PATH` points Nx at another checkout: `validate.sh` resets it, but a direct `pnpm exec nx …` in a worktree needs `NX_WORKSPACE_ROOT_PATH=$PWD` in front.
- The Nx cache is shared by all worktrees: a cache hit replays the output of the run that filled it, paths from another worktree included. That is a replay, not a wrong run; `./scripts/validate.sh --skip-nx-cache` runs it again here.
- One test file: `NX_WORKSPACE_ROOT_PATH=$PWD pnpm --filter @flashcards/web exec vitest run src/<file>` (paths relative to the project; `@flashcards/cards` for `libs/cards`).
- Type-check the web app alone: `pnpm --filter @flashcards/web exec tsc --build --force --emitDeclarationOnly`. It also builds `libs/cards`, so it works in a new worktree and sees library changes; `tsc --noEmit` needs a current `libs/cards/dist`.
- The shell is zsh: quote globs in arguments, as in `grep -rn foo --include='*.tsx'`, or zsh fails with "no matches found".
- To see what a schema in `libs/cards` does, run a one-line script in that project (Node strips the types): `pnpm --filter @flashcards/cards exec node --input-type=module -e 'const { ZCard } = await import("./src/lib/schema.ts"); console.log(ZCard.safeParse({}).error.issues)'`. It runs from the root as one plain command, so the worktree guard lets it run; a `cd` first doesn't carry over in an agent thread.
