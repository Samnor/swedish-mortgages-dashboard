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
type SourceKind = "source" | "method" | "context";
type IconName =
  | "arrowLeft"
  | "bank"
  | "bond"
  | "chart"
  | "check"
  | "clock"
  | "database"
  | "external"
  | "github"
  | "pipeline"
  | "shield"
  | "target";

type AppCopy = {
  appLabel: string;
  heroTitle: string;
  heroBody: string;
  languageLabel: string;
  swedish: string;
  english: string;
  rates: Record<
    | "policyRate"
    | "mortgageBond2y"
    | "mortgageBond5y"
    | "mortgageBondProxy"
    | "latestSourceDate"
    | "vs30dAgo",
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
    | "coveredBondProxy2y"
    | "coveredBondProxy5y"
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
    | "assumptionNote"
    | "howToReadTitle"
    | "howToReadBody"
    | "howToReadFloor"
    | "howToReadMidpoint"
    | "howToReadCeiling"
    | "dataBehindRange",
    string
  >;
  diagnostics: Record<
    "title" | "state" | "reads" | "complexity" | "empty" | "unavailable",
    string
  >;
  freshness: Record<
    | "status"
    | "eyebrow"
    | "title"
    | "body"
    | "fresh"
    | "watch"
    | "stale"
    | "invalid"
    | "generatedAt"
    | "latestMarketDate"
    | "snapshotAge"
    | "marketAge"
    | "sourceCount"
    | "hourAgo"
    | "hoursAgo"
    | "dayAgo"
    | "daysAgo",
    string
  >;
  sources: Record<
    | "title"
    | "body"
    | "empty"
    | "usedFor"
    | "source"
    | "method"
    | "context",
    string
  >;
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
  caisse: {
    eyebrow: string;
    title: string;
    body: string;
    points: Array<{ title: string; body: string }>;
    linksTitle: string;
    links: Array<{ label: string; url: string }>;
    usageTitle: string;
    usage: Array<{ period: string; proxy: string }>;
  };
  limitations: {
    eyebrow: string;
    title: string;
    body: string;
    items: string[];
  };
};

