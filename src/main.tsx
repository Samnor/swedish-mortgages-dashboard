import React, { useEffect, useReducer, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactECharts from "echarts-for-react";
import {
  deriveDashboardKpis,
  deriveNegotiationRange,
  maxOutgoingTransitions,
  parseDashboardSnapshot,
  stateComplexity,
  transition,
  type DashboardKpis,
  type DashboardSnapshot,
  type NegotiationOption,
  type NegotiationRange,
} from "./dashboardMachine";
import "./styles.css";

const snapshotUrl = `${import.meta.env.BASE_URL}data/latest.json`;

const rateFormatter = new Intl.NumberFormat("en-SE", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

function RatesPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const chartOption = {
    animationDuration: 700,
    grid: { left: 42, right: 24, top: 34, bottom: 34 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: snapshot.rates.map((row) => row.date),
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: "{value}%" },
    },
    series: [
      {
        name: "Policy rate",
        type: "line",
        smooth: true,
        data: snapshot.rates.map((row) => row.policyRate),
      },
      {
        name: "5Y mortgage bond",
        type: "line",
        smooth: true,
        data: snapshot.rates.map((row) => row.mortgageBond5y),
      },
    ],
  };

  return <ReactECharts option={chartOption} className="chart" />;
}

function InsightCharts({
  options,
  range,
  snapshot,
}: {
  options: NegotiationOption[];
  range: NegotiationRange;
  snapshot: DashboardSnapshot;
}) {
  return (
    <section className="insight-grid" aria-label="Mortgage negotiation charts">
      <InsightChart
        eyebrow="Chart 1"
        title="Market pressure"
        description="Policy rate and covered-bond funding context behind the negotiation."
      >
        <ReactECharts
          option={marketPressureOption(snapshot, range)}
          className="insight-chart"
        />
      </InsightChart>
      <InsightChart
        eyebrow="Chart 2"
        title="Your duration against alternatives"
        description="Median listed bank rates and target range across binding periods."
      >
        <ReactECharts
          option={durationComparisonOption(options, range)}
          className="insight-chart"
        />
      </InsightChart>
      <InsightChart
        eyebrow="Chart 3"
        title="What you are haggling over"
        description="Separates market funding proxy from the margin room implied by observed rates."
      >
        <ReactECharts
          option={fundingMarginOption(range)}
          className="insight-chart"
        />
      </InsightChart>
    </section>
  );
}

function InsightChart({
  children,
  description,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <article className="insight-card">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </article>
  );
}

function KpiGrid({ kpis }: { kpis: DashboardKpis }) {
  return (
    <section className="kpi-grid" aria-label="Mortgage market summary">
      <KpiCard
        label="Policy rate"
        value={`${rateFormatter.format(kpis.latestPolicyRate)}%`}
        detail={`Latest source date ${kpis.latestDate}`}
        delta={kpis.policyRateChange30d}
      />
      <KpiCard
        label="5Y mortgage bond"
        value={`${rateFormatter.format(kpis.latestMortgageBond5y)}%`}
        detail="Covered bond funding proxy"
        delta={kpis.mortgageBond5yChange30d}
      />
    </section>
  );
}

function DurationFlow({
  options,
  onSelectPeriod,
  range,
}: {
  options: NegotiationOption[];
  onSelectPeriod: (period: string) => void;
  range: NegotiationRange | null;
}) {
  if (!range) {
    return (
      <section className="flow-panel">
        <p className="eyebrow">Mortgage flow</p>
        <h2>No negotiation data yet.</h2>
        <p>
          The app has rate history, but no duration-specific bank comparison
          rows in this snapshot.
        </p>
      </section>
    );
  }

  return (
    <section className="flow-panel">
      <div>
        <p className="eyebrow">Step 1</p>
        <h2>How long do you want to bind your mortgage?</h2>
        <p>
          Pick the duration you are considering. The range below estimates a
          realistic negotiation target from listed bank rates and market funding
          proxies.
        </p>
        <div className="duration-options" role="list">
          {options.map((option) => (
            <button
              aria-pressed={option.periodLabel === range.option.periodLabel}
              className="duration-button"
              key={option.periodLabel}
              onClick={() => onSelectPeriod(option.periodLabel)}
              type="button"
            >
              {option.periodLabelDisplay}
            </button>
          ))}
        </div>
      </div>
      <NegotiationRangePanel range={range} />
    </section>
  );
}

function NegotiationRangePanel({ range }: { range: NegotiationRange }) {
  return (
    <article className="range-card">
      <p className="eyebrow">Step 2</p>
      <h2>{range.option.periodLabelDisplay} negotiation range</h2>
      <div className="range-value">
        {formatRate(range.floorRate)}-{formatRate(range.ceilingRate)}
      </div>
      <p>
        Use around <strong>{formatRate(range.midpointRate)}</strong> as a
        starting target. That is roughly{" "}
        <strong>{formatDelta(range.discountFromMedianListRate)}</strong> below
        the median listed rate in this duration bucket.
      </p>
      <dl className="range-details">
        <div>
          <dt>Median listed</dt>
          <dd>{formatRate(range.option.medianListRate)}</dd>
        </div>
        <div>
          <dt>Funding proxy</dt>
          <dd>{formatRate(range.option.medianFundingCost)}</dd>
        </div>
        <div>
          <dt>Banks sampled</dt>
          <dd>{range.option.bankCount}</dd>
        </div>
      </dl>
    </article>
  );
}

function KpiCard({
  label,
  value,
  detail,
  delta,
}: {
  label: string;
  value: string;
  detail: string;
  delta: number | null;
}) {
  return (
    <article className="kpi-card">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
      <span className="delta">{formatDelta(delta)} vs 30d ago</span>
    </article>
  );
}

