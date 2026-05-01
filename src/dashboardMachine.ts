export type RatePoint = {
  date: string;
  policyRate: number;
  mortgageBond2y: number;
  mortgageBond5y: number;
};

export type NegotiationOption = {
  periodLabel: string;
  periodLabelDisplay: string;
  periodYears: number;
  minListRate: number;
  lowerListRate: number;
  medianListRate: number;
  upperListRate: number;
  maxListRate: number;
  minFundingCost: number;
  medianFundingCost: number;
  lowerMargin: number;
  upperMargin: number;
  bankCount: number;
};

export type SourceLink = {
  id: string;
  label: string;
  url: string;
  usedFor: string;
};

export type DashboardSnapshot = {
  generatedAt: string;
  rates: RatePoint[];
  negotiationOptions: NegotiationOption[];
  sourceLinks: SourceLink[];
};

export type DashboardKpis = {
  latestDate: string;
  latestPolicyRate: number;
  latestMortgageBond2y: number;
  latestMortgageBond5y: number;
  policyRateChange30d: number | null;
  mortgageBond2yChange30d: number | null;
  mortgageBond5yChange30d: number | null;
};

export type NegotiationRange = {
  option: NegotiationOption;
  floorRate: number;
  midpointRate: number;
  ceilingRate: number;
  discountFromMedianListRate: number;
};

export type ConfidenceLevel = "high" | "medium" | "low";
export type DashboardFreshnessLevel = "current" | "watch" | "stale" | "invalid";

export type DashboardMode =
  | "choose_period"
  | "trust_review"
  | "market_review"
  | "evidence_review"
  | "method_review";

export type ReviewMode = Exclude<DashboardMode, "choose_period">;

export type DashboardState =
  | { value: "idle" }
  | { value: "loading" }
  | {
      value: "ready";
      snapshot: DashboardSnapshot;
      selectedPeriod: string | null;
      mode: DashboardMode;
    }
  | {
      value: "pipeline_inspection";
      snapshot: DashboardSnapshot;
      selectedPeriod: string | null;
      returnMode: DashboardMode;
    }
  | { value: "empty"; generatedAt: string }
  | { value: "error"; message: string };

export type DashboardEvent =
  | { type: "START" }
  | { type: "LOAD_SUCCEEDED"; snapshot: DashboardSnapshot }
  | { type: "LOAD_FAILED"; message: string }
  | { type: "SELECT_DURATION"; periodLabel: string }
  | { type: "VIEW_REVIEW"; mode: ReviewMode }
  | { type: "VIEW_PIPELINE" }
  | { type: "CLOSE_PIPELINE" }
  | { type: "RETRY" };

export type DashboardStateValue = DashboardState["value"];
export type DashboardEventType = DashboardEvent["type"];

const MAX_SNAPSHOT_AGE_HOURS = 36;
const MAX_WATCH_SNAPSHOT_AGE_HOURS = 24;
const MAX_STALE_MARKET_AGE_DAYS = 7;
const MAX_WATCH_MARKET_AGE_DAYS = 4;
const MAX_OUTGOING_TRANSITIONS_PER_STATE = 4;

export const transitionMap = {
  idle: ["START"],
  loading: ["LOAD_FAILED", "LOAD_SUCCEEDED"],
  ready: ["RETRY", "SELECT_DURATION", "VIEW_REVIEW", "VIEW_PIPELINE"],
  pipeline_inspection: ["CLOSE_PIPELINE", "RETRY"],
  empty: ["RETRY"],
  error: ["RETRY"],
} as const satisfies Record<DashboardStateValue, readonly DashboardEventType[]>;

