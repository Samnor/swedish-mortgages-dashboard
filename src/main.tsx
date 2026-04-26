import React, { useEffect, useReducer, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  confidenceForBankCount,
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
  type SourceLink,
  type ConfidenceLevel,
} from "./dashboardMachine";
import "./styles.css";

const snapshotUrl = `${import.meta.env.BASE_URL}data/latest.json`;
const localeUrl = `${import.meta.env.BASE_URL}locale.json`;
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
      waitingTitle: "Välj en bindningstid för att se ett startintervall.",
      waitingBody:
        "Vi visar inte ett förvalt råd. Välj först hur länge du funderar på att binda lånet, så räknar appen fram ett intervall och rätt diagram för just den tiden.",
      question: "Hur länge vill du binda bolånet?",
      body:
        "Välj bindningstiden du överväger. Intervallet nedan är en startpunkt för samtalet, baserad på bankernas listräntor och marknadens finansieringsproxy.",
      negotiationRange: "startintervall",
      rangeBodyStart: "Använd cirka",
      rangeBodyMiddle:
        "som första samtalsmål. Det är ungefär",
      rangeBodyEnd:
        "under medianlisträntan i denna bindningstid. Intervallet är inte ett garanterat erbjudande.",
      medianListed: "Median listad",
      fundingProxy: "Finansieringsproxy",
      banksSampled: "Banker i urvalet",
      latestMarketDate: "Senaste marknadsdatum",
      confidence: "Tillförlitlighet",
      highConfidence: "Hög",
      mediumConfidence: "Medel",
      lowConfidence: "Låg",
      lowConfidenceNote:
        "Få banker i urvalet. Använd intervallet som grov signal, inte som stark marknadsnivå.",
      assumptionNote:
        "Bygger på listräntor, säkerställda obligationsproxys och en enkel marginalmodell. Faktiska kundrabatter kan avvika.",
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
    sources: {
      title: "Källor bakom datapunkterna",
      body:
        "Länkarna går till de publika källor och referenser som används för räntor, bankjämförelser och marginalkontext.",
      empty: "Inga publika källänkar finns i denna snapshot.",
      usedFor: "Används för",
    },
    pipeline: {
      eyebrow: "Under huven",
      title: "Så blir rådata till ett beslutsunderlag",
      body:
        "Den här appen är också ett exempel på data engineering: råa publika källor modelleras i dbt, kontrolleras i CI och exporteras som en liten publik JSON-snapshot som är billig att serva.",
      cta: "Visa dbt-pipelinen",
      close: "Tillbaka till appen",
      caseStudyTitle: "Data engineering-case: bolånedata som produkt",
      caseStudyBody:
        "Det här läget lämnar bolåneflödet och visar arkitekturen bakom produkten: lagerindelning, kvalitetsgrindar, publiceringskontrakt och hur en dyr analytisk backend görs om till en billig statisk dataprodukt.",
      architectureLabel: "Pipeline-DAG",
      controlsLabel: "Kontroller",
      handoffLabel: "Produktkontrakt",
      metrics: [
        { label: "Publik runtime", value: "S3 + CloudFront" },
        { label: "Appkontrakt", value: "latest.json" },
        { label: "Lokal komplexitet", value: "max 3" },
      ],
      controls: [
        "Källänkar måste följa med publika datapunkter.",
        "Tidsserier måste vara sorterade innan appen bygger diagram.",
        "Kvartiler och marginaler valideras innan snapshoten laddas upp.",
      ],
      steps: [
        {
          title: "1. Rådata landar i data lake",
          body:
            "Riksbankens räntor, SCB-data och bankernas publicerade listräntor samlas i separata råtabeller.",
        },
        {
          title: "2. dbt städar och modellerar",
          body:
            "Staging-modeller typkonverterar och deduplicerar. Mart-modeller bygger räntedag, bankjämförelser och finansieringsproxy.",
        },
        {
          title: "3. CI och kontrakt skyddar appen",
          body:
            "Validatorn kräver sorterade tidsserier, rimliga kvartiler, källänkar och icke-tomma förhandlingsalternativ.",
        },
        {
          title: "4. Appen får bara en kuraterad snapshot",
          body:
            "Publika användare frågar aldrig Athena. GitHub Actions exporterar en kompakt JSON-fil till S3 och CloudFront.",
        },
      ],
    },
    fundingIntro: {
      eyebrow: "Innan du väljer bindningstid",
      title: "Så finansierar banken ditt bolån, förenklat",
      body:
        "När en bank lånar ut pengar till ett bolån använder den inte bara pengar som redan ligger på sparkonton. Banken lånar också själv på marknaden, ofta genom säkerställda obligationer där många bolån ligger som säkerhet. Din ränta behöver därför täcka bankens egen finansieringskostnad, kostnaden för risk och drift, samt bankens marginal.",
      points: [
        {
          title: "Kort bindningstid följer marknadsräntan snabbare",
          body:
            "Rörliga och korta bolån påverkas mer direkt av styrräntan och korta marknadsräntor.",
        },
        {
          title: "Längre bindningstid prissätts mer som längre upplåning",
          body:
            "Bundna bolån påverkas mer av obligationsräntor och vad investerare kräver för att låna ut pengar under flera år.",
        },
        {
          title: "Förhandling handlar om marginalen",
          body:
            "Banken kan sällan trolla bort sin finansieringskostnad, men den kan ibland acceptera lägre marginal om du är en attraktiv kund.",
        },
      ],
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
      waitingTitle: "Pick a binding period to see a starting range.",
      waitingBody:
        "The app does not show a default recommendation. Choose the period you are considering first, then it calculates the range and charts for that period.",
      question: "How long do you want to bind your mortgage?",
      body:
        "Pick the duration you are considering. The range below is a starting point for the conversation, based on listed bank rates and market funding proxies.",
      negotiationRange: "starting range",
      rangeBodyStart: "Use around",
      rangeBodyMiddle:
        "as an opening target. That is roughly",
      rangeBodyEnd:
        "below the median listed rate in this duration bucket. The range is not a guaranteed offer.",
      medianListed: "Median listed",
      fundingProxy: "Funding proxy",
      banksSampled: "Banks sampled",
      latestMarketDate: "Latest market date",
      confidence: "Confidence",
      highConfidence: "High",
      mediumConfidence: "Medium",
      lowConfidence: "Low",
      lowConfidenceNote:
        "Few banks in the sample. Use the range as a rough signal, not a strong market level.",
      assumptionNote:
        "Based on listed rates, covered-bond proxies and a simple margin model. Actual customer discounts can differ.",
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
    sources: {
      title: "Sources behind the data points",
      body:
        "These links point to the public sources and references used for rates, bank comparisons and margin context.",
      empty: "No public source links are included in this snapshot.",
      usedFor: "Used for",
    },
    pipeline: {
      eyebrow: "Under the hood",
      title: "How raw data becomes a decision aid",
      body:
        "This app is also a data engineering case study: public raw sources are modeled in dbt, checked in CI and exported as a small public JSON snapshot that is cheap to serve.",
      cta: "Show the dbt pipeline",
      close: "Back to the app",
      caseStudyTitle: "Data engineering case: mortgage data as a product",
      caseStudyBody:
        "This state leaves the mortgage flow and shows the product architecture behind it: layered modeling, quality gates, publishing contracts and how an expensive analytical backend becomes a cheap static data product.",
      architectureLabel: "Pipeline DAG",
      controlsLabel: "Controls",
      handoffLabel: "Product contract",
      metrics: [
        { label: "Public runtime", value: "S3 + CloudFront" },
        { label: "App contract", value: "latest.json" },
        { label: "Local complexity", value: "max 3" },
      ],
      controls: [
        "Source links must travel with public data points.",
        "Time series must be sorted before the app renders charts.",
        "Quantiles and margins are validated before the snapshot is uploaded.",
      ],
      steps: [
        {
          title: "1. Raw data lands in the data lake",
          body:
            "Riksbank rates, SCB data and bank published list rates land in separate raw tables.",
        },
        {
          title: "2. dbt cleans and models",
          body:
            "Staging models type and deduplicate data. Mart models produce daily rates, bank comparisons and funding proxies.",
        },
        {
          title: "3. CI and contracts protect the app",
          body:
            "The validator requires sorted time series, ordered quantiles, source links and non-empty negotiation options.",
        },
        {
          title: "4. The app gets only a curated snapshot",
          body:
            "Public users never query Athena. GitHub Actions exports compact JSON to S3 and CloudFront.",
        },
      ],
    },
    fundingIntro: {
      eyebrow: "Before you pick a binding period",
      title: "How banks fund your mortgage, in plain language",
      body:
        "When a bank lends money for a mortgage, it does not only use money already sitting in savings accounts. The bank also borrows in financial markets, often through covered bonds backed by pools of mortgages. Your interest rate therefore has to cover the bank's own funding cost, risk and operating costs, plus the bank's margin.",
      points: [
        {
          title: "Short binding periods move faster with market rates",
          body:
            "Variable and short mortgages are more directly affected by the policy rate and short market rates.",
        },
        {
          title: "Longer binding periods are priced more like longer borrowing",
          body:
            "Fixed mortgages are affected more by bond yields and what investors demand to lend money for several years.",
        },
        {
          title: "Negotiation is mostly about the margin",
          body:
            "The bank usually cannot remove its funding cost, but it may accept a lower margin if you are an attractive customer.",
        },
      ],
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
    | "waitingTitle"
    | "waitingBody"
    | "question"
    | "body"
    | "negotiationRange"
    | "rangeBodyStart"
    | "rangeBodyMiddle"
    | "rangeBodyEnd"
    | "medianListed"
    | "fundingProxy"
    | "banksSampled"
    | "latestMarketDate"
    | "confidence"
    | "highConfidence"
    | "mediumConfidence"
    | "lowConfidence"
    | "lowConfidenceNote"
    | "assumptionNote",
    string
  >;
  diagnostics: Record<
    "title" | "state" | "reads" | "complexity" | "empty" | "unavailable",
    string
  >;
  sources: Record<"title" | "body" | "empty" | "usedFor", string>;
  pipeline: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    close: string;
    caseStudyTitle: string;
    caseStudyBody: string;
    architectureLabel: string;
    controlsLabel: string;
    handoffLabel: string;
    metrics: Array<{ label: string; value: string }>;
    controls: string[];
    steps: Array<{ title: string; body: string }>;
  };
  fundingIntro: {
    eyebrow: string;
    title: string;
    body: string;
    points: Array<{ title: string; body: string }>;
  };
};

