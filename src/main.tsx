import React from "react";
import { createRoot } from "react-dom/client";
import ReactECharts from "echarts-for-react";
import "./styles.css";

const sampleRates = [
  { date: "2026-04-20", policyRate: 2.25, mortgageBond5y: 2.71 },
  { date: "2026-04-21", policyRate: 2.25, mortgageBond5y: 2.73 },
  { date: "2026-04-22", policyRate: 2.25, mortgageBond5y: 2.7 },
  { date: "2026-04-23", policyRate: 2.25, mortgageBond5y: 2.69 },
  { date: "2026-04-24", policyRate: 2.25, mortgageBond5y: 2.68 }
];

function App() {
  const chartOption = {
    animationDuration: 700,
    grid: { left: 42, right: 24, top: 34, bottom: 34 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: sampleRates.map((row) => row.date)
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: "{value}%" }
    },
    series: [
      {
        name: "Policy rate",
        type: "line",
        smooth: true,
        data: sampleRates.map((row) => row.policyRate)
      },
      {
        name: "5Y mortgage bond",
        type: "line",
        smooth: true,
        data: sampleRates.map((row) => row.mortgageBond5y)
      }
    ]
  };

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
            This shell uses sample data until the export job writes production
            JSON snapshots from the mortgage marts.
          </p>
        </div>
        <ReactECharts option={chartOption} className="chart" />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