export const proposedModeGroups = {
  choose_period: ["task", "trust_compact"],
  trust_review: ["trust", "sources"],
  market_review: ["market"],
  evidence_review: ["evidence", "limits"],
  method_review: ["method", "sources"],
} as const satisfies Record<DashboardMode, readonly string[]>;

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

  const snapshot = {
    generatedAt,
    rates: input.rates.map(parseRatePoint),
    negotiationOptions: readNegotiationOptions(input),
    sourceLinks: readSourceLinks(input),
  };
  validateDashboardSnapshot(snapshot);
  return snapshot;
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
    latestMortgageBond2y: latest.mortgageBond2y,
    latestMortgageBond5y: latest.mortgageBond5y,
    policyRateChange30d: comparison
      ? roundRateDelta(latest.policyRate - comparison.policyRate)
      : null,
    mortgageBond2yChange30d: comparison
      ? roundRateDelta(latest.mortgageBond2y - comparison.mortgageBond2y)
      : null,
    mortgageBond5yChange30d: comparison
      ? roundRateDelta(latest.mortgageBond5y - comparison.mortgageBond5y)
      : null,
  };
}

export function deriveNegotiationRange(
  option: NegotiationOption,
): NegotiationRange {
  const floorRate = roundRateDelta(
    Math.max(option.medianFundingCost, option.lowerListRate),
  );
  const ceilingRate = roundRateDelta(Math.max(floorRate, option.upperListRate));
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

export function confidenceForBankCount(bankCount: number): ConfidenceLevel {
  if (bankCount >= 3) return "high";
  if (bankCount === 2) return "medium";
  return "low";
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
        return {
          value: "ready",
          snapshot: event.snapshot,
          selectedPeriod: null,
          mode: "choose_period",
        };
      }
      return state;

    case "ready":
      if (event.type === "SELECT_DURATION") {
        if (!hasNegotiationPeriod(state.snapshot, event.periodLabel)) {
          return state;
        }
        return {
          ...state,
          snapshot: state.snapshot,
          selectedPeriod: event.periodLabel,
          mode: defaultReviewMode(state.snapshot),
        };
      }
      if (event.type === "VIEW_REVIEW") {
        if (!state.selectedPeriod) return state;
        return { ...state, mode: event.mode };
      }
      if (event.type === "VIEW_PIPELINE") {
        return {
          value: "pipeline_inspection",
          snapshot: state.snapshot,
          selectedPeriod: state.selectedPeriod,
          returnMode: state.mode,
        };
      }
      if (event.type === "RETRY") return { value: "loading" };
      return state;

    case "pipeline_inspection":
      if (event.type === "CLOSE_PIPELINE") {
        return {
          value: "ready",
          snapshot: state.snapshot,
          selectedPeriod: state.selectedPeriod,
          mode: state.returnMode,
        };
      }
      if (event.type === "RETRY") return { value: "loading" };
      return state;

    case "empty":
    case "error":
      if (event.type === "RETRY") return { value: "loading" };
      return state;
  }
}

function defaultReviewMode(snapshot: DashboardSnapshot): ReviewMode {
  return dashboardFreshnessLevel(snapshot) === "current"
    ? "market_review"
    : "trust_review";
}

function hasNegotiationPeriod(
  snapshot: DashboardSnapshot,
  periodLabel: string,
): boolean {
  return snapshot.negotiationOptions.some(
    (option) => option.periodLabel === periodLabel,
  );
}