function RatesPanel({
  labels,
  locale,
  snapshot,
}: {
  labels: AppCopy["rates"];
  locale: Locale;
  snapshot: DashboardSnapshot;
}) {
  return (
    <LineChart
      ariaLabel={`${labels.policyRate}, ${labels.mortgageBond5y}`}
      className="chart"
      locale={locale}
      series={[
        {
          label: labels.policyRate,
          values: snapshot.rates.map((row) => row.policyRate),
          color: "#743a22",
        },
        {
          label: labels.mortgageBond5y,
          values: snapshot.rates.map((row) => row.mortgageBond5y),
          color: "#2d5f5d",
        },
      ]}
      xLabels={snapshot.rates.map((row) => row.date)}
    />
  );
}

function InsightCharts({
  labels,
  locale,
  options,
  range,
  snapshot,
}: {
  labels: AppCopy["charts"];
  locale: Locale;
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
        <MarketPressureChart
          labels={labels}
          locale={locale}
          range={range}
          snapshot={snapshot}
        />
      </InsightChart>
      <InsightChart
        eyebrow={labels.chart2}
        title={labels.durationComparison}
        description={labels.durationComparisonDescription}
      >
        <DurationComparisonChart
          labels={labels}
          locale={locale}
          options={options}
          range={range}
        />
      </InsightChart>
      <InsightChart
        eyebrow={labels.chart3}
        title={labels.fundingMargin}
        description={labels.fundingMarginDescription}
      >
        <FundingMarginChart labels={labels} locale={locale} range={range} />
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

function SourceLinksPanel({
  labels,
  sources,
}: {
  labels: AppCopy["sources"];
  sources: SourceLink[];
}) {
  return (
    <section className="source-panel">
      <div>
        <p className="eyebrow">{labels.title}</p>
        <p>{sources.length > 0 ? labels.body : labels.empty}</p>
      </div>
      {sources.length > 0 ? (
        <div className="source-grid">
          {sources.map((source) => (
            <a
              className="source-link"
              href={source.url}
              key={source.id}
              rel="noreferrer"
              target="_blank"
            >
              <strong>{source.label}</strong>
              <span>
                {labels.usedFor}: {source.usedFor}
              </span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FundingIntro({ labels }: { labels: AppCopy["fundingIntro"] }) {
  return (
    <section className="funding-intro">
      <div>
        <p className="eyebrow">{labels.eyebrow}</p>
        <h2>{labels.title}</h2>
        <p>{labels.body}</p>
      </div>
      <div className="funding-points">
        {labels.points.map((point) => (
          <article className="funding-point" key={point.title}>
            <strong>{point.title}</strong>
            <span>{point.body}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function PipelinePanel({
  labels,
  snapshot,
  onClose,
}: {
  labels: AppCopy["pipeline"];
  snapshot: DashboardSnapshot;
  onClose: () => void;
}) {
  const exportedRows = snapshot.rates.length + snapshot.negotiationOptions.length;

  return (
    <main className="pipeline-screen">
      <button className="secondary-button pipeline-back" onClick={onClose} type="button">
        {labels.close}
      </button>
      <section className="pipeline-hero">
        <div>
          <p className="eyebrow">{labels.eyebrow}</p>
          <h1>{labels.caseStudyTitle}</h1>
          <p>{labels.caseStudyBody}</p>
        </div>
        <dl className="pipeline-metrics">
          {labels.metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
          <div>
            <dt>{labels.handoffLabel}</dt>
            <dd>{exportedRows} rows</dd>
          </div>
        </dl>
      </section>

      <section className="pipeline-workbench" aria-label={labels.architectureLabel}>
        <div className="pipeline-rail">
          <p className="eyebrow">{labels.architectureLabel}</p>
          <div className="pipeline-node raw">raw</div>
          <div className="pipeline-arrow" />
          <div className="pipeline-node stage">stg</div>
          <div className="pipeline-arrow" />
          <div className="pipeline-node mart">mart</div>
          <div className="pipeline-arrow" />
          <div className="pipeline-node publish">json</div>
        </div>
        <div className="pipeline-steps pipeline-steps-dag">
          {labels.steps.map((step) => (
            <article className="pipeline-step" key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.body}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="pipeline-contract">
        <div>
          <p className="eyebrow">{labels.controlsLabel}</p>
          <h2>{labels.title}</h2>
          <p>{labels.body}</p>
        </div>
        <ul>
          {labels.controls.map((control) => (
            <li key={control}>{control}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function PipelineTeaser({
  labels,
  onOpen,
}: {
  labels: AppCopy["pipeline"];
  onOpen: () => void;
}) {
  return (
    <section className="pipeline-teaser">
      <div>
        <p className="eyebrow">{labels.eyebrow}</p>
        <h2>{labels.title}</h2>
        <p>{labels.body}</p>
      </div>
      <button className="secondary-button" onClick={onOpen} type="button">
        {labels.cta}
      </button>
    </section>
  );
}

function DurationFlow({
  labels,
  locale,
  latestDate,
  options,
  onSelectPeriod,
  range,
}: {
  labels: AppCopy["flow"];
  locale: Locale;
  latestDate: string | null;
  options: NegotiationOption[];
  onSelectPeriod: (period: string) => void;
  range: NegotiationRange | null;
}) {
  if (options.length === 0) {
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
              aria-pressed={option.periodLabel === range?.option.periodLabel}
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
      {range ? (
        <NegotiationRangePanel
          labels={labels}
          latestDate={latestDate}
          locale={locale}
          range={range}
        />
      ) : (
        <article className="range-card range-card-empty">
          <p className="eyebrow">{labels.step2}</p>
          <h2>{labels.waitingTitle}</h2>
          <p>{labels.waitingBody}</p>
        </article>
      )}
    </section>
  );
}

function NegotiationRangePanel({
  labels,
  latestDate,
  locale,
  range,
}: {
  labels: AppCopy["flow"];
  latestDate: string | null;
  locale: Locale;
  range: NegotiationRange;
}) {
  const confidence = confidenceForBankCount(range.option.bankCount);

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
      <p className="assumption-note">{labels.assumptionNote}</p>
      {confidence === "low" ? (
        <p className="confidence-warning">{labels.lowConfidenceNote}</p>
      ) : null}
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
        <div>
          <dt>{labels.confidence}</dt>
          <dd>{confidenceLabel(labels, confidence)}</dd>
        </div>
        <div>
          <dt>{labels.latestMarketDate}</dt>
          <dd>{latestDate ?? copy[locale].diagnostics.unavailable}</dd>
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
      const detectedLocale = await detectLocaleFromEdge(controller.signal);
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
    state.value === "ready" ||
    state.value === "stale" ||
    state.value === "pipeline_inspection"
      ? state.snapshot
      : null;
  const kpis = snapshot ? deriveDashboardKpis(snapshot) : null;
  const negotiationOptions = snapshot?.negotiationOptions ?? [];
  const selectedOption =
    negotiationOptions.find((option) => option.periodLabel === selectedPeriod) ??
    null;
  const selectedRange = selectedOption
    ? deriveNegotiationRange(selectedOption)
    : null;

  if (state.value === "pipeline_inspection") {
    return (
      <PipelinePanel
        labels={labels.pipeline}
        onClose={() => dispatch({ type: "CLOSE_PIPELINE" })}
        snapshot={state.snapshot}
      />
    );
  }

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

      <FundingIntro labels={labels.fundingIntro} />

      {kpis ? <KpiGrid kpis={kpis} labels={labels.rates} locale={locale} /> : null}

      {snapshot ? (
        <DurationFlow
          labels={labels.flow}
          latestDate={kpis?.latestDate ?? null}
          locale={locale}
          onSelectPeriod={setSelectedPeriod}
          options={negotiationOptions}
          range={selectedRange}
        />
      ) : null}

      {snapshot && selectedRange ? (
        <InsightCharts
          labels={labels.charts}
          locale={locale}
          options={negotiationOptions}
          range={selectedRange}
          snapshot={snapshot}
        />
      ) : null}

      {snapshot && state.value === "ready" ? (
        <PipelineTeaser
          labels={labels.pipeline}
          onOpen={() => dispatch({ type: "VIEW_PIPELINE" })}
        />
      ) : null}

      {snapshot ? (
        <SourceLinksPanel
          labels={labels.sources}
          sources={snapshot.sourceLinks}
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
          <RatesPanel labels={labels.rates} locale={locale} snapshot={snapshot} />
        ) : (
          <div className="chart" />
        )}
      </section>
    </main>
  );
}

function MarketPressureChart({
  labels,
  locale,
  range,
  snapshot,
}: {
  labels: AppCopy["charts"];
  locale: Locale;
  range: NegotiationRange;
  snapshot: DashboardSnapshot;
}) {
  return (
    <LineChart
      ariaLabel={labels.marketPressure}
      className="insight-chart"
      locale={locale}
      series={[
        {
          label: labels.policyRate,
          values: snapshot.rates.map((row) => row.policyRate),
          color: "#743a22",
        },
        {
          label: labels.coveredBondProxy,
          values: snapshot.rates.map((row) => row.mortgageBond5y),
          color: "#2d5f5d",
        },
        {
          dashed: true,
          label: `${range.option.periodLabelDisplay} ${labels.target}`,
          values: snapshot.rates.map(() => range.midpointRate),
          color: "#d08a24",
        },
      ]}
      xLabels={snapshot.rates.map((row) => row.date)}
    />
  );
}

function DurationComparisonChart({
  labels,
  locale,
  options,
  range,
}: {
  labels: AppCopy["charts"];
  locale: Locale;
  options: NegotiationOption[];
  range: NegotiationRange;
}) {
  const targetValues = options.map((option) =>
    deriveNegotiationRange(option).midpointRate,
  );

  return (
    <BarLineChart
      ariaLabel={labels.durationComparison}
      bars={{
        label: labels.medianListed,
        values: options.map((option) => option.medianListRate),
        color: "#d7c3a2",
      }}
      line={{
        label: labels.negotiationTarget,
        values: targetValues,
        color: "#743a22",
      }}
      locale={locale}
      selectedIndex={options.findIndex(
        (option) => option.periodLabel === range.option.periodLabel,
      )}
      selectedLabel={labels.selected}
      xLabels={options.map((option) => option.periodLabelDisplay)}
    />
  );
}

function FundingMarginChart({
  labels,
  locale,
  range,
}: {
  labels: AppCopy["charts"];
  locale: Locale;
  range: NegotiationRange;
}) {
  const fundingCost = range.option.medianFundingCost;
  const totalValues = [
    range.floorRate,
    range.midpointRate,
    range.ceilingRate,
    range.option.medianListRate,
  ];
  const marginValues = totalValues.map((value) =>
    Math.max(0, value - fundingCost),
  );

  return (
    <StackedBarChart
      ariaLabel={labels.fundingMargin}
      base={{
        label: labels.fundingProxy,
        values: totalValues.map(() => fundingCost),
        color: "#2d5f5d",
      }}
      locale={locale}
      stack={{
        label: labels.marginRoom,
        values: marginValues,
        color: "#d08a24",
      }}
      xLabels={[
        labels.floor,
        labels.targetLabel,
        labels.ceiling,
        labels.medianListed,
      ]}
    />
  );
}

function LineChart({
  ariaLabel,
  className,
  locale,
  series,
  xLabels,
}: {
  ariaLabel: string;
  className: string;
  locale: Locale;
  series: Array<{
    color: string;
    dashed?: boolean;
    label: string;
    values: number[];
  }>;
  xLabels: string[];
}) {
  const geometry = chartGeometry(series.flatMap((item) => item.values));

  return (
    <figure className={className} aria-label={ariaLabel}>
      <svg
        className="svg-chart"
        role="img"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      >
        <ChartGrid geometry={geometry} locale={locale} />
        {series.map((item) => (
          <path
            className="chart-line"
            d={linePath(item.values, geometry)}
            fill="none"
            key={item.label}
            stroke={item.color}
            strokeDasharray={item.dashed ? "6 6" : undefined}
          />
        ))}
        <XAxisLabels geometry={geometry} labels={xLabels} />
      </svg>
      <ChartLegend series={series} />
    </figure>
  );
}

function BarLineChart({
  ariaLabel,
  bars,
  line,
  locale,
  selectedIndex,
  selectedLabel,
  xLabels,
}: {
  ariaLabel: string;
  bars: { color: string; label: string; values: number[] };
  line: { color: string; label: string; values: number[] };
  locale: Locale;
  selectedIndex: number;
  selectedLabel: string;
  xLabels: string[];
}) {
  const geometry = chartGeometry([...bars.values, ...line.values]);
  const barWidth = Math.max(14, geometry.plotWidth / bars.values.length / 2.6);

  return (
    <figure className="insight-chart" aria-label={ariaLabel}>
      <svg
        className="svg-chart"
        role="img"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      >
        <ChartGrid geometry={geometry} locale={locale} />
        {bars.values.map((value, index) => {
          const x = xForIndex(index, bars.values.length, geometry) - barWidth / 2;
          const y = yForValue(value, geometry);
          return (
            <rect
              className="chart-bar"
              fill={bars.color}
              height={geometry.bottom - y}
              key={`${xLabels[index]}-${value}`}
              rx="4"
              width={barWidth}
              x={x}
              y={y}
            />
          );
        })}
        <path
          className="chart-line"
          d={linePath(line.values, geometry)}
          fill="none"
          stroke={line.color}
        />
        {selectedIndex >= 0 ? (
          <circle
            className="chart-point"
            cx={xForIndex(selectedIndex, line.values.length, geometry)}
            cy={yForValue(line.values[selectedIndex], geometry)}
            fill="#17211f"
            r="5"
          />
        ) : null}
        <XAxisLabels geometry={geometry} labels={xLabels} />
      </svg>
      <ChartLegend
        series={[
          { color: bars.color, label: bars.label },
          { color: line.color, label: line.label },
          { color: "#17211f", label: selectedLabel },
        ]}
      />
    </figure>
  );
}

function StackedBarChart({
  ariaLabel,
  base,
  locale,
  stack,
  xLabels,
}: {
  ariaLabel: string;
  base: { color: string; label: string; values: number[] };
  locale: Locale;
  stack: { color: string; label: string; values: number[] };
  xLabels: string[];
}) {
  const totals = base.values.map((value, index) => value + stack.values[index]);
  const geometry = chartGeometry(totals);
  const barWidth = Math.max(20, geometry.plotWidth / totals.length / 2.4);

  return (
    <figure className="insight-chart" aria-label={ariaLabel}>
      <svg
        className="svg-chart"
        role="img"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      >
        <ChartGrid geometry={geometry} locale={locale} />
        {totals.map((total, index) => {
          const x = xForIndex(index, totals.length, geometry) - barWidth / 2;
          const baseTop = yForValue(base.values[index], geometry);
          const stackTop = yForValue(total, geometry);
          return (
            <g key={`${xLabels[index]}-${total}`}>
              <rect
                className="chart-bar"
                fill={base.color}
                height={geometry.bottom - baseTop}
                rx="4"
                width={barWidth}
                x={x}
                y={baseTop}
              />
              <rect
                className="chart-bar"
                fill={stack.color}
                height={baseTop - stackTop}
                rx="4"
                width={barWidth}
                x={x}
                y={stackTop}
              />
            </g>
          );
        })}
        <XAxisLabels geometry={geometry} labels={xLabels} />
      </svg>
      <ChartLegend
        series={[
          { color: base.color, label: base.label },
          { color: stack.color, label: stack.label },
        ]}
      />
    </figure>
  );
}

type ChartGeometry = {
  bottom: number;
  height: number;
  left: number;
  max: number;
  min: number;
  plotHeight: number;
  plotWidth: number;
  right: number;
  top: number;
  width: number;
};

function chartGeometry(values: number[]): ChartGeometry {
  const finiteValues = values.filter(Number.isFinite);
  const minValue = Math.min(...finiteValues);
  const maxValue = Math.max(...finiteValues);
  const padding = Math.max(0.15, (maxValue - minValue) * 0.16);
  const min = Math.max(0, minValue - padding);
  const max = maxValue + padding;
  const width = 640;
  const height = 300;
  const left = 46;
  const right = 18;
  const top = 18;
  const bottom = 248;

  return {
    bottom,
    height,
    left,
    max,
    min,
    plotHeight: bottom - top,
    plotWidth: width - left - right,
    right,
    top,
    width,
  };
}

function ChartGrid({
  geometry,
  locale,
}: {
  geometry: ChartGeometry;
  locale: Locale;
}) {
  const ticks = [0, 0.5, 1].map(
    (ratio) => geometry.min + (geometry.max - geometry.min) * ratio,
  );

  return (
    <g className="chart-grid">
      {ticks.map((tick) => {
        const y = yForValue(tick, geometry);
        return (
          <g key={tick}>
            <line
              x1={geometry.left}
              x2={geometry.width - geometry.right}
              y1={y}
              y2={y}
            />
            <text x={geometry.left - 8} y={y + 4}>
              {formatRate(tick, locale)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function XAxisLabels({
  geometry,
  labels,
}: {
  geometry: ChartGeometry;
  labels: string[];
}) {
  if (labels.length === 0) return null;
  const indexes = Array.from(
    new Set([0, Math.floor((labels.length - 1) / 2), labels.length - 1]),
  );

  return (
    <g className="chart-axis-labels">
      {indexes.map((index) => (
        <text
          key={`${labels[index]}-${index}`}
          textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
          x={xForIndex(index, labels.length, geometry)}
          y={geometry.bottom + 28}
        >
          {labels[index]}
        </text>
      ))}
    </g>
  );
}

function ChartLegend({
  series,
}: {
  series: Array<{ color: string; label: string }>;
}) {
  return (
    <figcaption className="chart-legend">
      {series.map((item) => (
        <span key={item.label}>
          <i style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </figcaption>
  );
}

function linePath(values: number[], geometry: ChartGeometry): string {
  return values
    .map((value, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${xForIndex(index, values.length, geometry)} ${yForValue(value, geometry)}`;
    })
    .join(" ");
}

function xForIndex(index: number, count: number, geometry: ChartGeometry): number {
  if (count <= 1) return geometry.left + geometry.plotWidth / 2;
  return geometry.left + (index / (count - 1)) * geometry.plotWidth;
}

function yForValue(value: number, geometry: ChartGeometry): number {
  const range = geometry.max - geometry.min || 1;
  return geometry.bottom - ((value - geometry.min) / range) * geometry.plotHeight;
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

function confidenceLabel(
  labels: AppCopy["flow"],
  confidence: ConfidenceLevel,
): string {
  if (confidence === "high") return labels.highConfidence;
  if (confidence === "medium") return labels.mediumConfidence;
  return labels.lowConfidence;
}

function browserLocale(): Locale {
  return navigator.language.toLowerCase().startsWith("sv") ? "sv" : "en";
}

function storedLocale(): Locale | null {
  const savedLocale = window.localStorage.getItem(localeStorageKey);
  return savedLocale === "sv" || savedLocale === "en" ? savedLocale : null;
}

async function detectLocaleFromEdge(signal: AbortSignal): Promise<Locale | null> {
  try {
    const response = await fetch(localeUrl, {
      cache: "no-store",
      signal,
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!isLocalePayload(payload)) return null;
    return payload.locale;
  } catch {
    return null;
  }
}

function isLocalePayload(payload: unknown): payload is { locale: Locale } {
  if (typeof payload !== "object" || payload === null) return false;
  const locale = (payload as { locale?: unknown }).locale;
  return locale === "sv" || locale === "en";
}

createRoot(document.getElementById("root")!).render(<App />);
