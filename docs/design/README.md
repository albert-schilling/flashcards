# Design

The app's design for version 2 comes from a Figma Make prototype, made from [`figma-make-prompt.md`](figma-make-prompt.md).

- Prototype: https://www.figma.com/make/M937bfJqJzKR5OLBFnWyuC/Flashcards
- [`tokens.css`](tokens.css): its design tokens (colors, type, spacing, radii, shadows, sizes), copied as they are.
- [`screens/`](screens/): screenshots of each page at 375 px and 1280 px wide.
- [`prototype/`](prototype/): a copy of its code from 2026-11-19, for agents without the Figma MCP server: `index.css` (tokens and every component style) and `App.tsx.txt` (all screens; `.txt` so the repository's tools skip it). When the prototype changes, the Figma MCP server has the current version.

## Reading the prototype

The prototype is the source of truth; the screenshots only show it. To read its code, use the Figma MCP server (`claude mcp add --transport http figma https://mcp.figma.com/mcp`, then sign in with `/mcp`):

1. `get_design_context` with file key `M937bfJqJzKR5OLBFnWyuC` and node `0:1` lists its source files.
2. Read `src/App.tsx` (all screens and components) and `src/index.css` (tokens and component styles) as MCP resources.

The Figma tools can't take screenshots of Make files. To see a state the screenshots miss, build the code locally and screenshot it with Playwright.

The prototype is a reference, not code to copy: it keeps everything in one file and fakes its data. Build its look and behaviour into the app's own components, keep the app's tests passing, and keep semantic elements (`button`, `select`, `label`, `table`).

Take styles rule for rule, then check the states the prototype never shows, where its CSS can be wrong: resizing with a menu open, hover on the current or disabled item, long German texts.
