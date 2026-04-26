export type RatePoint = {
  date: string;
  policyRate: number;
  mortgageBond5y: number;
};

export type NegotiationOption = {
  periodLabel: string;
  periodLabelDisplay: string;
  periodYears: number;
  minListRate: number;
  medianListRate: number;
  maxListRate: number;
  minFundingCost: number;
  medianFundingCost: number;
  lowerMargin: number;
  upperMargin: number;
  bankCount: number;
};

export type DashboardSnapshot = {
  generatedAt: string;
  rates: RatePoint[];
  negotiationOptions: NegotiationOption[];
};

export type DashboardKpis = {
  latestDate: string;
  latestPolicyRate: number;
  latestMortgageBond5y: number;
  policyRateChange30d: number | null;
  mortgageBond5yChange30d: number | null;
};

export type NegotiationRange = {
  option: NegotiationOption;
  floorRate: number;
  midpointRate: number;
  ceilingRate: number;
  discountFromMedianListRate: number;
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

export function parseDashboardSnapshot(input: unknown): DashboardSnapshot {
  if (!isRecord(input)) {
    throw new Error("Dashboard snapshot must be an object.");
  }

  const generatedAt = input.generatedAt ?? input.generated_at;
  if (typeof generatedAt !== "string") {
    throw new Error("Dashboard snapshot is missing generatedAt.");
  }

  if (!Array.isArray(input.rates)) {
    throw new Error("Dashboard snapshot is missing rates.");
  }

  return {
    generatedAt,
    rates: input.rates.map(parseRatePoint),
    negotiationOptions: Array.isArray(input.negotiationOptions)
      ? input.negotiationOptions.map(parseNegotiationOption)
      : [],
  };
}

export function deriveDashboardKpis(
  snapshot: DashboardSnapshot,
): DashboardKpis | null {
  const latest = snapshot.rates.at(-1);
  if (!latest) return null;

  const comparison = comparisonRate(snapshot.rates, latest.date, 30);
  return {
    latestDate: latest.date,
    latestPolicyRate: latest.policyRate,
    latestMortgageBond5y: latest.mortgageBond5y,
    policyRateChange30d: comparison
      ? roundRateDelta(latest.policyRate - comparison.policyRate)
      : null,
    mortgageBond5yChange30d: comparison
      ? roundRateDelta(latest.mortgageBond5y - comparison.mortgageBond5y)
      : null,
  };
}

export function deriveNegotiationRange(
  option: NegotiationOption,
): NegotiationRange {
  const floorRate = roundRateDelta(option.medianFundingCost + option.lowerMargin);
  const ceilingRate = roundRateDelta(option.medianFundingCost + option.upperMargin);
  const midpointRate = roundRateDelta((floorRate + ceilingRate) / 2);

  return {
    option,
    floorRate,
    midpointRate,
    ceilingRate,
    discountFromMedianListRate: roundRateDelta(
      option.medianListRate - midpointRate,
    ),
  };
}

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

function parseRatePoint(input: unknown): RatePoint {
  if (!isRecord(input)) {
    throw new Error("Rate point must be an object.");
  }

  const date = readString(input, "date");
  const policyRate = readNumber(input, "policyRate", "policy_rate");
  const mortgageBond5y = readNumber(
    input,
    "mortgageBond5y",
    "mortgage_bond_5y",
  );

  return { date, policyRate, mortgageBond5y };
}

function parseNegotiationOption(input: unknown): NegotiationOption {
  if (!isRecord(input)) {
    throw new Error("Negotiation option must be an object.");
  }

  return {
    periodLabel: readString(input, "periodLabel"),
    periodLabelDisplay: readString(input, "periodLabelDisplay"),
    periodYears: readNumber(input, "periodYears", "period_years"),
    minListRate: readNumber(input, "minListRate", "min_list_rate"),
    medianListRate: readNumber(input, "medianListRate", "median_list_rate"),
    maxListRate: readNumber(input, "maxListRate", "max_list_rate"),
    minFundingCost: readNumber(input, "minFundingCost", "min_funding_cost"),
    medianFundingCost: readNumber(
      input,
      "medianFundingCost",
      "median_funding_cost",
    ),
    lowerMargin: readNumber(input, "lowerMargin", "lower_margin"),
    upperMargin: readNumber(input, "upperMargin", "upper_margin"),
    bankCount: readNumber(input, "bankCount", "bank_count"),
  };
}

function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be a string.`);
  }
  return value;
}

function readNumber(
  input: Record<string, unknown>,
  primaryKey: string,
  fallbackKey: string,
): number {
  const value = input[primaryKey] ?? input[fallbackKey];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Expected ${primaryKey} to be a number.`);
  }
  return value;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function comparisonRate(
  rates: RatePoint[],
  latestDate: string,
  daysBack: number,
): RatePoint | null {
  const targetTime = Date.parse(latestDate) - daysBack * 24 * 60 * 60 * 1000;
  if (Number.isNaN(targetTime)) return null;

  const candidates = rates.filter((rate) => Date.parse(rate.date) <= targetTime);
  return candidates.at(-1) ?? null;
}

function roundRateDelta(value: number): number {
  return Math.round(value * 100) / 100;
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
