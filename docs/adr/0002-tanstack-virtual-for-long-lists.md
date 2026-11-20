# TanStack Virtual for long lists

The Cards page renders only the rows in view, with TanStack Virtual (`@tanstack/react-virtual`). A Deck can hold hundreds of Cards, and a row for each makes scrolling and every filter keystroke slow. The library is headless: it gives the visible range and offsets, and the app keeps its own markup, styles and Delete buttons.

## Considered options

- **Hand-written windowing**: no dependency, but scroll, overscan, keyed rows and keeping the focused row mounted are easy to get wrong, and we would have to maintain them.
- **react-window**: maintained and small, but it renders the rows itself and makes keeping a focused row mounted harder.
- **react-virtuoso**: more features than we need (grouping, infinite loading), and it is larger.

## Consequences

- One new runtime dependency, MIT licensed, with no install script.
- Only fixed row heights are used, so rows are never measured.
- jsdom lays nothing out, so tests give the list's scroll box a height in `test-setup.ts`.
