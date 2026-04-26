import React, { useEffect, useReducer } from "react";
import { createRoot } from "react-dom/client";
import ReactECharts from "echarts-for-react";
import {
  deriveDashboardKpis,
  maxOutgoingTransitions,
  parseDashboardSnapshot,
  stateComplexity,
  transition,
  type DashboardKpis,
  type DashboardSnapshot,
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

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Swedish Mortgage Intelligence</p>
        <h1>Market context before you negotiate with a lender.</h1>
        <p>
          A lightweight public dashboard built from curated dbt/Athena outputs.
          Superset remains the deeper internal analysis tool.
        </p>
      </section>

      {kpis ? <KpiGrid kpis={kpis} /> : null}

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
    </main>
  );
}

function formatDelta(delta: number | null): string {
  if (delta === null) return "n/a";
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${rateFormatter.format(delta)} pp`;
}

createRoot(document.getElementById("root")!).render(<App />);