function App() {
  const [state, dispatch] = useReducer(transition, { value: "idle" });
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSnapshot() {
      dispatch({ type: "START" });
      try {
        const response = await fetch(snapshotUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Snapshot request failed with ${response.status}.`);
        }
        const rawSnapshot: unknown = await response.json();
        dispatch({
          type: "LOAD_SUCCEEDED",
          snapshot: parseDashboardSnapshot(rawSnapshot),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        dispatch({
          type: "LOAD_FAILED",
          message:
            error instanceof Error ? error.message : "Snapshot loading failed.",
        });
      }
    }

    void loadSnapshot();

    return () => controller.abort();
  }, []);

  const snapshot =
    state.value === "ready" || state.value === "stale" ? state.snapshot : null;
  const kpis = snapshot ? deriveDashboardKpis(snapshot) : null;
  const negotiationOptions = snapshot?.negotiationOptions ?? [];
  const selectedOption =
    negotiationOptions.find((option) => option.periodLabel === selectedPeriod) ??
    negotiationOptions[0] ??
    null;
  const selectedRange = selectedOption
    ? deriveNegotiationRange(selectedOption)
    : null;

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Swedish Mortgage Intelligence</p>
        <h1>Market context before you negotiate with a lender.</h1>
        <p>
          Pick the binding period you are considering and get a market-informed
          range to use before talking to a lender.
        </p>
      </section>

      {snapshot ? (
        <DurationFlow
          onSelectPeriod={setSelectedPeriod}
          options={negotiationOptions}
          range={selectedRange}
        />
      ) : null}

      {snapshot && selectedRange ? (
        <InsightCharts
          options={negotiationOptions}
          range={selectedRange}
          snapshot={snapshot}
        />
      ) : null}

      <section className="panel">
        <div>
          <p className="eyebrow">Preview</p>
          <h2>Rate environment</h2>
          <p>
            State: <strong>{state.value}</strong>. The dashboard reads a public
            JSON snapshot from <code>{snapshotUrl}</code>.
          </p>
          <p>
            State machine complexity: max {maxOutgoingTransitions} outgoing
            transitions per state.
          </p>
          <dl className="complexity-list">
            {Object.entries(stateComplexity).map(([name, count]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          {state.value === "stale" ? <p>{state.reason}</p> : null}
          {state.value === "error" ? <p>{state.message}</p> : null}
          {state.value === "empty" ? (
            <p>No public dashboard rows were generated at {state.generatedAt}.</p>
          ) : null}
        </div>
        {snapshot ? <RatesPanel snapshot={snapshot} /> : <div className="chart" />}
      </section>

      {kpis ? <KpiGrid kpis={kpis} /> : null}
    </main>
  );
}

function marketPressureOption(
  snapshot: DashboardSnapshot,
  range: NegotiationRange,
) {
  return {
    animationDuration: 700,
    grid: { left: 42, right: 20, top: 34, bottom: 34 },
    legend: { top: 0 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: snapshot.rates.map((row) => row.date),
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: "{value}%" },
    },
    series: [
      {
        name: "Policy rate",
        type: "line",
        smooth: true,
        data: snapshot.rates.map((row) => row.policyRate),
      },
      {
        name: "5Y covered bond proxy",
        type: "line",
        smooth: true,
        data: snapshot.rates.map((row) => row.mortgageBond5y),
      },
      {
        name: `${range.option.periodLabelDisplay} target`,
        type: "line",
        symbol: "none",
        lineStyle: { type: "dashed", width: 2 },
        data: snapshot.rates.map(() => range.midpointRate),
      },
    ],
  };
}

function durationComparisonOption(
  options: NegotiationOption[],
  range: NegotiationRange,
) {
  return {
    animationDuration: 700,
    grid: { left: 42, right: 20, top: 34, bottom: 34 },
    legend: { top: 0 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: options.map((option) => option.periodLabelDisplay),
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: "{value}%" },
    },
    series: [
      {
        name: "Median listed",
        type: "bar",
        data: options.map((option) => option.medianListRate),
      },
      {
        name: "Negotiation target",
        type: "line",
        smooth: true,
        data: options.map((option) => deriveNegotiationRange(option).midpointRate),
      },
      {
        name: "Selected",
        type: "scatter",
        symbolSize: 18,
        data: options.map((option) =>
          option.periodLabel === range.option.periodLabel
            ? deriveNegotiationRange(option).midpointRate
            : null,
        ),
      },
    ],
  };
}

function fundingMarginOption(range: NegotiationRange) {
  const marginLow = range.floorRate - range.option.medianFundingCost;
  const marginHigh = range.ceilingRate - range.option.medianFundingCost;

  return {
    animationDuration: 700,
    grid: { left: 42, right: 20, top: 34, bottom: 34 },
    legend: { top: 0 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    xAxis: {
      type: "category",
      data: ["Floor", "Target", "Ceiling", "Median listed"],
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: "{value}%" },
    },
    series: [
      {
        name: "Funding proxy",
        type: "bar",
        stack: "rate",
        data: [
          range.option.medianFundingCost,
          range.option.medianFundingCost,
          range.option.medianFundingCost,
          range.option.medianFundingCost,
        ],
      },
      {
        name: "Margin room",
        type: "bar",
        stack: "rate",
        data: [
          marginLow,
          range.midpointRate - range.option.medianFundingCost,
          marginHigh,
          range.option.medianListRate - range.option.medianFundingCost,
        ],
      },
    ],
  };
}

function formatRate(value: number): string {
  return `${rateFormatter.format(value)}%`;
}

function formatDelta(delta: number | null): string {
  if (delta === null) return "n/a";
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${rateFormatter.format(delta)} pp`;
}

createRoot(document.getElementById("root")!).render(<App />);
