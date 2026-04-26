export type RatePoint = {
  date: string;
  policyRate: number;
  mortgageBond5y: number;
};

export type DashboardSnapshot = {
  generatedAt: string;
  rates: RatePoint[];
};

export type DashboardState =
  | { value: "idle" }
  | { value: "loading" }
  | { value: "ready"; snapshot: DashboardSnapshot }
  | { value: "empty"; generatedAt: string }
  | { value: "stale"; snapshot: DashboardSnapshot; reason: string }
  | { value: "error"; message: string };

export type DashboardEvent =
  | { type: "START" }
  | { type: "LOAD_SUCCEEDED"; snapshot: DashboardSnapshot }
  | { type: "LOAD_FAILED"; message: string }
  | { type: "MARK_STALE"; reason: string }
  | { type: "RETRY" };

export type DashboardStateValue = DashboardState["value"];
export type DashboardEventType = DashboardEvent["type"];

const MAX_SNAPSHOT_AGE_HOURS = 36;
const MAX_OUTGOING_TRANSITIONS_PER_STATE = 3;

export const transitionMap = {
  idle: ["START"],
  loading: ["LOAD_FAILED", "LOAD_SUCCEEDED"],
  ready: ["MARK_STALE", "RETRY"],
  empty: ["RETRY"],
  stale: ["RETRY"],
  error: ["RETRY"],
} as const satisfies Record<DashboardStateValue, readonly DashboardEventType[]>;

export const stateComplexity = Object.fromEntries(
  Object.entries(transitionMap).map(([state, events]) => [state, events.length]),
) as Record<DashboardStateValue, number>;

export const maxOutgoingTransitions = Math.max(
  ...Object.values(stateComplexity),
);

export function assertStateMachineComplexity(): void {
  if (maxOutgoingTransitions > MAX_OUTGOING_TRANSITIONS_PER_STATE) {
    throw new Error(
      `State machine local complexity is ${maxOutgoingTransitions}; keep it at or below ${MAX_OUTGOING_TRANSITIONS_PER_STATE}.`,
    );
  }
}

assertStateMachineComplexity();

export function transition(
  state: DashboardState,
  event: DashboardEvent,
): DashboardState {
  switch (state.value) {
    case "idle":
      if (event.type === "START") return { value: "loading" };
      return state;

    case "loading":
      if (event.type === "LOAD_FAILED") {
        return { value: "error", message: event.message };
      }
      if (event.type === "LOAD_SUCCEEDED") {
        if (event.snapshot.rates.length === 0) {
          return { value: "empty", generatedAt: event.snapshot.generatedAt };
        }
        const staleReason = snapshotStaleReason(event.snapshot);
        if (staleReason) {
          return {
            value: "stale",
            snapshot: event.snapshot,
            reason: staleReason,
          };
        }
        return { value: "ready", snapshot: event.snapshot };
      }
      return state;

    case "ready":
      if (event.type === "MARK_STALE") {
        return { value: "stale", snapshot: state.snapshot, reason: event.reason };
      }
      if (event.type === "RETRY") return { value: "loading" };
      return state;

    case "empty":
    case "stale":
    case "error":
      if (event.type === "RETRY") return { value: "loading" };
      return state;
  }
}

export function snapshotStaleReason(snapshot: DashboardSnapshot): string | null {
  const generatedAt = Date.parse(snapshot.generatedAt);
  if (Number.isNaN(generatedAt)) return "Snapshot timestamp is invalid.";

  const ageHours = (Date.now() - generatedAt) / 1000 / 60 / 60;
  if (ageHours > MAX_SNAPSHOT_AGE_HOURS) {
    return `Snapshot is older than ${MAX_SNAPSHOT_AGE_HOURS} hours.`;
  }
  return null;
}

export const sampleSnapshot: DashboardSnapshot = {
  generatedAt: new Date().toISOString(),
  rates: [
    { date: "2026-04-20", policyRate: 2.25, mortgageBond5y: 2.71 },
    { date: "2026-04-21", policyRate: 2.25, mortgageBond5y: 2.73 },
    { date: "2026-04-22", policyRate: 2.25, mortgageBond5y: 2.7 },
    { date: "2026-04-23", policyRate: 2.25, mortgageBond5y: 2.69 },
    { date: "2026-04-24", policyRate: 2.25, mortgageBond5y: 2.68 },
  ],
};