const copy = {
  sv: {
    appLabel: "Svensk bolånekoll",
    heroTitle: "Se när bankens marginal börjar bli tunn.",
    heroBody:
      "Välj bindningstid och gör en sanity check av ungefär var bolåneräntan närmar sig finansieringsproxyn.",
    languageLabel: "Språk",
    swedish: "Svenska",
    english: "English",
    rates: {
      policyRate: "Styrränta",
      mortgageBond2y: "2-årig CAISSE-proxy",
      mortgageBond5y: "5-årig CAISSE-proxy",
      mortgageBondProxy: "Stadshypotek CAISSE marknadsproxy",
      latestSourceDate: "Senaste källdatum",
      vs30dAgo: "mot 30 dagar sedan",
    },
    charts: {
      aria: "Diagram för bolånemarginal",
      chart1: "Diagram 1",
      chart2: "Diagram 2",
      chart3: "Diagram 3",
      marketPressure: "Marknadstryck",
      marketPressureDescription:
        "Styrränta och Riksbanken/Refinitiv CAISSE-proxy bakom förhandlingsläget.",
      durationComparison: "Din bindningstid mot alternativen",
      durationComparisonDescription:
        "Bankernas medianräntor och modellens tunn-marginalzon över bindningstider.",
      fundingMargin: "Marginalen över proxyn",
      fundingMarginDescription:
        "Separera CAISSE-baserad marknadsproxy från marginalen i observerade räntor.",
      coveredBondProxy2y: "2-årig CAISSE-proxy",
      coveredBondProxy5y: "5-årig CAISSE-proxy",
      policyRate: "Styrränta",
      target: "mål",
      medianListed: "Median listad",
      negotiationTarget: "Tunn marginal",
      selected: "Vald",
      fundingProxy: "Marknadsproxy",
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
      waitingTitle: "Välj en bindningstid för att se marginalzonen.",
      waitingBody:
        "Vi visar inte ett förvalt förhandlingsbud. Välj hur länge du funderar på att binda lånet, så räknar appen fram var räntan börjar närma sig finansieringsproxyn.",
      question: "Hur länge vill du binda bolånet?",
      body:
        "Välj bindningstiden du överväger. Appen jämför bankernas listräntor med en CAISSE-baserad marknadsproxy för att visa när marginalen börjar bli tunn.",
      negotiationRange: "marginalzon",
      rangeBodyStart: "Modellen placerar tunn-marginalzonen vid",
      rangeBodyMiddle: "som mittpunkt. Det är ungefär",
      rangeBodyEnd:
        "mot medianlisträntan i denna bindningstid. Det är en sanity check, inte ett garanterat erbjudande eller bankens faktiska smärtgräns.",
      medianListed: "Median listad",
      fundingProxy: "Marknadsproxy",
      banksSampled: "Banker i urvalet",
      latestMarketDate: "Senaste marknadsdatum",
      confidence: "Tillförlitlighet",
      highConfidence: "Hög",
      mediumConfidence: "Medel",
      lowConfidence: "Låg",
      lowConfidenceNote:
        "Få banker i urvalet. Använd intervallet som grov signal, inte som stark marknadsnivå.",
      assumptionNote:
        "Bygger på listräntor, Riksbanken/Refinitiv Stadshypotek CAISSE-proxy och en enkel marginalmodell. Bankens verkliga lönsamhetsgräns kan ligga högre eller lägre.",
      howToReadTitle: "Så läser du marginalzonen",
      howToReadBody:
        "Zonen är ett rimlighetstest, inte ett kreditbeslut. Den visar var räntan börjar närma sig en svensk bolåneobligationsproxy, inte bankens faktiska totalkostnad.",
      howToReadFloor:
        "Nedre delen ligger närmast proxyn och bör ses som mycket tunn marginal i modellen.",
      howToReadMidpoint:
        "Mitten är en praktisk ungefärlig nivå för att förstå om ett erbjudande är nära modellens marginalgolv.",
      howToReadCeiling:
        "Övre delen är mindre pressad, men fortfarande nära den modellerade tunn-marginalzonen.",
      dataBehindRange: "Data bakom marginalzonen",
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
    freshness: {
      status: "Status",
      eyebrow: "Datafärskhet",
      title: "Så aktuell är datan",
      body:
        "Dashboarden är en statisk snapshot. Kontrollera både när snapshoten exporterades och vilket marknadsdatum som är senaste datapunkt.",
      fresh: "Aktuell",
      watch: "Bevaka",
      stale: "Inaktuell",
      invalid: "Okänd",
      generatedAt: "Exporterad",
      latestMarketDate: "Senaste marknadsdatum",
      snapshotAge: "Snapshot-ålder",
      marketAge: "Marknadsdata-ålder",
      sourceCount: "Publika källänkar",
      hourAgo: "1 timme sedan",
      hoursAgo: "{count} timmar sedan",
      dayAgo: "1 dag sedan",
      daysAgo: "{count} dagar sedan",
    },
    sources: {
      title: "Källor bakom datapunkterna",
      body:
        "Länkarna går till de publika källor och referenser som används för räntor, bankjämförelser och marginalkontext.",
      empty: "Inga publika källänkar finns i denna snapshot.",
      usedFor: "Används för",
      source: "Källa",
      method: "Metod",
      context: "Kontext",
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
        "Det här läget lämnar bolåneflödet och visar arkitekturen bakom produkten: råa publika källor blir staging-modeller, mart-tabeller, validerade kontrakt och till slut en billig statisk dataprodukt.",
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
            "Riksbankens räntor, SCB-data och bankernas publicerade listräntor landar oförändrade i separata råtabeller med tydlig källseparation.",
        },
        {
          title: "2. dbt städar och modellerar",
          body:
            "Staging-modeller typkonverterar, deduplicerar och normaliserar namn. Mart-modeller bygger räntedag, bankjämförelser och finansieringsproxy.",
        },
        {
          title: "3. CI och kontrakt skyddar appen",
          body:
            "Validatorn kräver sorterade tidsserier, rimliga kvartiler, källänkar och icke-tomma förhandlingsalternativ innan något publiceras.",
        },
        {
          title: "4. Appen får bara en kuraterad snapshot",
          body:
            "Publika användare frågar aldrig Athena. GitHub Actions exporterar en kompakt JSON-fil till S3 och CloudFront, så appen är snabb och billig.",
        },
      ],
    },
    limitations: {
      eyebrow: "Viktigt att veta",
      title: "Det här vet inte appen om dig",
      body:
        "Appen visar marknadsläge och förhandlingsutrymme. Den ersätter inte bankens kreditprövning och känner inte till din personliga riskprofil.",
      items: [
        "Belåningsgrad, inkomst, amorteringskrav och övriga lån.",
        "Din relation till banken, sparande, försäkringar och historik.",
        "Tillfälliga kampanjer, manuella undantag och bankens interna riskpris.",
        "Om du prioriterar lägsta möjliga ränta eller stabilitet över tid.",
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
    caisse: {
      eyebrow: "Finansieringsproxy",
      title: "Vad CAISSE betyder i appen",
      body:
        "Appens finansieringsproxy bygger på Riksbankens publika svenska bolåneobligationsserier SEMB2YCACOMB och SEMB5YCACOMB. Riksbanken grupperar dem som svenska bostadsobligationer, anger Refinitiv som källa i API-metadata och beskriver bolåneobligationsserien på sin förklaringssida som Stadshypoteks obligation, CAISSE.",
      points: [
        {
          title: "Stadshypotek är Handelsbanken-kopplat",
          body:
            "Stadshypotek AB är Handelsbankens bolåneinstitut och ett helägt dotterbolag. Serien ska därför inte läsas som ett genomsnitt för alla svenska banker.",
        },
        {
          title: "CAISSE är ett marknadsriktmärke",
          body:
            "Nasdaq-dokumentation visar även Stadshypotek-futures för 2 och 5 år, med leverans av Stadshypotek-obligationer nära respektive löptid. CAISSE-namnet hör alltså till ett benchmark-komplex, inte bara en enkel kontantobligation.",
        },
        {
          title: "Det är inte bankens faktiska finansieringskostnad",
          body:
            "Vi använder serien som en observerbar marknadsproxy. En banks verkliga finansiering påverkas även av inlåning, hedgar, likviditetskrav, kapital, emissionsmix och intern prissättning.",
        },
      ],
      linksTitle: "Primära källor",
      links: [
        {
          label: "Riksbanken: sök räntor och valutakurser",
          url: "https://www.riksbank.se/en-gb/statistics/interest-rates-and-exchange-rates/search-interest-rates-and-exchange-rates/",
        },
        {
          label: "Riksbanken: serier för API",
          url: "https://www.riksbank.se/en-gb/statistics/interest-rates-and-exchange-rates/retrieving-interest-rates-and-exchange-rates-via-api/series-for-the-api/",
        },
        {
          label: "Riksbanken: svenska marknadsräntor",
          url: "https://www.riksbank.se/en-gb/statistics/interest-rates-and-exchange-rates/explanations--interest-rates-and-exchange-rates/swedish-market-rates/",
        },
        {
          label: "Nasdaq: Stadshypotek futures",
          url: "https://www.nasdaq.com/docs/Stadshypotek%20Futures%20Product%20Sheet.pdf",
        },
      ],
      usageTitle: "Så används proxyn per bindningstid",
      usage: [
        {
          period: "3M och 1 år",
          proxy: "Styrränta + SWESTR 3M-spread + 5-årig CAISSE-spread",
        },
        {
          period: "2 år",
          proxy: "2-årig statsobligation + 2-årig CAISSE-spread",
        },
        {
          period: "3-4 år",
          proxy: "Interpolering mellan 2-årig och 5-årig CAISSE-spread",
        },
        {
          period: "5 år och längre",
          proxy: "5-årig statsobligation + 5-årig CAISSE-spread",
        },
      ],
    },
  },
  en: {
    appLabel: "Swedish Mortgage Guide",
    heroTitle: "See where the bank's margin starts to look thin.",
    heroBody:
      "Pick a binding period and sanity-check roughly where the mortgage rate approaches the funding proxy.",
    languageLabel: "Language",
    swedish: "Svenska",
    english: "English",
    rates: {
      policyRate: "Policy rate",
      mortgageBond2y: "2Y CAISSE proxy",
      mortgageBond5y: "5Y CAISSE proxy",
      mortgageBondProxy: "Stadshypotek CAISSE market proxy",
      latestSourceDate: "Latest source date",
      vs30dAgo: "vs 30d ago",
    },
    charts: {
      aria: "Mortgage margin charts",
      chart1: "Chart 1",
      chart2: "Chart 2",
      chart3: "Chart 3",
      marketPressure: "Market pressure",
      marketPressureDescription:
        "Policy rate and Riksbanken/Refinitiv CAISSE proxy behind the negotiation.",
      durationComparison: "Your duration against alternatives",
      durationComparisonDescription:
        "Median listed bank rates and the model's thin-margin zone across binding periods.",
      fundingMargin: "Margin over the proxy",
      fundingMarginDescription:
        "Separates the CAISSE-based market proxy from the margin implied by observed rates.",
      coveredBondProxy2y: "2Y CAISSE proxy",
      coveredBondProxy5y: "5Y CAISSE proxy",
      policyRate: "Policy rate",
      target: "target",
      medianListed: "Median listed",
      negotiationTarget: "Thin margin",
      selected: "Selected",
      fundingProxy: "Market proxy",
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
      waitingTitle: "Pick a binding period to see the margin zone.",
      waitingBody:
        "The app does not show a default bid. Choose the period you are considering first, then it estimates where the rate starts approaching the funding proxy.",
      question: "How long do you want to bind your mortgage?",
      body:
        "Pick the duration you are considering. The app compares listed bank rates with a CAISSE-based market proxy to show where the margin starts to look thin.",
      negotiationRange: "margin zone",
      rangeBodyStart: "The model puts the thin-margin zone at",
      rangeBodyMiddle: "as the midpoint. That is roughly",
      rangeBodyEnd:
        "relative to the median listed rate in this duration bucket. It is a sanity check, not a guaranteed offer or the bank's actual break-even point.",
      medianListed: "Median listed",
      fundingProxy: "Market proxy",
      banksSampled: "Banks sampled",
      latestMarketDate: "Latest market date",
      confidence: "Confidence",
      highConfidence: "High",
      mediumConfidence: "Medium",
      lowConfidence: "Low",
      lowConfidenceNote:
        "Few banks in the sample. Use the range as a rough signal, not a strong market level.",
      assumptionNote:
        "Based on listed rates, the Riksbanken/Refinitiv Stadshypotek CAISSE proxy and a simple margin model. The bank's real profitability floor can be higher or lower.",
      howToReadTitle: "How to read the margin zone",
      howToReadBody:
        "The zone is a reasonableness check, not a credit decision. It shows where the rate starts approaching a Swedish mortgage-bond proxy, not the bank's actual all-in cost.",
      howToReadFloor:
        "The lower end sits closest to the proxy and should be read as very thin margin in the model.",
      howToReadMidpoint:
        "The midpoint is a practical approximate level for judging whether an offer is near the model's margin floor.",
      howToReadCeiling:
        "The upper end is less pressed, but still near the modeled thin-margin zone.",
      dataBehindRange: "Data behind this margin zone",
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
    freshness: {
      status: "Status",
      eyebrow: "Data freshness",
      title: "How current the data is",
      body:
        "The dashboard is a static snapshot. Check both when the snapshot was exported and the latest market date inside it.",
      fresh: "Current",
      watch: "Watch",
      stale: "Stale",
      invalid: "Unknown",
      generatedAt: "Exported",
      latestMarketDate: "Latest market date",
      snapshotAge: "Snapshot age",
      marketAge: "Market data age",
      sourceCount: "Public source links",
      hourAgo: "1 hour ago",
      hoursAgo: "{count} hours ago",
      dayAgo: "1 day ago",
      daysAgo: "{count} days ago",
    },
    sources: {
      title: "Sources behind the data points",
      body:
        "These links point to the public sources and references used for rates, bank comparisons and margin context.",
      empty: "No public source links are included in this snapshot.",
      usedFor: "Used for",
      source: "Source",
      method: "Method",
      context: "Context",
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
        "This state leaves the mortgage flow and shows the product architecture behind it: public raw sources become staging models, mart tables, validated contracts and finally a cheap static data product.",
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
            "Riksbank rates, SCB data and bank published list rates land unchanged in separate raw tables with clear source separation.",
        },
        {
          title: "2. dbt cleans and models",
          body:
            "Staging models type, deduplicate and normalize names. Mart models produce daily rates, bank comparisons and funding proxies.",
        },
        {
          title: "3. CI and contracts protect the app",
          body:
            "The validator requires sorted time series, ordered quantiles, source links and non-empty negotiation options before anything is published.",
        },
        {
          title: "4. The app gets only a curated snapshot",
          body:
            "Public users never query Athena. GitHub Actions exports compact JSON to S3 and CloudFront, keeping the app fast and cheap.",
        },
      ],
    },
    limitations: {
      eyebrow: "Important caveat",
      title: "What this app does not know about you",
      body:
        "The app shows market context and negotiation room. It does not replace a lender's credit decision and does not know your personal risk profile.",
      items: [
        "Loan-to-value, income, amortization requirements and other debt.",
        "Your relationship with the bank, savings, insurance and history.",
        "Temporary campaigns, manual exceptions and the bank's internal risk price.",
        "Whether you value the lowest possible rate or stability over time.",
      ],
    },
    fundingIntro: {
      eyebrow: "Before you pick a binding period",
      title: "What the funding proxy means",
      body:
        "The app uses Riksbanken/Refinitiv Swedish mortgage-bond market rates as a transparent proxy for secured mortgage funding. Riksbanken describes the mortgage-bond series as Stadshypotek's CAISSE bond, so this is a market proxy, not a bank-by-bank measure of each lender's actual funding cost.",
      points: [
        {
          title: "Short binding periods move faster with market rates",
          body:
            "Variable and short mortgages are more directly affected by the policy rate and short market rates, with the covered-bond spread used as a proxy component.",
        },
        {
          title: "Longer binding periods use the CAISSE curve proxy",
          body:
            "Fixed mortgages are compared with government-bond yields plus the observed Stadshypotek CAISSE mortgage-bond spread.",
        },
        {
          title: "Negotiation is mostly about the margin",
          body:
            "The modeled gap is margin room over the market proxy. Actual bank funding also depends on deposits, hedging, liquidity, capital and internal pricing.",
        },
      ],
    },
    caisse: {
      eyebrow: "Funding proxy",
      title: "What CAISSE means in this app",
      body:
        "The app's funding proxy is built from Riksbanken's public Swedish mortgage-bond series SEMB2YCACOMB and SEMB5YCACOMB. Riksbanken groups them as Swedish mortgage bonds, its API metadata identifies Refinitiv as the source, and its market-rate explainer describes the mortgage-bond series as Stadshypotek's bond, CAISSE.",
      points: [
        {
          title: "Stadshypotek is linked to Handelsbanken",
          body:
            "Stadshypotek AB is Handelsbanken's mortgage institution and a wholly owned subsidiary. The series should not be read as an all-bank Swedish funding average.",
        },
        {
          title: "CAISSE is a market benchmark",
          body:
            "Nasdaq documentation also shows 2Y and 5Y Stadshypotek futures, with delivery of Stadshypotek bonds near the relevant maturity. So CAISSE is best understood as a benchmark complex, not just a simple cash-bond observation.",
        },
        {
          title: "It is not the bank's actual funding cost",
          body:
            "The app uses it as an observable market proxy. A bank's real funding cost also depends on deposits, hedging, liquidity requirements, capital, issuance mix and internal transfer pricing.",
        },
      ],
      linksTitle: "Primary sources",
      links: [
        {
          label: "Riksbanken: search interest rates",
          url: "https://www.riksbank.se/en-gb/statistics/interest-rates-and-exchange-rates/search-interest-rates-and-exchange-rates/",
        },
        {
          label: "Riksbanken: API series list",
          url: "https://www.riksbank.se/en-gb/statistics/interest-rates-and-exchange-rates/retrieving-interest-rates-and-exchange-rates-via-api/series-for-the-api/",
        },
        {
          label: "Riksbanken: Swedish market rates",
          url: "https://www.riksbank.se/en-gb/statistics/interest-rates-and-exchange-rates/explanations--interest-rates-and-exchange-rates/swedish-market-rates/",
        },
        {
          label: "Nasdaq: Stadshypotek futures",
          url: "https://www.nasdaq.com/docs/Stadshypotek%20Futures%20Product%20Sheet.pdf",
        },
      ],
      usageTitle: "How the proxy is used by binding period",
      usage: [
        {
          period: "3M and 1Y",
          proxy: "Policy rate + SWESTR 3M spread + 5Y CAISSE spread",
        },
        {
          period: "2Y",
          proxy: "2Y government bond + 2Y CAISSE spread",
        },
        {
          period: "3Y-4Y",
          proxy: "Interpolation between the 2Y and 5Y CAISSE spread",
        },
        {
          period: "5Y and longer",
          proxy: "5Y government bond + 5Y CAISSE spread",
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
    scrollRangeResultIntoView();
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
      ${
        snapshot
          ? renderDurationFlow(
              labels.flow,
              kpis?.latestDate ?? null,
              negotiationOptions,
              selectedRange,
              snapshot.sourceLinks,
            )
          : ""
      }
      ${
        snapshot && kpis
          ? renderFreshnessPanel(
              labels.freshness,
              snapshot,
              kpis,
              state.value === "stale" ? state.reason : null,
            )
          : ""
      }
      ${kpis && snapshot ? renderKpiGrid(kpis, labels.rates, snapshot.sourceLinks) : ""}
      ${
        snapshot && selectedRange
          ? renderProgressiveSection(
              labels.charts.aria,
              renderInsightCharts(labels.charts, negotiationOptions, selectedRange, snapshot),
              "evidence-section",
              "chart",
            )
          : ""
      }
      ${
        snapshot && selectedRange
          ? renderProgressiveSection(
              labels.limitations.title,
              renderLimitations(labels.limitations),
              "limitations-section",
              "shield",
            )
          : ""
      }
      ${renderFundingIntro(labels.fundingIntro)}
      ${renderCaisseSection(labels.caisse)}
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

type FreshnessLevel = "fresh" | "watch" | "stale" | "invalid";

type FreshnessMetric = {
  level: FreshnessLevel;
  generatedAtLabel: string;
  latestMarketDateLabel: string;
  snapshotAgeLabel: string;
  marketAgeLabel: string;
  sourceCountLabel: string;
};

function renderFreshnessPanel(
  labels: AppCopy["freshness"],
  snapshot: DashboardSnapshot,
  kpis: DashboardKpis,
  staleReason: string | null,
): string {
  const metric = deriveFreshnessMetric(labels, snapshot, kpis, staleReason);
  return `
    <section class="freshness-panel freshness-${metric.level}" aria-label="${escapeAttr(labels.title)}">
      <div>
        <p class="eyebrow icon-label">${renderIcon("clock")}${escapeHtml(labels.eyebrow)}</p>
        <h2>${escapeHtml(labels.title)}</h2>
        <p>${escapeHtml(labels.body)}</p>
        ${staleReason ? `<p class="freshness-reason">${escapeHtml(staleReason)}</p>` : ""}
      </div>
      <dl class="freshness-grid">
        ${renderFreshnessDetail(labels.generatedAt, metric.generatedAtLabel)}
        ${renderFreshnessDetail(labels.latestMarketDate, metric.latestMarketDateLabel)}
        ${renderFreshnessDetail(labels.snapshotAge, metric.snapshotAgeLabel)}
        ${renderFreshnessDetail(labels.marketAge, metric.marketAgeLabel)}
        ${renderFreshnessDetail(labels.sourceCount, metric.sourceCountLabel)}
        ${renderFreshnessDetail(labels.status, labels[metric.level], `freshness-badge freshness-badge-${metric.level}`)}
      </dl>
    </section>
  `;
}

function renderFreshnessDetail(
  label: string,
  value: string,
  valueClass = "",
): string {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd class="${escapeAttr(valueClass)}">${escapeHtml(value)}</dd>
    </div>
  `;
}

function deriveFreshnessMetric(
  labels: AppCopy["freshness"],
  snapshot: DashboardSnapshot,
  kpis: DashboardKpis,
  staleReason: string | null,
): FreshnessMetric {
  const generatedAt = Date.parse(snapshot.generatedAt);
  const marketDate = Date.parse(`${kpis.latestDate}T00:00:00Z`);
  const snapshotAgeHours = Number.isNaN(generatedAt)
    ? null
    : Math.max(0, Math.floor((Date.now() - generatedAt) / 1000 / 60 / 60));
  const marketAgeDays = Number.isNaN(marketDate)
    ? null
    : Math.max(0, Math.floor((Date.now() - marketDate) / 1000 / 60 / 60 / 24));

  let level: FreshnessLevel = "fresh";
  if (staleReason || snapshotAgeHours === null || marketAgeDays === null) {
    level = staleReason ? "stale" : "invalid";
  } else if (snapshotAgeHours > 36 || marketAgeDays > 7) {
    level = "stale";
  } else if (snapshotAgeHours > 24 || marketAgeDays > 4) {
    level = "watch";
  }

  return {
    level,
    generatedAtLabel: Number.isNaN(generatedAt)
      ? copy[locale].diagnostics.unavailable
      : new Intl.DateTimeFormat(locale === "sv" ? "sv-SE" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(generatedAt)),
    latestMarketDateLabel: Number.isNaN(marketDate)
      ? copy[locale].diagnostics.unavailable
      : new Intl.DateTimeFormat(locale === "sv" ? "sv-SE" : "en-US", {
          dateStyle: "medium",
        }).format(new Date(marketDate)),
    snapshotAgeLabel:
      snapshotAgeHours === null
        ? copy[locale].diagnostics.unavailable
        : formatFreshnessAge(snapshotAgeHours, labels.hourAgo, labels.hoursAgo),
    marketAgeLabel:
      marketAgeDays === null
        ? copy[locale].diagnostics.unavailable
        : formatFreshnessAge(marketAgeDays, labels.dayAgo, labels.daysAgo),
    sourceCountLabel: String(snapshot.sourceLinks.length),
  };
}

function formatFreshnessAge(
  count: number,
  singularLabel: string,
  pluralLabel: string,
): string {
  return count === 1 ? singularLabel : pluralLabel.replace("{count}", String(count));
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
            (point, index) => `
              <article class="funding-point">
                <strong>${renderIcon(fundingPointIcon(index))}${escapeHtml(point.title)}</strong>
                <span>${escapeHtml(point.body)}</span>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCaisseSection(labels: AppCopy["caisse"]): string {
  return `
    <section class="caisse-panel">
      <div class="caisse-copy">
        <p class="eyebrow">${escapeHtml(labels.eyebrow)}</p>
        <h2>${escapeHtml(labels.title)}</h2>
        <p>${escapeHtml(labels.body)}</p>
      </div>
      <div class="caisse-grid">
        ${labels.points
          .map(
            (point, index) => `
              <article class="caisse-point">
                <strong>${renderIcon(fundingPointIcon(index))}${escapeHtml(point.title)}</strong>
                <p>${escapeHtml(point.body)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
      <div class="caisse-links" aria-label="${escapeAttr(labels.linksTitle)}">
        <strong>${escapeHtml(labels.linksTitle)}</strong>
        <div>
          ${labels.links
            .map(
              (link) => `
                <a href="${escapeAttr(link.url)}" rel="noreferrer" target="_blank">
                  ${renderIcon("external")}
                  ${escapeHtml(link.label)}
                </a>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="caisse-usage">
        <strong>${escapeHtml(labels.usageTitle)}</strong>
        <dl>
          ${labels.usage
            .map(
              (row) => `
                <div>
                  <dt>${escapeHtml(row.period)}</dt>
                  <dd>${escapeHtml(row.proxy)}</dd>
                </div>
              `,
            )
            .join("")}
        </dl>
      </div>
    </section>
  `;
}

function renderKpiGrid(
  kpis: DashboardKpis,
  labels: AppCopy["rates"],
  sources: SourceLink[],
): string {
  return `
    <section class="kpi-grid" aria-label="Mortgage market summary">
      ${renderKpiCard(
        labels.policyRate,
        formatRate(kpis.latestPolicyRate),
        `${labels.latestSourceDate} ${kpis.latestDate}`,
        kpis.policyRateChange30d,
        labels.vs30dAgo,
        sourceById(sources, "riksbank-swea"),
        "bank",
      )}
      ${renderKpiCard(
        labels.mortgageBond2y,
        formatRate(kpis.latestMortgageBond2y),
        labels.mortgageBondProxy,
        kpis.mortgageBond2yChange30d,
        labels.vs30dAgo,
        sourceById(sources, "riksbank-swea"),
        "bond",
      )}
      ${renderKpiCard(
        labels.mortgageBond5y,
        formatRate(kpis.latestMortgageBond5y),
        labels.mortgageBondProxy,
        kpis.mortgageBond5yChange30d,
        labels.vs30dAgo,
        sourceById(sources, "riksbank-swea"),
        "bond",
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
  source: SourceLink | null,
  icon: IconName,
): string {
  return `
    <article class="kpi-card">
      <p class="eyebrow icon-label">${renderIcon(icon)}${escapeHtml(label)}</p>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(detail)}</span>
      <span class="delta">${escapeHtml(formatDelta(delta))} ${escapeHtml(vsLabel)}</span>
      ${source ? renderSourceChip(source) : ""}
    </article>
  `;
}

function renderDurationFlow(
  labels: AppCopy["flow"],
  latestDate: string | null,
  options: NegotiationOption[],
  range: NegotiationRange | null,
  sources: SourceLink[],
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
                  ${renderIcon("clock")}
                  ${escapeHtml(option.periodLabelDisplay)}
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      ${range ? renderNegotiationRangePanel(labels, latestDate, range, sources) : renderEmptyRange(labels)}
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
  sources: SourceLink[],
): string {
  const confidence = confidenceForBankCount(range.option.bankCount);
  const bankRateSource = sourceById(sources, "bank-listed-rates");
  const fundingSource = sourceById(sources, "riksbank-swea");
  const marginSource = sourceById(sources, "fi-gross-margin");
  return `
    <article class="range-card" data-range-result tabindex="-1">
      <p class="eyebrow">${escapeHtml(labels.step2)}</p>
      <h2><span class="heading-icon">${renderIcon("target")}</span>${escapeHtml(range.option.periodLabelDisplay)} ${escapeHtml(labels.negotiationRange)}</h2>
      <div class="range-value">${escapeHtml(formatRate(range.floorRate))}-${escapeHtml(formatRate(range.ceilingRate))}</div>
      <p>
        ${escapeHtml(labels.rangeBodyStart)}
        <strong>${escapeHtml(formatRate(range.midpointRate))}</strong>
        ${escapeHtml(labels.rangeBodyMiddle)}
        <strong>${escapeHtml(formatDelta(range.discountFromMedianListRate))}</strong>
        ${escapeHtml(labels.rangeBodyEnd)}
      </p>
      <p class="assumption-note">${escapeHtml(labels.assumptionNote)}</p>
      ${renderRangeGuide(labels)}
      ${
        confidence === "low"
          ? `<p class="confidence-warning">${escapeHtml(labels.lowConfidenceNote)}</p>`
          : ""
      }
      <details class="range-data">
        <summary>${renderIcon("database")}${escapeHtml(labels.dataBehindRange)}</summary>
        <dl class="range-details">
          ${renderDetail(labels.medianListed, formatRate(range.option.medianListRate), bankRateSource)}
          ${renderDetail(labels.fundingProxy, formatRate(range.option.medianFundingCost), fundingSource)}
          ${renderDetail(labels.banksSampled, String(range.option.bankCount), bankRateSource)}
          ${renderDetail(labels.confidence, confidenceLabel(labels, confidence), marginSource)}
          ${renderDetail(latestDate ? labels.latestMarketDate : labels.latestMarketDate, latestDate ?? copy[locale].diagnostics.unavailable)}
        </dl>
      </details>
    </article>
  `;
}

function scrollRangeResultIntoView(): void {
  window.requestAnimationFrame(() => {
    const rangeResult = appRoot.querySelector<HTMLElement>("[data-range-result]");
    if (!rangeResult) return;
    rangeResult.focus({ preventScroll: true });
    rangeResult.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  });
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function renderRangeGuide(labels: AppCopy["flow"]): string {
  return `
    <details class="range-guide">
      <summary>${renderIcon("target")}${escapeHtml(labels.howToReadTitle)}</summary>
      <p>${escapeHtml(labels.howToReadBody)}</p>
      <ul>
        <li>${escapeHtml(labels.howToReadFloor)}</li>
        <li>${escapeHtml(labels.howToReadMidpoint)}</li>
        <li>${escapeHtml(labels.howToReadCeiling)}</li>
      </ul>
    </details>
  `;
}

function renderDetail(
  label: string,
  value: string,
  source: SourceLink | null = null,
): string {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
      ${source ? renderSourceChip(source) : ""}
    </div>
  `;
}

function sourceById(sources: SourceLink[], id: string): SourceLink | null {
  return sources.find((source) => source.id === id) ?? null;
}

function renderSourceChip(source: SourceLink): string {
  const kind = sourceKind(source);
  return `
    <a
      class="source-chip source-chip-${kind}"
      href="${escapeAttr(source.url)}"
      rel="noreferrer"
      target="_blank"
      title="${escapeAttr(source.usedFor)}"
    >
      ${renderIcon("external")}
      <span class="source-kind">${escapeHtml(sourceKindLabel(kind, copy[locale].sources))}</span>
      ${escapeHtml(source.label)}
    </a>
  `;
}

function sourceKind(source: SourceLink): SourceKind {
  if (source.id.includes("fi-")) return "context";
  if (source.id.includes("scb-")) return "method";
  return "source";
}

function sourceKindLabel(kind: SourceKind, labels: AppCopy["sources"]): string {
  return labels[kind];
}

function fundingPointIcon(index: number): IconName {
  if (index === 0) return "clock";
  if (index === 1) return "bond";
  return "target";
}

function renderIcon(name: IconName): string {
  const paths: Record<IconName, string> = {
    arrowLeft:
      '<path d="M19 12H5"/><path d="m12 5-7 7 7 7"/>',
    bank:
      '<path d="M3 9h18L12 4 3 9Z"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M4 18h16M3 21h18"/>',
    bond:
      '<path d="M6 5h12v14H6z"/><path d="M8.5 9h7M8.5 12h7M8.5 15h4"/><path d="m15 5 3 3"/>',
    chart:
      '<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 4-7"/>',
    check:
      '<path d="M20 6 9 17l-5-5"/><path d="M4 19h16"/>',
    clock:
      '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>',
    database:
      '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    external:
      '<path d="M14 4h6v6"/><path d="m10 14 10-10"/><path d="M18 13v6H5V6h6"/>',
    github:
      '<path d="M12 3a9 9 0 0 0-3 17c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.7-1.3-2.2-.3-4.6-1.1-4.6-5A3.9 3.9 0 0 1 7 6.4c-.1-.3-.4-1.3.1-2.6 0 0 .9-.3 2.8 1a9.7 9.7 0 0 1 5.1 0c1.9-1.3 2.8-1 2.8-1 .5 1.3.2 2.3.1 2.6a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7 1 .7 2v3.4c0 .3.2.6.8.5A9 9 0 0 0 12 3Z"/>',
    pipeline:
      '<path d="M4 7h6v6H4zM14 11h6v6h-6z"/><path d="M10 10h2.5c.8 0 1.5.7 1.5 1.5V14"/>',
    shield:
      '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/>',
    target:
      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  };

  return `<svg class="icon icon-${name}" aria-hidden="true" viewBox="0 0 24 24">${paths[name]}</svg>`;
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
      <button class="secondary-button" data-action="view-pipeline" type="button">${renderIcon("pipeline")}${escapeHtml(labels.cta)}</button>
    </section>
  `;
}

function renderLimitations(labels: AppCopy["limitations"]): string {
  return `
    <section class="limitations-panel">
      <div>
        <p class="eyebrow">${escapeHtml(labels.eyebrow)}</p>
        <h2>${escapeHtml(labels.title)}</h2>
        <p>${escapeHtml(labels.body)}</p>
      </div>
      <ul>
        ${labels.items.map((item) => `<li>${renderIcon("shield")}${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderProgressiveSection(
  summary: string,
  body: string,
  className: string,
  icon: IconName,
): string {
  return `
    <details class="progressive-section ${escapeAttr(className)}">
      <summary>${renderIcon(icon)}${escapeHtml(summary)}</summary>
      ${body}
    </details>
  `;
}

function renderPipelineScreen(
  labels: AppCopy["pipeline"],
  snapshot: DashboardSnapshot,
): string {
  const exportedRows = snapshot.rates.length + snapshot.negotiationOptions.length;
  return `
    <main class="pipeline-screen">
      <button class="secondary-button pipeline-back" data-action="close-pipeline" type="button">${renderIcon("arrowLeft")}${escapeHtml(labels.close)}</button>
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
          <div class="pipeline-node raw">${renderIcon("database")}raw</div>
          <div class="pipeline-arrow"></div>
          <div class="pipeline-node stage">${renderIcon("pipeline")}stg</div>
          <div class="pipeline-arrow"></div>
          <div class="pipeline-node mart">${renderIcon("check")}mart</div>
          <div class="pipeline-arrow"></div>
          <div class="pipeline-node publish">${renderIcon("external")}json</div>
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
          ${labels.controls.map((control) => `<li>${renderIcon("shield")}${escapeHtml(control)}</li>`).join("")}
        </ul>
        <div class="pipeline-github-links">
          ${labels.githubLinks
            .map(
              (link) =>
                `<a href="${escapeAttr(link.url)}" rel="noreferrer" target="_blank">${renderIcon("github")}${escapeHtml(link.label)}</a>`,
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
  const kind = sourceKind(source);
  return `
    <a class="source-link" href="${escapeAttr(source.url)}" rel="noreferrer" target="_blank">
      <strong>${renderIcon("external")}${escapeHtml(source.label)}</strong>
      <span class="source-link-kind">${escapeHtml(sourceKindLabel(kind, labels))}</span>
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
    ariaLabel: `${labels.policyRate}, ${labels.mortgageBond2y}, ${labels.mortgageBond5y}`,
    className: "chart",
    series: [
      {
        label: labels.policyRate,
        valueLabel: formatRate(lastValue(snapshot.rates.map((row) => row.policyRate))),
        values: snapshot.rates.map((row) => row.policyRate),
        color: "#743a22",
      },
      {
        label: labels.mortgageBond2y,
        valueLabel: formatRate(lastValue(snapshot.rates.map((row) => row.mortgageBond2y))),
        values: snapshot.rates.map((row) => row.mortgageBond2y),
        color: "#58705d",
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
  const latestFundingProxy2y = lastValue(
    snapshot.rates.map((row) => row.mortgageBond2y),
  );
  const latestFundingProxy5y = lastValue(
    snapshot.rates.map((row) => row.mortgageBond5y),
  );

  return (
    renderChartSummary([
      { label: labels.policyRate, value: formatRate(latestPolicyRate) },
      { label: labels.coveredBondProxy2y, value: formatRate(latestFundingProxy2y) },
      { label: labels.coveredBondProxy5y, value: formatRate(latestFundingProxy5y) },
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
        label: labels.coveredBondProxy2y,
        valueLabel: formatRate(latestFundingProxy2y),
        values: snapshot.rates.map((row) => row.mortgageBond2y),
        color: "#58705d",
      },
      {
        label: labels.coveredBondProxy5y,
        valueLabel: formatRate(latestFundingProxy5y),
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
