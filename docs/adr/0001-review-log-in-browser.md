# Review log in the browser, Statistics computed from it

The app has no backend. Every answer is stored as a Review in an append-only Review log in the browser's IndexedDB, and Statistics and the choice of the next Card are always computed from that log, never stored. A raw log keeps every option open: spaced repetition (FSRS or SM-2) can be added later and replayed over old Reviews without losing data, and the log can be downloaded and uploaded again to move between browsers.

## Considered options

- **Store only aggregated Statistics per Card**: smaller, but loses the data a scheduling algorithm needs and can't be merged across browsers.
- **localStorage**: too small for a growing log and easier for the browser to clear.
- **A server**: accounts and hosting for one Learner aren't worth it yet.

## Consequences

- The browser may clear the data (Safari after about seven days unused). The app asks for persistent storage and reminds the Learner how long ago they last downloaded.
- Statistics count only Reviews of a Card's current version.
