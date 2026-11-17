#!/usr/bin/env sh
# Everything CI runs, so CI, people and the Factory's Stop hook check the same thing.
set -eu
cd "$(dirname "$0")/.."

# Static output prints a failing task's log inline instead of only a path to it.
pnpm exec nx run-many -t format:check lint typecheck test build --output-style=static "$@"
