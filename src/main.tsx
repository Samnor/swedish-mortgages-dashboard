import React, { useEffect, useReducer } from "react";
import { createRoot } from "react-dom/client";
import ReactECharts from "echarts-for-react";
import {
  maxOutgoingTransitions,
  sampleSnapshot,
  stateComplexity,
  transition,
  type DashboardSnapshot,
} from "./dashboardMachine";
import "./styles.css";

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

function App() {
  const [state, dispatch] = useReducer(transition, { value: "idle" });

  useEffect(() => {
    dispatch({ type: "START" });
    dispatch({ type: "LOAD_SUCCEEDED", snapshot: sampleSnapshot });
  }, []);

  const snapshot =
    state.value === "ready" || state.value === "stale" ? state.snapshot : null;

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

      <section className="panel">
        <div>
          <p className="eyebrow">Preview</p>
          <h2>Rate environment</h2>
          <p>
            State: <strong>{state.value}</strong>. This shell uses sample data
            until the export job writes production JSON snapshots from the
            mortgage marts.
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

createRoot(document.getElementById("root")!).render(<App />);
