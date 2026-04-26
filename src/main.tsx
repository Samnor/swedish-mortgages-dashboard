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
const localeStorageKey = "swedish-mortgages-dashboard.locale";

type Locale = "sv" | "en";

const copy = {
  sv: {
    appLabel: "Svensk bolånekoll",
    heroTitle: "Marknadsläge innan du förhandlar med banken.",
    heroBody:
      "Välj hur länge du funderar på att binda bolånet och få ett marknadsbaserat intervall att använda inför samtalet med banken.",
    languageLabel: "Språk",
    swedish: "Svenska",
    english: "English",
    rates: {
      policyRate: "Styrränta",
      mortgageBond5y: "5-årig bostadsobligation",
      mortgageBondProxy: "Proxy för säkerställd obligationsfinansiering",
      latestSourceDate: "Senaste källdatum",
      vs30dAgo: "mot 30 dagar sedan",
    },
    charts: {
      aria: "Diagram för bolåneförhandling",
      chart1: "Diagram 1",
      chart2: "Diagram 2",
      chart3: "Diagram 3",
      marketPressure: "Marknadstryck",
      marketPressureDescription:
        "Styrränta och säkerställd obligationsfinansiering bakom förhandlingsläget.",
      durationComparison: "Din bindningstid mot alternativen",
      durationComparisonDescription:
        "Bankernas medianräntor och målintervall över bindningstider.",
      fundingMargin: "Det du förhandlar om",
      fundingMarginDescription:
        "Separera finansieringsproxy från marginalutrymmet i observerade räntor.",
      coveredBondProxy: "5-årig säkerställd obligationsproxy",
      policyRate: "Styrränta",
      target: "mål",
      medianListed: "Median listad",
      negotiationTarget: "Förhandlingsmål",
      selected: "Vald",
      fundingProxy: "Finansieringsproxy",
      marginRoom: "Marginalutrymme",
      floor: "Golv",
      targetLabel: "Mål",
      ceiling: "Tak",
    },
    flow: {
      label: "Bolåneflöde",
      step1: "Steg 1",
      step2: "Steg 2",
      noDataTitle: "Ingen förhandlingsdata än.",
      noDataBody:
        "Appen har räntehistorik, men inga bindningstidsspecifika bankjämförelser i denna snapshot.",
      question: "Hur länge vill du binda bolånet?",
      body:
        "Välj bindningstiden du överväger. Intervallet nedan uppskattar ett realistiskt förhandlingsmål utifrån bankernas listräntor och marknadens finansieringsproxy.",
      negotiationRange: "förhandlingsintervall",
      rangeBodyStart: "Använd cirka",
      rangeBodyMiddle:
        "som första mål. Det är ungefär",
      rangeBodyEnd:
        "under medianlisträntan i denna bindningstid. Intervallet bygger på nedre till övre kvartil för listade räntor, inte på ett garanterat erbjudande.",
      medianListed: "Median listad",
      fundingProxy: "Finansieringsproxy",
      banksSampled: "Banker i urvalet",
    },
    diagnostics: {
      title: "Data- och appdiagnostik",
      state: "Tillstånd",
      reads: "Dashboarden läser en publik JSON-snapshot från",
      complexity:
        "State machine-komplexitet: max {count} utgående övergångar per tillstånd.",
      empty: "Inga publika dashboardrader genererades",
      unavailable: "saknas",
    },
  },
  en: {
    appLabel: "Swedish Mortgage Intelligence",
    heroTitle: "Market context before you negotiate with a lender.",
    heroBody:
      "Pick the binding period you are considering and get a market-informed range to use before talking to a lender.",
    languageLabel: "Language",
    swedish: "Svenska",
    english: "English",
    rates: {
      policyRate: "Policy rate",
      mortgageBond5y: "5Y mortgage bond",
      mortgageBondProxy: "Covered bond funding proxy",
      latestSourceDate: "Latest source date",
      vs30dAgo: "vs 30d ago",
    },
    charts: {
      aria: "Mortgage negotiation charts",
      chart1: "Chart 1",
      chart2: "Chart 2",
      chart3: "Chart 3",
      marketPressure: "Market pressure",
      marketPressureDescription:
        "Policy rate and covered-bond funding context behind the negotiation.",
      durationComparison: "Your duration against alternatives",
      durationComparisonDescription:
        "Median listed bank rates and target range across binding periods.",
      fundingMargin: "What you are haggling over",
      fundingMarginDescription:
        "Separates market funding proxy from the margin room implied by observed rates.",
      coveredBondProxy: "5Y covered bond proxy",
      policyRate: "Policy rate",
      target: "target",
      medianListed: "Median listed",
      negotiationTarget: "Negotiation target",
      selected: "Selected",
      fundingProxy: "Funding proxy",
      marginRoom: "Margin room",
      floor: "Floor",
      targetLabel: "Target",
      ceiling: "Ceiling",
    },
    flow: {
      label: "Mortgage flow",
      step1: "Step 1",
      step2: "Step 2",
      noDataTitle: "No negotiation data yet.",
      noDataBody:
        "The app has rate history, but no duration-specific bank comparison rows in this snapshot.",
      question: "How long do you want to bind your mortgage?",
      body:
        "Pick the duration you are considering. The range below estimates a realistic negotiation target from listed bank rates and market funding proxies.",
      negotiationRange: "negotiation range",
      rangeBodyStart: "Use around",
      rangeBodyMiddle:
        "as a starting target. That is roughly",
      rangeBodyEnd:
        "below the median listed rate in this duration bucket. The range is based on the lower-to-upper listed-rate quartiles, not a guaranteed offer.",
      medianListed: "Median listed",
      fundingProxy: "Funding proxy",
      banksSampled: "Banks sampled",
    },
    diagnostics: {
      title: "Data and app diagnostics",
      state: "State",
      reads: "The dashboard reads a public JSON snapshot from",
      complexity:
        "State machine complexity: max {count} outgoing transitions per state.",
      empty: "No public dashboard rows were generated at",
      unavailable: "n/a",
    },
  },
} satisfies Record<Locale, AppCopy>;

