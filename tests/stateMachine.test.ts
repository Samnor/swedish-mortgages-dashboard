import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  maxOutgoingTransitions,
  transition,
  type DashboardSnapshot,
  type DashboardState,
} from "../src/dashboardMachine.ts";

const snapshot: DashboardSnapshot = {
  generatedAt: "2999-01-01T00:00:00Z",
  rates: [
    {
      date: "2026-04-01",
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
  it("loads a valid snapshot into ready_unselected", () => {
    const loading = transition({ value: "idle" }, { type: "START" });
    const ready = transition(loading, {
      snapshot,
      type: "LOAD_SUCCEEDED",
    });

    assert.equal(loading.value, "loading");
    assert.equal(ready.value, "ready_unselected");
  });

  it("selects a valid mortgage duration", () => {
    const selected = transition(
      { snapshot, value: "ready_unselected" },
      { periodLabel: "3M", type: "SELECT_DURATION" },
    );

    assert.equal(selected.value, "duration_selected");
    assert.equal(selected.selectedPeriod, "3M");
  });

  it("ignores impossible mortgage duration selections", () => {
    const ready: DashboardState = { snapshot, value: "ready_unselected" };
    const selected: DashboardState = {
      selectedPeriod: "3M",
      snapshot,
      value: "duration_selected",
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
      selectedPeriod: "3M",
      snapshot,
      value: "duration_selected",
    };
    const pipeline = transition(selected, { type: "VIEW_PIPELINE" });
    const back = transition(pipeline, { type: "CLOSE_PIPELINE" });

    assert.equal(pipeline.value, "pipeline_inspection");
    assert.equal(pipeline.selectedPeriod, "3M");
    assert.equal(back.value, "duration_selected");
    assert.equal(back.selectedPeriod, "3M");
  });

  it("round-trips from unselected ready state into pipeline view and back", () => {
    const ready: DashboardState = { snapshot, value: "ready_unselected" };
    const pipeline = transition(ready, { type: "VIEW_PIPELINE" });
    const back = transition(pipeline, { type: "CLOSE_PIPELINE" });

    assert.equal(pipeline.value, "pipeline_inspection");
    assert.equal(pipeline.selectedPeriod, null);
    assert.equal(back.value, "ready_unselected");
  });

  it("models empty, stale, and error loading outcomes", () => {
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
    const stale = transition(
      { value: "loading" },
      {
        snapshot: {
          ...snapshot,
          generatedAt: "2000-01-01T00:00:00Z",
        },
        type: "LOAD_SUCCEEDED",
      },
    );
    const error = transition(
      { value: "loading" },
      { message: "boom", type: "LOAD_FAILED" },
    );

    assert.equal(empty.value, "empty");
    assert.equal(stale.value, "stale");
    assert.equal(error.value, "error");
  });

  it("keeps local transition complexity capped", () => {
    assert.equal(maxOutgoingTransitions <= 3, true);
  });
});
