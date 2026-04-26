# Dashboard State Machine

The public dashboard app is driven by an explicit state machine.

## States

- `idle`: app has mounted but has not started loading data.
- `loading`: the app is fetching or preparing a dashboard snapshot.
- `ready`: a non-empty, fresh snapshot is available.
- `empty`: the export succeeded but returned no rows.
- `stale`: data exists, but the generated timestamp is older than the freshness threshold.
- `error`: loading or validation failed.

## Events

- `START`: move from `idle` to `loading`.
- `LOAD_SUCCEEDED`: validate a loaded snapshot and move to `ready`, `empty`, or `stale`.
- `LOAD_FAILED`: move to `error`.
- `MARK_STALE`: mark a previously ready snapshot as stale.
- `RETRY`: retry from terminal display states.

## Policy

The state machine is the only place that decides whether a snapshot is usable,
empty, stale, or failed. Components render states; they should not duplicate
transition logic.

## Complexity Budget

Local complexity is counted as outgoing transitions per state. This is cheap to
review and keeps the app simple enough to reason about as dashboard features are
added.

Current transition counts:

- `idle`: 1
- `loading`: 2
- `ready`: 2
- `empty`: 1
- `stale`: 1
- `error`: 1

Budget:

- Keep each state at or below 3 outgoing transitions.
- Prefer adding data to the snapshot over adding new states.
- Add a state only when the UI needs a materially different user-facing mode.
- Add an event only when it represents a real external input or time-based
  condition, not an implementation detail.
