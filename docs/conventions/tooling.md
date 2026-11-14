# Tooling

## Commands

- `pnpm install`: install dependencies.
- `./scripts/validate.sh`: everything CI runs (format check, lint, type check, tests, through Nx), so CI, people and the Stop hook run the same thing.
- `pnpm format`: format the repository with oxfmt.
- `pnpm exec nx run <project>:<target>`: run one target of one project.

## The Stop hook

At the end of every agent turn, the Stop hook runs `validate` from `.agents/factory.json`. It prints nothing when it passes; when it fails, the agent gets the output and the turn goes on. If the agent's try ends with the same failure, the turn ends anyway and you see the failure: some can't be fixed from the agent's machine.

## The Factory

`/factory <issue>` runs one issue through the Factory, installed by `factory-setup`. Its settings are in `.agents/factory.json`; `factory.schema.json`, next to the Factory's skill, explains each key. Don't edit the Factory's installed files: an update replaces them. Propose changes to it as an issue in the repository it was installed from.

## Gotchas

<!-- Tool behaviour that surprised an agent or a person, one line each, with what to do instead. -->

- No corepack here: pnpm is pinned by `packageManager` in `package.json`; install that version yourself.
- pnpm blocks dependency build scripts: allow one in `allowBuilds` in `pnpm-workspace.yaml`.
- `oxlint` exits 1 when it finds no files, so `lint` passes `--no-error-on-unmatched-pattern`; it passes `--deny-warnings` because warnings (like `debugger`) otherwise exit 0.
- `nx run-many` exits 0 when no project has a target, so a lost target passes `validate` silently. The root is a project (with `format:check` and `lint`) only because of `"nx": {}` in `package.json`; keep it.
- A new project under `libs/` or `apps/` needs `pnpm exec nx sync` (adds its reference to `tsconfig.json`), or `validate` fails as "out of sync".
- `pnpm exec` installs missing or outdated dependencies itself (`verifyDepsBeforeRun` defaults to `install`); to make it fail instead, pass `--config.verify-deps-before-run=error`.