type AppCopy = {
  appLabel: string;
  heroTitle: string;
  heroBody: string;
  languageLabel: string;
  swedish: string;
  english: string;
  rates: Record<
    "policyRate" | "mortgageBond5y" | "mortgageBondProxy" | "latestSourceDate" | "vs30dAgo",
    string
  >;
  charts: Record<
    | "aria"
    | "chart1"
    | "chart2"
    | "chart3"
    | "marketPressure"
    | "marketPressureDescription"
    | "durationComparison"
    | "durationComparisonDescription"
    | "fundingMargin"
    | "fundingMarginDescription"
    | "coveredBondProxy"
    | "policyRate"
    | "target"
    | "medianListed"
    | "negotiationTarget"
    | "selected"
    | "fundingProxy"
    | "marginRoom"
    | "floor"
    | "targetLabel"
    | "ceiling",
    string
  >;
  flow: Record<
    | "label"
    | "step1"
    | "step2"
    | "noDataTitle"
    | "noDataBody"
    | "question"
    | "body"
    | "negotiationRange"
    | "rangeBodyStart"
    | "rangeBodyMiddle"
    | "rangeBodyEnd"
    | "medianListed"
    | "fundingProxy"
    | "banksSampled",
    string
  >;
  diagnostics: Record<
    "title" | "state" | "reads" | "complexity" | "empty" | "unavailable",
    string
  >;
};

function RatesPanel({
  labels,
  snapshot,
}: {
  labels: AppCopy["rates"];
  snapshot: DashboardSnapshot;
}) {
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
        name: labels.policyRate,
        type: "line",
        smooth: true,
        data: snapshot.rates.map((row) => row.policyRate),
      },
      {
        name: labels.mortgageBond5y,
        type: "line",
        smooth: true,
        data: snapshot.rates.map((row) => row.mortgageBond5y),
      },
    ],
  };

  return <ReactECharts option={chartOption} className="chart" />;
}

