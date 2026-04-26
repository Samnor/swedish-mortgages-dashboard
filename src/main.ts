import {
  confidenceForBankCount,
  deriveDashboardKpis,
  deriveNegotiationRange,
  maxOutgoingTransitions,
  parseDashboardSnapshot,
  stateComplexity,
  transition,
  type ConfidenceLevel,
  type DashboardEvent,
  type DashboardKpis,
  type DashboardSnapshot,
  type DashboardState,
  type NegotiationOption,
  type NegotiationRange,
  type SourceLink,
} from "./dashboardMachine";
import "./styles.css";

const snapshotUrl = `${import.meta.env.BASE_URL}data/latest.json`;
const localeUrl = `${import.meta.env.BASE_URL}locale.json`;
const localeStorageKey = "swedish-mortgages-dashboard.locale";

type Locale = "sv" | "en";

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
    | "ceiling"
    | "gapToMedian",
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
    githubLinks: Array<{ label: string; url: string }>;
    steps: Array<{ title: string; body: string }>;
  };
  fundingIntro: {
    eyebrow: string;
    title: string;
    body: string;
    points: Array<{ title: string; body: string }>;
  };
};

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
      gapToMedian: "Gap mot median",
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
      rangeBodyMiddle: "som första samtalsmål. Det är ungefär",
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
      githubLinks: [
        {
          label: "dbt-repo",
          url: "https://github.com/Samnor/swedish-mortgages-dbt",
        },
        {
          label: "dashboard-app",
          url: "https://github.com/Samnor/swedish-mortgages-dashboard",
        },
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
      gapToMedian: "Gap to median",
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
      rangeBodyMiddle: "as an opening target. That is roughly",
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
      githubLinks: [
        {
          label: "dbt repo",
          url: "https://github.com/Samnor/swedish-mortgages-dbt",
        },
        {
          label: "dashboard app",
          url: "https://github.com/Samnor/swedish-mortgages-dashboard",
        },
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

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("Missing #root element.");
const appRoot = root;

let state: DashboardState = { value: "idle" };
let locale: Locale = storedLocale() ?? browserLocale();

appRoot.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest<HTMLElement>("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "locale") {
    const nextLocale = button.dataset.locale;
    if (nextLocale === "sv" || nextLocale === "en") {
      window.localStorage.setItem(localeStorageKey, nextLocale);
      locale = nextLocale;
      render();
    }
    return;
  }

  if (action === "select-duration" && button.dataset.period) {
    send({ type: "SELECT_DURATION", periodLabel: button.dataset.period });
  }
  if (action === "view-pipeline") send({ type: "VIEW_PIPELINE" });
  if (action === "close-pipeline") send({ type: "CLOSE_PIPELINE" });
  if (action === "retry") loadSnapshot();
});

render();
void loadSnapshot();
void detectLocaleFromEdgeWithTimeout();

function send(event: DashboardEvent): void {
  state = transition(state, event);
  render();
}

