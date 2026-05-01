import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dashboardFreshnessLevel,
  maxOutgoingTransitions,
  proposedModeGroups,
  transitionMap,
  transition,
  type DashboardSnapshot,
  type DashboardState,
} from "../src/dashboardMachine.ts";

const snapshot: DashboardSnapshot = {
  generatedAt: "2999-01-01T00:00:00Z",
  rates: [
    {
      date: "2999-01-01",
      mortgageBond2y: 2.4,
      mortgageBond5y: 2.8,
      policyRate: 1.75,
    },
  ],
  negotiationOptions: [
    {
      bankCount: 3,
      lowerListRate: 3.2,
      lowerMargin: 1.1,
      maxListRate: 4.2,
      medianFundingCost: 2.1,
      medianListRate: 3.7,
      minFundingCost: 2,
      minListRate: 3.1,
      periodLabel: "3M",
      periodLabelDisplay: "3M",
      periodYears: 0.25,
      upperListRate: 4,
      upperMargin: 1.9,
    },
    {
      bankCount: 3,
      lowerListRate: 3.3,
      lowerMargin: 1.2,
      maxListRate: 4.3,
      medianFundingCost: 2.2,
      medianListRate: 3.8,
      minFundingCost: 2.1,
      minListRate: 3.2,
      periodLabel: "1Y",
      periodLabelDisplay: "1Y",
      periodYears: 1,
      upperListRate: 4.1,
      upperMargin: 1.9,
    },
  ],
  sourceLinks: [],
};

describe("dashboard state machine", () => {
  it("loads a valid snapshot into ready choose_period mode", () => {
    const loading = transition({ value: "idle" }, { type: "START" });
    const ready = transition(loading, {
      snapshot,
      type: "LOAD_SUCCEEDED",
    });

    assert.equal(loading.value, "loading");
    assert.equal(ready.value, "ready");
    assert.equal(ready.mode, "choose_period");
    assert.equal(ready.selectedPeriod, null);
  });

  it("selects a valid mortgage duration and defaults current data to market review", () => {
    const selected = transition(
      {
        mode: "choose_period",
        selectedPeriod: null,
        snapshot,
        value: "ready",
      },
      { periodLabel: "3M", type: "SELECT_DURATION" },
    );

    assert.equal(selected.value, "ready");
    assert.equal(selected.selectedPeriod, "3M");
    assert.equal(selected.mode, "market_review");
  });

  it("selects a valid mortgage duration and defaults stale data to trust review", () => {
    const selected = transition(
      {
        mode: "choose_period",
        selectedPeriod: null,
        snapshot: { ...snapshot, generatedAt: "2000-01-01T00:00:00Z" },
        value: "ready",
      },
      { periodLabel: "3M", type: "SELECT_DURATION" },
    );

    assert.equal(selected.value, "ready");
    assert.equal(selected.selectedPeriod, "3M");
    assert.equal(selected.mode, "trust_review");
  });

  it("defaults old market observations to trust review even when the export is fresh", () => {
    const marketStaleSnapshot: DashboardSnapshot = {
      ...snapshot,
      generatedAt: "2026-05-01T10:00:00Z",
      rates: [{ ...snapshot.rates[0], date: "2026-04-20" }],
    };
    const selected = transition(
      {
        mode: "choose_period",
        selectedPeriod: null,
        snapshot: marketStaleSnapshot,
        value: "ready",
      },
      { periodLabel: "3M", type: "SELECT_DURATION" },
    );

    assert.equal(
      dashboardFreshnessLevel(
        marketStaleSnapshot,
        Date.parse("2026-05-01T12:00:00Z"),
      ),
      "stale",
    );
    assert.equal(selected.value, "ready");
    assert.equal(selected.mode, "trust_review");
  });

  it("ignores impossible mortgage duration selections", () => {
    const ready: DashboardState = {
      mode: "choose_period",
      selectedPeriod: null,
      snapshot,
      value: "ready",
    };
    const selected: DashboardState = {
      mode: "market_review",
      selectedPeriod: "3M",
      snapshot,
      value: "ready",
    };

    assert.equal(
      transition(ready, {
        periodLabel: "99Y",
        type: "SELECT_DURATION",
      }),
      ready,
    );
    assert.equal(
      transition(selected, {
        periodLabel: "99Y",
        type: "SELECT_DURATION",
      }),
      selected,
    );
  });

  it("round-trips from selected duration into pipeline view and back", () => {
    const selected: DashboardState = {
      mode: "market_review",
      selectedPeriod: "3M",
      snapshot,
      value: "ready",
    };
    const pipeline = transition(selected, { type: "VIEW_PIPELINE" });
    const back = transition(pipeline, { type: "CLOSE_PIPELINE" });

    assert.equal(pipeline.value, "pipeline_inspection");
    assert.equal(pipeline.selectedPeriod, "3M");
    assert.equal(pipeline.returnMode, "market_review");
    assert.equal(back.value, "ready");
    assert.equal(back.selectedPeriod, "3M");
    assert.equal(back.mode, "market_review");
  });

  it("round-trips from unselected ready state into pipeline view and back", () => {
    const ready: DashboardState = {
      mode: "choose_period",
      selectedPeriod: null,
      snapshot,
      value: "ready",
    };
    const pipeline = transition(ready, { type: "VIEW_PIPELINE" });
    const back = transition(pipeline, { type: "CLOSE_PIPELINE" });

    assert.equal(pipeline.value, "pipeline_inspection");
    assert.equal(pipeline.selectedPeriod, null);
    assert.equal(back.value, "ready");
    assert.equal(back.mode, "choose_period");
  });

  it("changes review modes only after a period is selected", () => {
    const unselected: DashboardState = {
      mode: "choose_period",
      selectedPeriod: null,
      snapshot,
      value: "ready",
    };
    const selected: DashboardState = {
      mode: "market_review",
      selectedPeriod: "3M",
      snapshot,
      value: "ready",
    };

    assert.equal(
      transition(unselected, { mode: "evidence_review", type: "VIEW_REVIEW" }),
      unselected,
    );
    assert.equal(
      transition(selected, { mode: "evidence_review", type: "VIEW_REVIEW" }).mode,
      "evidence_review",
    );
  });

  it("models empty and error loading outcomes", () => {
    const empty = transition(
      { value: "loading" },
      {
        snapshot: {
          ...snapshot,
          generatedAt: "2999-01-01T00:00:00Z",
          negotiationOptions: [],
          rates: [],
        },
        type: "LOAD_SUCCEEDED",
      },
    );
    const error = transition(
      { value: "loading" },
      { message: "boom", type: "LOAD_FAILED" },
    );

    assert.equal(empty.value, "empty");
    assert.equal(error.value, "error");
  });

  it("keeps local transition complexity capped", () => {
    assert.equal(maxOutgoingTransitions <= 4, true);
  });

  it("sketches grouped views for a less crowded app", () => {
    assert.deepEqual(proposedModeGroups.choose_period, ["task", "trust_compact"]);
    assert.deepEqual(proposedModeGroups.market_review, ["market"]);
    assert.deepEqual(proposedModeGroups.method_review, ["method", "sources"]);
  });

  it("uses one loaded state with explicit review modes", () => {
    assert.deepEqual(transitionMap.ready, [
      "RETRY",
      "SELECT_DURATION",
      "VIEW_REVIEW",
      "VIEW_PIPELINE",
    ]);
  });
});
