#!/usr/bin/env sh
# Everything CI runs, in one command, so CI, people and the Factory's Stop hook check the same
# thing: formatting, lint, type check and tests, through Nx.
set -eu
cd "$(dirname "$0")/.."

pnpm exec nx run-many -t format:check lint typecheck test