async function loadSnapshot(): Promise<void> {
  const controller = new AbortController();
  send({ type: "START" });

  try {
    const response = await fetch(snapshotUrl, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Snapshot request failed with ${response.status}.`);
    }
    const rawSnapshot: unknown = await response.json();
    send({
      type: "LOAD_SUCCEEDED",
      snapshot: parseDashboardSnapshot(rawSnapshot),
    });
  } catch (error) {
    send({
      type: "LOAD_FAILED",
      message: error instanceof Error ? error.message : "Snapshot loading failed.",
    });
  }
}

function render(): void {
  document.documentElement.lang = locale;
  appRoot.innerHTML = renderApp();
}

function renderApp(): string {
  const labels = copy[locale];

  if (state.value === "pipeline_inspection") {
    return renderPipelineScreen(labels.pipeline, state.snapshot);
  }

  const snapshot = snapshotFromState(state);
  const kpis = snapshot ? deriveDashboardKpis(snapshot) : null;
  const negotiationOptions = snapshot?.negotiationOptions ?? [];
  const selectedPeriod =
    state.value === "duration_selected" ? state.selectedPeriod : null;
  const selectedOption =
    negotiationOptions.find((option) => option.periodLabel === selectedPeriod) ??
    null;
  const selectedRange = selectedOption
    ? deriveNegotiationRange(selectedOption)
    : null;

  return `
    <main>
      ${renderLanguageToggle(labels)}
      <section class="hero">
        <p class="eyebrow">${escapeHtml(labels.appLabel)}</p>
        <h1>${escapeHtml(labels.heroTitle)}</h1>
        <p>${escapeHtml(labels.heroBody)}</p>
      </section>
      ${renderFundingIntro(labels.fundingIntro)}
      ${kpis ? renderKpiGrid(kpis, labels.rates) : ""}
      ${
        snapshot
          ? renderDurationFlow(
              labels.flow,
              kpis?.latestDate ?? null,
              negotiationOptions,
              selectedRange,
            )
          : ""
      }
      ${
        snapshot && selectedRange
          ? renderInsightCharts(labels.charts, negotiationOptions, selectedRange, snapshot)
          : ""
      }
      ${
        snapshot &&
        (state.value === "ready_unselected" || state.value === "duration_selected")
          ? renderPipelineTeaser(labels.pipeline)
          : ""
      }
      ${snapshot ? renderSourceLinksPanel(labels.sources, snapshot.sourceLinks) : ""}
      ${renderDiagnostics(labels, snapshot)}
    </main>
  `;
}

function snapshotFromState(currentState: DashboardState): DashboardSnapshot | null {
  if (
    currentState.value === "ready_unselected" ||
    currentState.value === "duration_selected" ||
    currentState.value === "stale" ||
    currentState.value === "pipeline_inspection"
  ) {
    return currentState.snapshot;
  }
  return null;
}

function renderLanguageToggle(labels: AppCopy): string {
  return `
    <div class="language-toggle" aria-label="${escapeAttr(labels.languageLabel)}">
      <span>${escapeHtml(labels.languageLabel)}</span>
      <button aria-pressed="${locale === "sv"}" class="language-button" data-action="locale" data-locale="sv" type="button">${escapeHtml(labels.swedish)}</button>
      <button aria-pressed="${locale === "en"}" class="language-button" data-action="locale" data-locale="en" type="button">${escapeHtml(labels.english)}</button>
    </div>
  `;
}

function renderFundingIntro(labels: AppCopy["fundingIntro"]): string {
  return `
    <section class="funding-intro">
      <div>
        <p class="eyebrow">${escapeHtml(labels.eyebrow)}</p>
        <h2>${escapeHtml(labels.title)}</h2>
        <p>${escapeHtml(labels.body)}</p>
      </div>
      <div class="funding-points">
        ${labels.points
          .map(
            (point) => `
              <article class="funding-point">
                <strong>${escapeHtml(point.title)}</strong>
                <span>${escapeHtml(point.body)}</span>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderKpiGrid(kpis: DashboardKpis, labels: AppCopy["rates"]): string {
  return `
    <section class="kpi-grid" aria-label="Mortgage market summary">
      ${renderKpiCard(
        labels.policyRate,
        formatRate(kpis.latestPolicyRate),
        `${labels.latestSourceDate} ${kpis.latestDate}`,
        kpis.policyRateChange30d,
        labels.vs30dAgo,
      )}
      ${renderKpiCard(
        labels.mortgageBond5y,
        formatRate(kpis.latestMortgageBond5y),
        labels.mortgageBondProxy,
        kpis.mortgageBond5yChange30d,
        labels.vs30dAgo,
      )}
    </section>
  `;
}

function renderKpiCard(
  label: string,
  value: string,
  detail: string,
  delta: number | null,
  vsLabel: string,
): string {
  return `
    <article class="kpi-card">
      <p class="eyebrow">${escapeHtml(label)}</p>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(detail)}</span>
      <span class="delta">${escapeHtml(formatDelta(delta))} ${escapeHtml(vsLabel)}</span>
    </article>
  `;
}

function renderDurationFlow(
  labels: AppCopy["flow"],
  latestDate: string | null,
  options: NegotiationOption[],
  range: NegotiationRange | null,
): string {
  if (options.length === 0) {
    return `
      <section class="flow-panel">
        <p class="eyebrow">${escapeHtml(labels.label)}</p>
        <h2>${escapeHtml(labels.noDataTitle)}</h2>
        <p>${escapeHtml(labels.noDataBody)}</p>
      </section>
    `;
  }

  return `
    <section class="flow-panel">
      <div>
        <p class="eyebrow">${escapeHtml(labels.step1)}</p>
        <h2>${escapeHtml(labels.question)}</h2>
        <p>${escapeHtml(labels.body)}</p>
        <div class="duration-options" role="list">
          ${options
            .map(
              (option) => `
                <button
                  aria-pressed="${option.periodLabel === range?.option.periodLabel}"
                  class="duration-button"
                  data-action="select-duration"
                  data-period="${escapeAttr(option.periodLabel)}"
                  type="button"
                >
                  ${escapeHtml(option.periodLabelDisplay)}
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      ${range ? renderNegotiationRangePanel(labels, latestDate, range) : renderEmptyRange(labels)}
    </section>
  `;
}

function renderEmptyRange(labels: AppCopy["flow"]): string {
  return `
    <article class="range-card range-card-empty">
      <p class="eyebrow">${escapeHtml(labels.step2)}</p>
      <h2>${escapeHtml(labels.waitingTitle)}</h2>
      <p>${escapeHtml(labels.waitingBody)}</p>
    </article>
  `;
}

function renderNegotiationRangePanel(
  labels: AppCopy["flow"],
  latestDate: string | null,
  range: NegotiationRange,
): string {
  const confidence = confidenceForBankCount(range.option.bankCount);
  return `
    <article class="range-card">
      <p class="eyebrow">${escapeHtml(labels.step2)}</p>
      <h2>${escapeHtml(range.option.periodLabelDisplay)} ${escapeHtml(labels.negotiationRange)}</h2>
      <div class="range-value">${escapeHtml(formatRate(range.floorRate))}-${escapeHtml(formatRate(range.ceilingRate))}</div>
      <p>
        ${escapeHtml(labels.rangeBodyStart)}
        <strong>${escapeHtml(formatRate(range.midpointRate))}</strong>
        ${escapeHtml(labels.rangeBodyMiddle)}
        <strong>${escapeHtml(formatDelta(range.discountFromMedianListRate))}</strong>
        ${escapeHtml(labels.rangeBodyEnd)}
      </p>
      <p class="assumption-note">${escapeHtml(labels.assumptionNote)}</p>
      ${
        confidence === "low"
          ? `<p class="confidence-warning">${escapeHtml(labels.lowConfidenceNote)}</p>`
          : ""
      }
      <dl class="range-details">
        ${renderDetail(labels.medianListed, formatRate(range.option.medianListRate))}
        ${renderDetail(labels.fundingProxy, formatRate(range.option.medianFundingCost))}
        ${renderDetail(labels.banksSampled, String(range.option.bankCount))}
        ${renderDetail(labels.confidence, confidenceLabel(labels, confidence))}
        ${renderDetail(latestDate ? labels.latestMarketDate : labels.latestMarketDate, latestDate ?? copy[locale].diagnostics.unavailable)}
      </dl>
    </article>
  `;
}

function renderDetail(label: string, value: string): string {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function renderInsightCharts(
  labels: AppCopy["charts"],
  options: NegotiationOption[],
  range: NegotiationRange,
  snapshot: DashboardSnapshot,
): string {
  return `
    <section class="insight-grid" aria-label="${escapeAttr(labels.aria)}">
      ${renderInsightChart(
        labels.chart1,
        labels.marketPressure,
        labels.marketPressureDescription,
        renderMarketPressureChart(labels, range, snapshot),
      )}
      ${renderInsightChart(
        labels.chart2,
        labels.durationComparison,
        labels.durationComparisonDescription,
        renderDurationComparisonChart(labels, options, range),
      )}
      ${renderInsightChart(
        labels.chart3,
        labels.fundingMargin,
        labels.fundingMarginDescription,
        renderFundingMarginChart(labels, range),
      )}
    </section>
  `;
}

function renderInsightChart(
  eyebrow: string,
  title: string,
  description: string,
  chart: string,
): string {
  return `
    <article class="insight-card">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      ${chart}
    </article>
  `;
}

function renderPipelineTeaser(labels: AppCopy["pipeline"]): string {
  return `
    <section class="pipeline-teaser">
      <div>
        <p class="eyebrow">${escapeHtml(labels.eyebrow)}</p>
        <h2>${escapeHtml(labels.title)}</h2>
        <p>${escapeHtml(labels.body)}</p>
      </div>
      <button class="secondary-button" data-action="view-pipeline" type="button">${escapeHtml(labels.cta)}</button>
    </section>
  `;
}

function renderPipelineScreen(
  labels: AppCopy["pipeline"],
  snapshot: DashboardSnapshot,
): string {
  const exportedRows = snapshot.rates.length + snapshot.negotiationOptions.length;
  return `
    <main class="pipeline-screen">
      <button class="secondary-button pipeline-back" data-action="close-pipeline" type="button">${escapeHtml(labels.close)}</button>
      <section class="pipeline-hero">
        <div>
          <p class="eyebrow">${escapeHtml(labels.eyebrow)}</p>
          <h1>${escapeHtml(labels.caseStudyTitle)}</h1>
          <p>${escapeHtml(labels.caseStudyBody)}</p>
        </div>
        <dl class="pipeline-metrics">
          ${labels.metrics
            .map((metric) => renderDetail(metric.label, metric.value))
            .join("")}
          ${renderDetail(labels.handoffLabel, `${exportedRows} rows`)}
        </dl>
      </section>
      <section class="pipeline-workbench" aria-label="${escapeAttr(labels.architectureLabel)}">
        <div class="pipeline-rail">
          <p class="eyebrow">${escapeHtml(labels.architectureLabel)}</p>
          <div class="pipeline-node raw">raw</div>
          <div class="pipeline-arrow"></div>
          <div class="pipeline-node stage">stg</div>
          <div class="pipeline-arrow"></div>
          <div class="pipeline-node mart">mart</div>
          <div class="pipeline-arrow"></div>
          <div class="pipeline-node publish">json</div>
        </div>
        <div class="pipeline-steps pipeline-steps-dag">
          ${labels.steps
            .map(
              (step) => `
                <article class="pipeline-step">
                  <strong>${escapeHtml(step.title)}</strong>
                  <span>${escapeHtml(step.body)}</span>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
      <section class="pipeline-contract">
        <div>
          <p class="eyebrow">${escapeHtml(labels.controlsLabel)}</p>
          <h2>${escapeHtml(labels.title)}</h2>
          <p>${escapeHtml(labels.body)}</p>
        </div>
        <ul>
          ${labels.controls.map((control) => `<li>${escapeHtml(control)}</li>`).join("")}
        </ul>
        <div class="pipeline-github-links">
          ${labels.githubLinks
            .map(
              (link) =>
                `<a href="${escapeAttr(link.url)}" rel="noreferrer" target="_blank">${escapeHtml(link.label)}</a>`,
            )
            .join("")}
        </div>
      </section>
    </main>
  `;
}

function renderSourceLinksPanel(
  labels: AppCopy["sources"],
  sources: SourceLink[],
): string {
  return `
    <section class="source-panel">
      <div>
        <p class="eyebrow">${escapeHtml(labels.title)}</p>
        <p>${escapeHtml(sources.length > 0 ? labels.body : labels.empty)}</p>
      </div>
      ${
        sources.length > 0
          ? `<div class="source-grid">${sources.map((source) => renderSourceLink(labels, source)).join("")}</div>`
          : ""
      }
    </section>
  `;
}

function renderSourceLink(labels: AppCopy["sources"], source: SourceLink): string {
  return `
    <a class="source-link" href="${escapeAttr(source.url)}" rel="noreferrer" target="_blank">
      <strong>${escapeHtml(source.label)}</strong>
      <span>${escapeHtml(labels.usedFor)}: ${escapeHtml(source.usedFor)}</span>
    </a>
  `;
}

function renderDiagnostics(labels: AppCopy, snapshot: DashboardSnapshot | null): string {
  return `
    <section class="panel diagnostics-panel">
      <div>
        <details>
          <summary>${escapeHtml(labels.diagnostics.title)}</summary>
          <p>${escapeHtml(labels.diagnostics.state)}: <strong>${escapeHtml(state.value)}</strong>. ${escapeHtml(labels.diagnostics.reads)} <code>${escapeHtml(snapshotUrl)}</code>.</p>
          <p>${escapeHtml(labels.diagnostics.complexity.replace("{count}", String(maxOutgoingTransitions)))}</p>
          <dl class="complexity-list">
            ${Object.entries(stateComplexity)
              .map(([name, count]) => renderDetail(name, String(count)))
              .join("")}
          </dl>
        </details>
        ${state.value === "stale" ? `<p>${escapeHtml(state.reason)}</p>` : ""}
        ${state.value === "error" ? `<p>${escapeHtml(state.message)}</p>` : ""}
        ${
          state.value === "empty"
            ? `<p>${escapeHtml(labels.diagnostics.empty)} ${escapeHtml(state.generatedAt)}.</p>`
            : ""
        }
      </div>
      ${snapshot ? renderRatesPanel(labels.rates, snapshot) : `<div class="chart"></div>`}
    </section>
  `;
}

function renderRatesPanel(labels: AppCopy["rates"], snapshot: DashboardSnapshot): string {
  return lineChart({
    ariaLabel: `${labels.policyRate}, ${labels.mortgageBond5y}`,
    className: "chart",
    series: [
      {
        label: labels.policyRate,
        valueLabel: formatRate(lastValue(snapshot.rates.map((row) => row.policyRate))),
        values: snapshot.rates.map((row) => row.policyRate),
        color: "#743a22",
      },
      {
        label: labels.mortgageBond5y,
        valueLabel: formatRate(lastValue(snapshot.rates.map((row) => row.mortgageBond5y))),
        values: snapshot.rates.map((row) => row.mortgageBond5y),
        color: "#2d5f5d",
      },
    ],
    xLabels: snapshot.rates.map((row) => row.date),
  });
}

function renderMarketPressureChart(
  labels: AppCopy["charts"],
  range: NegotiationRange,
  snapshot: DashboardSnapshot,
): string {
  const latestPolicyRate = lastValue(snapshot.rates.map((row) => row.policyRate));
  const latestFundingProxy = lastValue(
    snapshot.rates.map((row) => row.mortgageBond5y),
  );

  return (
    renderChartSummary([
      { label: labels.policyRate, value: formatRate(latestPolicyRate) },
      { label: labels.coveredBondProxy, value: formatRate(latestFundingProxy) },
      {
        label: `${range.option.periodLabelDisplay} ${labels.target}`,
        value: formatRate(range.midpointRate),
      },
    ]) +
    lineChart({
    ariaLabel: labels.marketPressure,
    className: "insight-chart",
    series: [
      {
        label: labels.policyRate,
        valueLabel: formatRate(latestPolicyRate),
        values: snapshot.rates.map((row) => row.policyRate),
        color: "#743a22",
      },
      {
        label: labels.coveredBondProxy,
        valueLabel: formatRate(latestFundingProxy),
        values: snapshot.rates.map((row) => row.mortgageBond5y),
        color: "#2d5f5d",
      },
      {
        dashed: true,
        label: `${range.option.periodLabelDisplay} ${labels.target}`,
        valueLabel: formatRate(range.midpointRate),
        values: snapshot.rates.map(() => range.midpointRate),
        color: "#d08a24",
      },
    ],
    xLabels: snapshot.rates.map((row) => row.date),
    })
  );
}

function renderDurationComparisonChart(
  labels: AppCopy["charts"],
  options: NegotiationOption[],
  range: NegotiationRange,
): string {
  return (
    renderChartSummary([
      {
        label: `${range.option.periodLabelDisplay} ${labels.medianListed}`,
        value: formatRate(range.option.medianListRate),
      },
      { label: labels.negotiationTarget, value: formatRate(range.midpointRate) },
      {
        label: labels.gapToMedian,
        value: formatPoint(range.discountFromMedianListRate),
      },
    ]) +
    barLineChart({
    ariaLabel: labels.durationComparison,
    bars: {
      label: labels.medianListed,
      valueLabel: formatRate(range.option.medianListRate),
      values: options.map((option) => option.medianListRate),
      color: "#d7c3a2",
    },
    line: {
      label: labels.negotiationTarget,
      valueLabel: formatRate(range.midpointRate),
      values: options.map((option) => deriveNegotiationRange(option).midpointRate),
      color: "#743a22",
    },
    selectedIndex: options.findIndex(
      (option) => option.periodLabel === range.option.periodLabel,
    ),
    selectedLabel: labels.selected,
    xLabels: options.map((option) => option.periodLabelDisplay),
    })
  );
}

function renderFundingMarginChart(
  labels: AppCopy["charts"],
  range: NegotiationRange,
): string {
  const fundingCost = range.option.medianFundingCost;
  const targetMargin = Math.max(0, range.midpointRate - fundingCost);
  const totalValues = [
    range.floorRate,
    range.midpointRate,
    range.ceilingRate,
    range.option.medianListRate,
  ];
  return (
    renderChartSummary([
      { label: labels.fundingProxy, value: formatRate(fundingCost) },
      { label: labels.marginRoom, value: formatPoint(targetMargin) },
      { label: labels.medianListed, value: formatRate(range.option.medianListRate) },
    ]) +
    stackedBarChart({
    ariaLabel: labels.fundingMargin,
    base: {
      label: labels.fundingProxy,
      valueLabel: formatRate(fundingCost),
      values: totalValues.map(() => fundingCost),
      color: "#2d5f5d",
    },
    stack: {
      label: labels.marginRoom,
      valueLabel: formatPoint(targetMargin),
      values: totalValues.map((value) => Math.max(0, value - fundingCost)),
      color: "#d08a24",
    },
    xLabels: [
      labels.floor,
      labels.targetLabel,
      labels.ceiling,
      labels.medianListed,
    ],
    })
  );
}

function renderChartSummary(items: Array<{ label: string; value: string }>): string {
  return `
    <dl class="chart-summary">
      ${items
        .map(
          (item) => `
            <div>
              <dt>${escapeHtml(item.label)}</dt>
              <dd>${escapeHtml(item.value)}</dd>
            </div>
          `,
        )
        .join("")}
    </dl>
  `;
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

function lineChart({
  ariaLabel,
  className,
  series,
  xLabels,
}: {
  ariaLabel: string;
  className: string;
  series: Array<{
    color: string;
    dashed?: boolean;
    label: string;
    valueLabel: string;
    values: number[];
  }>;
  xLabels: string[];
}): string {
  const geometry = chartGeometry(series.flatMap((item) => item.values));
  return `
    <figure class="${escapeAttr(className)}" aria-label="${escapeAttr(ariaLabel)}">
      <svg class="svg-chart" role="img" viewBox="0 0 ${geometry.width} ${geometry.height}">
        ${chartGrid(geometry)}
        ${series
          .map(
            (item) => `
              <path
                class="chart-line"
                d="${escapeAttr(linePath(item.values, geometry))}"
                fill="none"
                stroke="${escapeAttr(item.color)}"
                ${item.dashed ? `stroke-dasharray="6 6"` : ""}
              ></path>
            `,
          )
          .join("")}
        ${xAxisLabels(geometry, xLabels)}
      </svg>
      ${chartLegend(series)}
    </figure>
  `;
}

function barLineChart({
  ariaLabel,
  bars,
  line,
  selectedIndex,
  selectedLabel,
  xLabels,
}: {
  ariaLabel: string;
  bars: { color: string; label: string; valueLabel: string; values: number[] };
  line: { color: string; label: string; valueLabel: string; values: number[] };
  selectedIndex: number;
  selectedLabel: string;
  xLabels: string[];
}): string {
  const geometry = chartGeometry([...bars.values, ...line.values]);
  const barWidth = Math.max(14, geometry.plotWidth / bars.values.length / 2.6);
  return `
    <figure class="insight-chart" aria-label="${escapeAttr(ariaLabel)}">
      <svg class="svg-chart" role="img" viewBox="0 0 ${geometry.width} ${geometry.height}">
        ${chartGrid(geometry)}
        ${bars.values
          .map((value, index) => {
            const x = xForIndex(index, bars.values.length, geometry) - barWidth / 2;
            const y = yForValue(value, geometry);
            return `<rect class="chart-bar" fill="${escapeAttr(bars.color)}" height="${geometry.bottom - y}" rx="4" width="${barWidth}" x="${x}" y="${y}"></rect>`;
          })
          .join("")}
        <path class="chart-line" d="${escapeAttr(linePath(line.values, geometry))}" fill="none" stroke="${escapeAttr(line.color)}"></path>
        ${
          selectedIndex >= 0
            ? `<circle class="chart-point" cx="${xForIndex(selectedIndex, line.values.length, geometry)}" cy="${yForValue(line.values[selectedIndex], geometry)}" fill="#17211f" r="5"></circle>`
            : ""
        }
        ${xAxisLabels(geometry, xLabels)}
      </svg>
      ${chartLegend([
        { color: bars.color, label: bars.label, valueLabel: bars.valueLabel },
        { color: line.color, label: line.label, valueLabel: line.valueLabel },
        { color: "#17211f", label: selectedLabel, valueLabel: "" },
      ])}
    </figure>
  `;
}

function stackedBarChart({
  ariaLabel,
  base,
  stack,
  xLabels,
}: {
  ariaLabel: string;
  base: { color: string; label: string; valueLabel: string; values: number[] };
  stack: { color: string; label: string; valueLabel: string; values: number[] };
  xLabels: string[];
}): string {
  const totals = base.values.map((value, index) => value + stack.values[index]);
  const geometry = chartGeometry(totals);
  const barWidth = Math.max(20, geometry.plotWidth / totals.length / 2.4);
  return `
    <figure class="insight-chart" aria-label="${escapeAttr(ariaLabel)}">
      <svg class="svg-chart" role="img" viewBox="0 0 ${geometry.width} ${geometry.height}">
        ${chartGrid(geometry)}
        ${totals
          .map((total, index) => {
            const x = xForIndex(index, totals.length, geometry) - barWidth / 2;
            const baseTop = yForValue(base.values[index], geometry);
            const stackTop = yForValue(total, geometry);
            return `
              <g>
                <rect class="chart-bar" fill="${escapeAttr(base.color)}" height="${geometry.bottom - baseTop}" rx="4" width="${barWidth}" x="${x}" y="${baseTop}"></rect>
                <rect class="chart-bar" fill="${escapeAttr(stack.color)}" height="${baseTop - stackTop}" rx="4" width="${barWidth}" x="${x}" y="${stackTop}"></rect>
              </g>
            `;
          })
          .join("")}
        ${xAxisLabels(geometry, xLabels)}
      </svg>
      ${chartLegend([
        { color: base.color, label: base.label, valueLabel: base.valueLabel },
        { color: stack.color, label: stack.label, valueLabel: stack.valueLabel },
      ])}
    </figure>
  `;
}

function chartGrid(geometry: ChartGeometry): string {
  const ticks = [0, 0.5, 1].map(
    (ratio) => geometry.min + (geometry.max - geometry.min) * ratio,
  );
  return `
    <g class="chart-grid">
      ${ticks
        .map((tick) => {
          const y = yForValue(tick, geometry);
          return `
            <g>
              <line x1="${geometry.left}" x2="${geometry.width - geometry.right}" y1="${y}" y2="${y}"></line>
              <text x="${geometry.left - 8}" y="${y + 4}">${escapeHtml(formatRate(tick))}</text>
            </g>
          `;
        })
        .join("")}
    </g>
  `;
}

function xAxisLabels(geometry: ChartGeometry, labels: string[]): string {
  if (labels.length === 0) return "";
  const indexes = Array.from(
    new Set([0, Math.floor((labels.length - 1) / 2), labels.length - 1]),
  );
  return `
    <g class="chart-axis-labels">
      ${indexes
        .map((index) => {
          const anchor =
            index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle";
          return `<text text-anchor="${anchor}" x="${xForIndex(index, labels.length, geometry)}" y="${geometry.bottom + 28}">${escapeHtml(labels[index])}</text>`;
        })
        .join("")}
    </g>
  `;
}

function chartLegend(
  series: Array<{ color: string; label: string; valueLabel?: string }>,
): string {
  return `
    <figcaption class="chart-legend">
      ${series
        .map(
          (item) => `
            <span>
              <i style="background: ${escapeAttr(item.color)}"></i>
              <b>${escapeHtml(item.label)}</b>
              ${item.valueLabel ? `<em>${escapeHtml(item.valueLabel)}</em>` : ""}
            </span>
          `,
        )
        .join("")}
    </figcaption>
  `;
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

function lastValue(values: number[]): number {
  return values.at(-1) ?? 0;
}

function numberFormatter() {
  return new Intl.NumberFormat(locale === "sv" ? "sv-SE" : "en-SE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatRate(value: number): string {
  return `${numberFormatter().format(value)}%`;
}

function formatDelta(delta: number | null): string {
  if (delta === null) return copy[locale].diagnostics.unavailable;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${numberFormatter().format(delta)} pp`;
}

function formatPoint(value: number): string {
  return `${numberFormatter().format(value)} pp`;
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

async function detectLocaleFromEdgeWithTimeout(): Promise<void> {
  if (storedLocale()) return;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(localeUrl, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return;
    const payload: unknown = await response.json();
    if (!isLocalePayload(payload)) return;
    locale = payload.locale;
    render();
  } catch {
    return;
  } finally {
    window.clearTimeout(timeout);
  }
}

function isLocalePayload(input: unknown): input is { locale: Locale } {
  if (typeof input !== "object" || input === null) return false;
  const localeValue = (input as { locale?: unknown }).locale;
  return localeValue === "sv" || localeValue === "en";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
