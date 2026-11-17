#!/usr/bin/env sh
# Everything CI runs, so CI, people and the Factory's Stop hook check the same thing.
set -eu
cd "$(dirname "$0")/.."
# Nx honours an inherited NX_WORKSPACE_ROOT_PATH; in a worktree it may point at another checkout.
export NX_WORKSPACE_ROOT_PATH="$PWD"

# Static output prints a failing task's log inline instead of only a path to it.
pnpm exec nx run-many -t format:check lint typecheck test build --output-style=static "$@"