function InsightCharts({
  labels,
  options,
  range,
  snapshot,
}: {
  labels: AppCopy["charts"];
  options: NegotiationOption[];
  range: NegotiationRange;
  snapshot: DashboardSnapshot;
}) {
  return (
    <section className="insight-grid" aria-label={labels.aria}>
      <InsightChart
        eyebrow={labels.chart1}
        title={labels.marketPressure}
        description={labels.marketPressureDescription}
      >
        <ReactECharts
          option={marketPressureOption(snapshot, range, labels)}
          className="insight-chart"
        />
      </InsightChart>
      <InsightChart
        eyebrow={labels.chart2}
        title={labels.durationComparison}
        description={labels.durationComparisonDescription}
      >
        <ReactECharts
          option={durationComparisonOption(options, range, labels)}
          className="insight-chart"
        />
      </InsightChart>
      <InsightChart
        eyebrow={labels.chart3}
        title={labels.fundingMargin}
        description={labels.fundingMarginDescription}
      >
        <ReactECharts
          option={fundingMarginOption(range, labels)}
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

function KpiGrid({
  kpis,
  labels,
  locale,
}: {
  kpis: DashboardKpis;
  labels: AppCopy["rates"];
  locale: Locale;
}) {
  return (
    <section className="kpi-grid" aria-label="Mortgage market summary">
      <KpiCard
        label={labels.policyRate}
        value={formatRate(kpis.latestPolicyRate, locale)}
        detail={`${labels.latestSourceDate} ${kpis.latestDate}`}
        delta={kpis.policyRateChange30d}
        locale={locale}
        vsLabel={labels.vs30dAgo}
      />
      <KpiCard
        label={labels.mortgageBond5y}
        value={formatRate(kpis.latestMortgageBond5y, locale)}
        detail={labels.mortgageBondProxy}
        delta={kpis.mortgageBond5yChange30d}
        locale={locale}
        vsLabel={labels.vs30dAgo}
      />
    </section>
  );
}

function DurationFlow({
  labels,
  locale,
  options,
  onSelectPeriod,
  range,
}: {
  labels: AppCopy["flow"];
  locale: Locale;
  options: NegotiationOption[];
  onSelectPeriod: (period: string) => void;
  range: NegotiationRange | null;
}) {
  if (!range) {
    return (
      <section className="flow-panel">
        <p className="eyebrow">{labels.label}</p>
        <h2>{labels.noDataTitle}</h2>
        <p>{labels.noDataBody}</p>
      </section>
    );
  }

  return (
    <section className="flow-panel">
      <div>
        <p className="eyebrow">{labels.step1}</p>
        <h2>{labels.question}</h2>
        <p>{labels.body}</p>
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
      <NegotiationRangePanel labels={labels} locale={locale} range={range} />
    </section>
  );
}

function NegotiationRangePanel({
  labels,
  locale,
  range,
}: {
  labels: AppCopy["flow"];
  locale: Locale;
  range: NegotiationRange;
}) {
  return (
    <article className="range-card">
      <p className="eyebrow">{labels.step2}</p>
      <h2>
        {range.option.periodLabelDisplay} {labels.negotiationRange}
      </h2>
      <div className="range-value">
        {formatRate(range.floorRate, locale)}-{formatRate(range.ceilingRate, locale)}
      </div>
      <p>
        {labels.rangeBodyStart}{" "}
        <strong>{formatRate(range.midpointRate, locale)}</strong>{" "}
        {labels.rangeBodyMiddle}{" "}
        <strong>{formatDelta(range.discountFromMedianListRate, locale)}</strong>{" "}
        {labels.rangeBodyEnd}
      </p>
      <dl className="range-details">
        <div>
          <dt>{labels.medianListed}</dt>
          <dd>{formatRate(range.option.medianListRate, locale)}</dd>
        </div>
        <div>
          <dt>{labels.fundingProxy}</dt>
          <dd>{formatRate(range.option.medianFundingCost, locale)}</dd>
        </div>
        <div>
          <dt>{labels.banksSampled}</dt>
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
  locale,
  vsLabel,
}: {
  label: string;
  value: string;
  detail: string;
  delta: number | null;
  locale: Locale;
  vsLabel: string;
}) {
  return (
    <article className="kpi-card">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
      <span className="delta">
        {formatDelta(delta, locale)} {vsLabel}
      </span>
    </article>
  );
}

function App() {
  const [state, dispatch] = useReducer(transition, { value: "idle" });
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>(() => storedLocale() ?? browserLocale());
  const labels = copy[locale];

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

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (storedLocale()) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1500);

    async function detectLocale() {
      const detectedLocale = await detectLocaleFromIp(controller.signal);
      if (detectedLocale) {
        setLocale(detectedLocale);
      }
    }

    void detectLocale().finally(() => window.clearTimeout(timeout));

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  function chooseLocale(nextLocale: Locale) {
    window.localStorage.setItem(localeStorageKey, nextLocale);
    setLocale(nextLocale);
  }

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
      <div className="language-toggle" aria-label={labels.languageLabel}>
        <span>{labels.languageLabel}</span>
        <button
          aria-pressed={locale === "sv"}
          className="language-button"
          onClick={() => chooseLocale("sv")}
          type="button"
        >
          {labels.swedish}
        </button>
        <button
          aria-pressed={locale === "en"}
          className="language-button"
          onClick={() => chooseLocale("en")}
          type="button"
        >
          {labels.english}
        </button>
      </div>
      <section className="hero">
        <p className="eyebrow">{labels.appLabel}</p>
        <h1>{labels.heroTitle}</h1>
        <p>{labels.heroBody}</p>
      </section>

      {snapshot ? (
        <DurationFlow
          labels={labels.flow}
          locale={locale}
          onSelectPeriod={setSelectedPeriod}
          options={negotiationOptions}
          range={selectedRange}
        />
      ) : null}

      {snapshot && selectedRange ? (
        <InsightCharts
          labels={labels.charts}
          options={negotiationOptions}
          range={selectedRange}
          snapshot={snapshot}
        />
      ) : null}

      <section className="panel diagnostics-panel">
        <div>
          <details>
            <summary>{labels.diagnostics.title}</summary>
            <p>
              {labels.diagnostics.state}: <strong>{state.value}</strong>.{" "}
              {labels.diagnostics.reads} <code>{snapshotUrl}</code>.
            </p>
            <p>
              {labels.diagnostics.complexity.replace(
                "{count}",
                String(maxOutgoingTransitions),
              )}
            </p>
            <dl className="complexity-list">
              {Object.entries(stateComplexity).map(([name, count]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
          </details>
          {state.value === "stale" ? <p>{state.reason}</p> : null}
          {state.value === "error" ? <p>{state.message}</p> : null}
          {state.value === "empty" ? (
            <p>
              {labels.diagnostics.empty} {state.generatedAt}.
            </p>
          ) : null}
        </div>
        {snapshot ? (
          <RatesPanel labels={labels.rates} snapshot={snapshot} />
        ) : (
          <div className="chart" />
        )}
      </section>

      {kpis ? <KpiGrid kpis={kpis} labels={labels.rates} locale={locale} /> : null}
    </main>
  );
}

function marketPressureOption(
  snapshot: DashboardSnapshot,
  range: NegotiationRange,
  labels: AppCopy["charts"],
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
        name: labels.policyRate,
        type: "line",
        smooth: true,
        data: snapshot.rates.map((row) => row.policyRate),
      },
      {
        name: labels.coveredBondProxy,
        type: "line",
        smooth: true,
        data: snapshot.rates.map((row) => row.mortgageBond5y),
      },
      {
        name: `${range.option.periodLabelDisplay} ${labels.target}`,
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
  labels: AppCopy["charts"],
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
        name: labels.medianListed,
        type: "bar",
        data: options.map((option) => option.medianListRate),
      },
      {
        name: labels.negotiationTarget,
        type: "line",
        smooth: true,
        data: options.map((option) => deriveNegotiationRange(option).midpointRate),
      },
      {
        name: labels.selected,
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

function fundingMarginOption(range: NegotiationRange, labels: AppCopy["charts"]) {
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
      data: [
        labels.floor,
        labels.targetLabel,
        labels.ceiling,
        labels.medianListed,
      ],
    },
    yAxis: {
      type: "value",
      axisLabel: { formatter: "{value}%" },
    },
    series: [
      {
        name: labels.fundingProxy,
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
        name: labels.marginRoom,
        type: "bar",
        stack: "rate",
        data: [
          Math.max(0, marginLow),
          Math.max(0, range.midpointRate - range.option.medianFundingCost),
          Math.max(0, marginHigh),
          Math.max(0, range.option.medianListRate - range.option.medianFundingCost),
        ],
      },
    ],
  };
}

function numberFormatter(locale: Locale) {
  return new Intl.NumberFormat(locale === "sv" ? "sv-SE" : "en-SE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatRate(value: number, locale: Locale): string {
  return `${numberFormatter(locale).format(value)}%`;
}

function formatDelta(delta: number | null, locale: Locale): string {
  if (delta === null) return copy[locale].diagnostics.unavailable;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${numberFormatter(locale).format(delta)} pp`;
}

function browserLocale(): Locale {
  return navigator.language.toLowerCase().startsWith("sv") ? "sv" : "en";
}

function storedLocale(): Locale | null {
  const savedLocale = window.localStorage.getItem(localeStorageKey);
  return savedLocale === "sv" || savedLocale === "en" ? savedLocale : null;
}

async function detectLocaleFromIp(signal: AbortSignal): Promise<Locale | null> {
  try {
    const response = await fetch("https://ipapi.co/country/", {
      cache: "no-store",
      signal,
    });
    if (!response.ok) return null;
    const countryCode = (await response.text()).trim().toUpperCase();
    return countryCode === "SE" ? "sv" : "en";
  } catch {
    return null;
  }
}

createRoot(document.getElementById("root")!).render(<App />);
