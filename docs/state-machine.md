# Dashboard State Machine

The public dashboard app is driven by an explicit state machine.

## Current Screen Inventory

The current page contains several jobs that are all visible in one long view:

- Mortgage task:
  hero promise, binding-period picker, selected margin-zone result, how-to-read
  details, and data behind the selected margin zone.
- Trust and freshness:
  snapshot export timestamp, latest market date, snapshot age, market-data age,
  source count, and freshness status.
- Market context:
  policy rate, 2Y CAISSE proxy, 5Y CAISSE proxy, 30-day changes, and source
  chips.
- Evidence:
  market-pressure chart, duration-comparison chart, and funding-margin chart.
- Personal caveats:
  what the app does not know about the borrower.
- Methodology:
  funding-proxy summary, CAISSE explanation, issuer caveats, source links, and
  proxy usage by binding period.
- Product/engineering context:
  dbt pipeline walkthrough, public snapshot contract, source panels, and app
  diagnostics.

These groups do not all belong in the same default view. The first-time user
path should focus on the mortgage task and confidence in the result. Methodology,
source provenance, and engineering details should be entered deliberately.

## Information Groups

- `task`: choose a binding period and inspect the modeled margin zone.
- `trust`: freshness, latest market date, source coverage, and confidence.
- `market`: compact rate context for policy rate and CAISSE proxies.
- `evidence`: charts and comparable duration context after a period is selected.
- `limits`: borrower-specific caveats and interpretation guardrails.
- `method`: funding-proxy and CAISSE methodology, sources, and references.
- `pipeline`: data-engineering case study and diagnostics.

## Product States

The app separates data readiness from the user's current information layer:

```ts
type AppMode =
  | "choose_period"
  | "trust_review"
  | "market_review"
  | "evidence_review"
  | "method_review";

type DashboardState =
  | { value: "idle" }
  | { value: "loading" }
  | { value: "empty"; generatedAt: string }
  | { value: "error"; message: string }
  | {
      value: "ready";
      snapshot: DashboardSnapshot;
      mode: AppMode;
      selectedPeriod: string | null;
    }
  | {
      value: "pipeline_inspection";
      snapshot: DashboardSnapshot;
      selectedPeriod: string | null;
      returnMode: AppMode;
    };
```

The key change is that `ready_unselected`, `duration_selected`, and `stale`
collapse into one loaded state with explicit `mode` and `selectedPeriod`. That
gives the UI permission to show one layer at a time instead of rendering every
layer in a single scroll. `pipeline_inspection` stays separate because it is a
different screen and needs a return mode.

## Events

- `START`: load the public snapshot.
- `LOAD_SUCCEEDED`: validate data and enter `ready`.
- `LOAD_FAILED`: enter `error`.
- `RETRY`: retry loading.
- `SELECT_DURATION`: set `selectedPeriod` and default the review mode.
- `VIEW_REVIEW`: switch between `trust_review`, `market_review`,
  `evidence_review`, and `method_review`.
- `VIEW_PIPELINE`: show the data-engineering walkthrough.
- `CLOSE_PIPELINE`: return to the previous ready mode.

## Default Views

- `choose_period`:
  hero, one short sentence of context, binding-period picker, compact freshness
  badge if current, prominent warning if stale.
- `trust_review`:
  selected margin zone, freshness panel, latest market date, source count,
  confidence, and borrower-specific caveats. This is the default review mode
  when the snapshot or latest market observation is stale or close to stale.
- `market_review`:
  selected margin zone plus policy rate and 2Y/5Y CAISSE market context. This is
  the default review mode only when both the export timestamp and latest market
  observation are current.
- `evidence_review`:
  charts and duration comparison. Enter only after a period is selected.
- `method_review`:
  funding proxy explanation, CAISSE caveats, binding-period proxy table, source
  links.
- `pipeline_inspection`:
  dbt/data-product case study and diagnostics.

## States

- `idle`: app has mounted but has not started loading data.
- `loading`: the app is fetching or preparing a dashboard snapshot.
- `ready`: a non-empty snapshot is available. It may be current or stale; the
  freshness panel communicates that in the relevant mode.
- `pipeline_inspection`: the data-engineering walkthrough is open.
- `empty`: the export succeeded but returned no rows.
- `error`: loading or validation failed.

## Events

- `START`: move from `idle` to `loading`.
- `LOAD_SUCCEEDED`: validate a loaded snapshot and move to `ready` or `empty`.
- `LOAD_FAILED`: move to `error`.
- `SELECT_DURATION`: choose a binding period and enter the default review mode.
- `VIEW_REVIEW`: switch loaded review modes.
- `VIEW_PIPELINE`: open the pipeline screen.
- `CLOSE_PIPELINE`: return to the previous ready mode.
- `RETRY`: retry loading.

## Policy

The state machine is the only place that decides whether a snapshot is usable,
empty, stale, current, or failed. Components render states; they should not
duplicate transition logic.

The selected mortgage duration and active review mode are part of `ready`.
Components render these states; they should not keep parallel mutable view state.

## Complexity Budget

Local complexity is counted as outgoing transitions per state. This is cheap to
review and keeps the app simple enough to reason about as dashboard features are
added.

Current transition counts:

- `idle`: 1
- `loading`: 2
- `ready`: 4
- `pipeline_inspection`: 2
- `empty`: 1
- `error`: 1

Budget:

- Keep each state at or below 4 outgoing transitions.
- Prefer adding data to the snapshot over adding new states.
- Add a state only when the UI needs a materially different user-facing mode.
- Add an event only when it represents a real external input or time-based
  condition, not an implementation detail.