function parseRatePoint(input: unknown): RatePoint {
  if (!isRecord(input)) {
    throw new Error("Rate point must be an object.");
  }

  const date = readString(input, "date");
  const policyRate = readNumber(input, "policyRate", "policy_rate");
  const mortgageBond2y = readNumber(
    input,
    "mortgageBond2y",
    "mortgage_bond_2y",
  );
  const mortgageBond5y = readNumber(
    input,
    "mortgageBond5y",
    "mortgage_bond_5y",
  );

  return { date, policyRate, mortgageBond2y, mortgageBond5y };
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
    lowerListRate: readOptionalNumber(
      input,
      "lowerListRate",
      "lower_list_rate",
      "minListRate",
      "min_list_rate",
    ),
    medianListRate: readNumber(input, "medianListRate", "median_list_rate"),
    upperListRate: readOptionalNumber(
      input,
      "upperListRate",
      "upper_list_rate",
      "maxListRate",
      "max_list_rate",
    ),
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

function readNegotiationOptions(input: Record<string, unknown>): NegotiationOption[] {
  if (!Array.isArray(input.negotiationOptions)) {
    throw new Error("Dashboard snapshot is missing negotiationOptions.");
  }
  return input.negotiationOptions.map(parseNegotiationOption);
}

function readSourceLinks(input: Record<string, unknown>): SourceLink[] {
  if (input.sourceLinks === undefined) return [];
  if (!Array.isArray(input.sourceLinks)) {
    throw new Error("Expected sourceLinks to be an array when present.");
  }
  return input.sourceLinks.map(parseSourceLink);
}

function parseSourceLink(input: unknown): SourceLink {
  if (!isRecord(input)) {
    throw new Error("Source link must be an object.");
  }

  const sourceLink = {
    id: readString(input, "id"),
    label: readString(input, "label"),
    url: readString(input, "url"),
    usedFor: readString(input, "usedFor"),
  };
  if (!sourceLink.url.startsWith("https://")) {
    throw new Error("Source link URLs must use HTTPS.");
  }
  return sourceLink;
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

function readOptionalNumber(
  input: Record<string, unknown>,
  primaryKey: string,
  fallbackKey: string,
  legacyPrimaryKey: string,
  legacyFallbackKey: string,
): number {
  const value =
    input[primaryKey] ??
    input[fallbackKey] ??
    input[legacyPrimaryKey] ??
    input[legacyFallbackKey];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Expected ${primaryKey} to be a number.`);
  }
  return value;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function validateDashboardSnapshot(snapshot: DashboardSnapshot): void {
  if (snapshot.rates.length === 0) return;
  assertAscending(
    snapshot.rates.map((rate) => rate.date),
    "rates must be sorted ascending by date.",
  );
  if (snapshot.negotiationOptions.length === 0) {
    throw new Error("Dashboard snapshot has no negotiationOptions.");
  }

  let previousYears = -Infinity;
  for (const option of snapshot.negotiationOptions) {
    if (option.periodYears < previousYears) {
      throw new Error("negotiationOptions must be sorted by periodYears.");
    }
    previousYears = option.periodYears;

    if (
      option.minListRate > option.lowerListRate ||
      option.lowerListRate > option.medianListRate ||
      option.medianListRate > option.upperListRate ||
      option.upperListRate > option.maxListRate
    ) {
      throw new Error("Negotiation list-rate quantiles are inconsistent.");
    }

    if (option.medianFundingCost > option.maxListRate) {
      throw new Error("Market funding proxy is above the maximum listed rate.");
    }
  }
}

function assertAscending(values: string[], message: string): void {
  let previous = "";
  for (const value of values) {
    if (previous && value < previous) throw new Error(message);
    previous = value;
  }
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

export function dashboardFreshnessLevel(
  snapshot: DashboardSnapshot,
  now = Date.now(),
): DashboardFreshnessLevel {
  const generatedAt = Date.parse(snapshot.generatedAt);
  const latestMarketDate = snapshot.rates.at(-1)?.date;
  const marketDate = latestMarketDate
    ? Date.parse(`${latestMarketDate}T00:00:00Z`)
    : NaN;

  if (Number.isNaN(generatedAt) || Number.isNaN(marketDate)) return "invalid";

  const snapshotAgeHours = Math.max(
    0,
    Math.floor((now - generatedAt) / 1000 / 60 / 60),
  );
  const marketAgeDays = Math.max(
    0,
    Math.floor((now - marketDate) / 1000 / 60 / 60 / 24),
  );

  if (
    snapshotAgeHours > MAX_SNAPSHOT_AGE_HOURS ||
    marketAgeDays > MAX_STALE_MARKET_AGE_DAYS
  ) {
    return "stale";
  }

  if (
    snapshotAgeHours > MAX_WATCH_SNAPSHOT_AGE_HOURS ||
    marketAgeDays > MAX_WATCH_MARKET_AGE_DAYS
  ) {
    return "watch";
  }

  return "current";
}
