/**
 * Country-specific investing reference data: regulators, regulated platforms and the funds the
 * Funds tab tracks. Kept as plain data so it is easy to review and update. Licence details were
 * checked against regulator notices and company statements in October 2026; users are always
 * pointed at the regulator's own register to confirm before investing.
 */

export type CountryCode = "NG" | "US" | "GB" | "CA";

export interface Regulator {
  name: string;
  short: string;
  /** public register where anyone can confirm a firm's licence */
  registerUrl: string;
  registerLabel: string;
}

export interface Country {
  code: CountryCode;
  name: string;
  flag: string;
  currency: string;
  regulators: Regulator[];
  /** tax-advantaged accounts worth knowing about */
  accounts: { name: string; note: string }[];
}

export const COUNTRIES: Country[] = [
  {
    code: "NG",
    name: "Nigeria",
    flag: "🇳🇬",
    currency: "NGN",
    regulators: [
      {
        name: "Securities and Exchange Commission, Nigeria",
        short: "SEC Nigeria",
        registerUrl: "https://sec.gov.ng/",
        registerLabel: "SEC Nigeria registered operators",
      },
    ],
    accounts: [
      {
        name: "Retirement Savings Account (RSA)",
        note: "Your pension; voluntary contributions are tax-deductible.",
      },
      {
        name: "Mutual funds",
        note: "Professionally managed pools; many start from ₦1,000–₦5,000.",
      },
      {
        name: "FGN Savings Bonds & T-bills",
        note: "Backed by the Federal Government; the lowest-risk Naira investments.",
      },
    ],
  },
  {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    currency: "USD",
    regulators: [
      {
        name: "Financial Industry Regulatory Authority",
        short: "FINRA",
        registerUrl: "https://brokercheck.finra.org/",
        registerLabel: "FINRA BrokerCheck",
      },
      {
        name: "U.S. Securities and Exchange Commission",
        short: "SEC",
        registerUrl: "https://adviserinfo.sec.gov/",
        registerLabel: "SEC Investment Adviser search",
      },
    ],
    accounts: [
      { name: "401(k) / 403(b)", note: "Employer plan; take any employer match first." },
      {
        name: "Roth IRA / Traditional IRA",
        note: "Tax-free or tax-deferred growth, yearly limits apply.",
      },
      { name: "HSA", note: "Triple tax advantage if you have a high-deductible health plan." },
    ],
  },
  {
    code: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    currency: "GBP",
    regulators: [
      {
        name: "Financial Conduct Authority",
        short: "FCA",
        registerUrl: "https://register.fca.org.uk/",
        registerLabel: "FCA Financial Services Register",
      },
    ],
    accounts: [
      { name: "Stocks & Shares ISA", note: "Up to £20,000 a year grows tax-free." },
      {
        name: "Lifetime ISA",
        note: "25% government bonus for a first home or retirement (ages 18–39 to open).",
      },
      { name: "SIPP / workplace pension", note: "Tax relief on contributions." },
    ],
  },
  {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    currency: "CAD",
    regulators: [
      {
        name: "Canadian Investment Regulatory Organization",
        short: "CIRO",
        registerUrl: "https://www.ciro.ca/",
        registerLabel: "CIRO",
      },
      {
        name: "Canadian Securities Administrators",
        short: "CSA",
        registerUrl: "https://www.aretheyregistered.ca/",
        registerLabel: "CSA National Registration Search",
      },
    ],
    accounts: [
      {
        name: "TFSA",
        note: "Tax-free growth and withdrawals; contribution room builds each year.",
      },
      { name: "RRSP", note: "Tax-deductible contributions, taxed on withdrawal." },
      { name: "FHSA", note: "First home savings: deductible in, tax-free out for a first home." },
    ],
  },
];

export const countryByCode = (code: string | null | undefined) =>
  COUNTRIES.find((c) => c.code === code) ?? null;

/** Best guess from the user's base currency when they haven't picked a country yet. */
export function countryFromCurrency(currency: string | null | undefined): CountryCode {
  return (
    ({ USD: "US", GBP: "GB", CAD: "CA" } as Record<string, CountryCode>)[currency ?? ""] ?? "NG"
  );
}

export type PlatformKind = "Fund manager" | "Investment app" | "Stockbroker" | "Robo-advisor";

export interface Platform {
  name: string;
  kind: PlatformKind;
  /** what you can invest in there */
  offers: string;
  /** licence as stated by the regulator or the firm; "check register" when the category isn't confirmed */
  licence: string;
  url: string;
  bestFor: string;
}

export const PLATFORMS: Record<CountryCode, Platform[]> = {
  NG: [
    {
      name: "Cowrywise",
      kind: "Investment app",
      offers: "Mutual funds (money market, fixed income, dollar, equity), savings plans",
      licence: "SEC Nigeria Fund/Portfolio Manager",
      url: "https://cowrywise.com/",
      bestFor: "Automated saving into mutual funds from a small amount",
    },
    {
      name: "Risevest",
      kind: "Investment app",
      offers: "Dollar investments: US stocks, real estate and fixed income portfolios",
      licence: "SEC Nigeria Fund/Portfolio Manager (RV Fund Management, 2026)",
      url: "https://risevest.com/",
      bestFor: "Building dollar savings to hedge against Naira weakness",
    },
    {
      name: "Chaka",
      kind: "Stockbroker",
      offers: "Nigerian stocks",
      licence: "SEC Nigeria Digital Sub-Broker",
      url: "https://chaka.com/",
      bestFor: "Buying NGX-listed shares from your phone",
    },
    {
      name: "Bamboo",
      kind: "Stockbroker",
      offers: "US and Nigerian stocks and ETFs",
      licence: "Reported SEC-licensed; check the register for the category",
      url: "https://investbamboo.com/",
      bestFor: "US stocks and ETFs in small amounts",
    },
    {
      name: "Trove",
      kind: "Stockbroker",
      offers: "US and Nigerian stocks, ETFs and bonds",
      licence: "Reported SEC-licensed; check the register for the category",
      url: "https://troveapp.co/",
      bestFor: "Mixing local and foreign stocks in one account",
    },
    {
      name: "Stanbic IBTC Asset Management",
      kind: "Fund manager",
      offers: "Money market, bond, equity, balanced, ethical and dollar mutual funds",
      licence: "SEC Nigeria Fund/Portfolio Manager",
      url: "https://www.stanbicibtcassetmanagement.com/",
      bestFor: "A wide range of funds from one of the largest managers",
    },
    {
      name: "ARM Investment Managers",
      kind: "Fund manager",
      offers: "Money market, fixed income, equity, ethical and Eurobond funds",
      licence: "SEC Nigeria Fund/Portfolio Manager",
      url: "https://arm.com.ng/",
      bestFor: "Established funds with long track records",
    },
    {
      name: "FBNQuest Asset Management",
      kind: "Fund manager",
      offers: "Money market, fixed income, Eurobond and equity funds",
      licence: "SEC Nigeria Fund/Portfolio Manager",
      url: "https://www.fbnquest.com/",
      bestFor: "Dollar (Eurobond) funds and fixed income",
    },
    {
      name: "United Capital Asset Management",
      kind: "Fund manager",
      offers: "Money market, fixed income, Eurobond, equity and ethical funds",
      licence: "SEC Nigeria Fund/Portfolio Manager",
      url: "https://www.unitedcapitalplcgroup.com/",
      bestFor: "Eurobond and fixed income funds",
    },
    {
      name: "Meristem Wealth Management",
      kind: "Fund manager",
      offers: "Money market and equity funds, stockbroking",
      licence: "SEC Nigeria Fund/Portfolio Manager",
      url: "https://meristemng.com/",
      bestFor: "Combining funds with a stockbroking account",
    },
  ],
  US: [
    {
      name: "Fidelity",
      kind: "Stockbroker",
      offers: "Stocks, ETFs, mutual funds, bonds, IRAs, 401(k)s",
      licence: "FINRA member, SEC-registered",
      url: "https://www.fidelity.com/",
      bestFor: "Zero-fee index funds and retirement accounts",
    },
    {
      name: "Charles Schwab",
      kind: "Stockbroker",
      offers: "Stocks, ETFs, mutual funds, bonds, IRAs",
      licence: "FINRA member, SEC-registered",
      url: "https://www.schwab.com/",
      bestFor: "Low-cost ETFs and strong customer service",
    },
    {
      name: "Vanguard",
      kind: "Fund manager",
      offers: "Index mutual funds and ETFs, IRAs",
      licence: "FINRA member, SEC-registered",
      url: "https://investor.vanguard.com/",
      bestFor: "Buy-and-hold index investing",
    },
    {
      name: "Interactive Brokers",
      kind: "Stockbroker",
      offers: "Global stocks, ETFs, options, bonds",
      licence: "FINRA member, SEC-registered",
      url: "https://www.interactivebrokers.com/",
      bestFor: "Access to many international markets",
    },
    {
      name: "Betterment",
      kind: "Robo-advisor",
      offers: "Managed ETF portfolios, IRAs",
      licence: "SEC-registered investment adviser",
      url: "https://www.betterment.com/",
      bestFor: "Hands-off automatic investing and rebalancing",
    },
    {
      name: "Wealthfront",
      kind: "Robo-advisor",
      offers: "Managed ETF portfolios, IRAs, cash account",
      licence: "SEC-registered investment adviser",
      url: "https://www.wealthfront.com/",
      bestFor: "Automated portfolios with tax-loss harvesting",
    },
  ],
  GB: [
    {
      name: "Vanguard UK Investor",
      kind: "Fund manager",
      offers: "Vanguard index funds and ETFs, ISA, SIPP",
      licence: "FCA authorised",
      url: "https://www.vanguardinvestor.co.uk/",
      bestFor: "Low-cost index funds in an ISA",
    },
    {
      name: "Hargreaves Lansdown",
      kind: "Stockbroker",
      offers: "Funds, shares, ETFs, ISA, SIPP",
      licence: "FCA authorised",
      url: "https://www.hl.co.uk/",
      bestFor: "Wide fund choice and research",
    },
    {
      name: "AJ Bell",
      kind: "Stockbroker",
      offers: "Funds, shares, ETFs, ISA, SIPP, LISA",
      licence: "FCA authorised",
      url: "https://www.ajbell.co.uk/",
      bestFor: "Low fees across ISA and pension",
    },
    {
      name: "Trading 212",
      kind: "Investment app",
      offers: "Shares and ETFs, Stocks & Shares ISA",
      licence: "FCA authorised",
      url: "https://www.trading212.com/",
      bestFor: "Commission-free ETFs and fractional shares",
    },
    {
      name: "Freetrade",
      kind: "Investment app",
      offers: "Shares, ETFs, ISA, SIPP",
      licence: "FCA authorised",
      url: "https://freetrade.io/",
      bestFor: "Simple app for ISA investing",
    },
    {
      name: "Nutmeg",
      kind: "Robo-advisor",
      offers: "Managed portfolios, ISA, LISA, pension",
      licence: "FCA authorised",
      url: "https://www.nutmeg.com/",
      bestFor: "Hands-off managed portfolios",
    },
  ],
  CA: [
    {
      name: "Wealthsimple",
      kind: "Investment app",
      offers: "Stocks, ETFs, managed portfolios, TFSA, RRSP, FHSA",
      licence: "CIRO member",
      url: "https://www.wealthsimple.com/",
      bestFor: "Commission-free trading and robo portfolios",
    },
    {
      name: "Questrade",
      kind: "Stockbroker",
      offers: "Stocks, ETFs, options, TFSA, RRSP, FHSA",
      licence: "CIRO member",
      url: "https://www.questrade.com/",
      bestFor: "Self-directed ETF investing",
    },
    {
      name: "Qtrade Direct Investing",
      kind: "Stockbroker",
      offers: "Stocks, ETFs, mutual funds, registered accounts",
      licence: "CIRO member",
      url: "https://www.qtrade.ca/",
      bestFor: "Research tools and service",
    },
    {
      name: "RBC Direct Investing",
      kind: "Stockbroker",
      offers: "Stocks, ETFs, mutual funds, GICs, registered accounts",
      licence: "CIRO member",
      url: "https://www.rbcdirectinvesting.com/",
      bestFor: "Investing alongside your RBC banking",
    },
    {
      name: "Interactive Brokers Canada",
      kind: "Stockbroker",
      offers: "Global stocks, ETFs, options, registered accounts",
      licence: "CIRO member",
      url: "https://www.interactivebrokers.ca/",
      bestFor: "Low costs and US/international access",
    },
    {
      name: "Justwealth",
      kind: "Robo-advisor",
      offers: "Managed ETF portfolios, TFSA, RRSP, RESP",
      licence: "Registered portfolio manager (check CSA search)",
      url: "https://www.justwealth.com/",
      bestFor: "Hands-off portfolios with a dedicated manager",
    },
  ],
};

export type FundRisk = "low" | "medium" | "high";

export interface Fund {
  symbol: string; // price feed ticker
  name: string;
  category: string;
  risk: FundRisk;
  /** approximate ongoing charge / expense ratio, % per year (check the fund page) */
  fee: number;
  what: string;
}

/** Broad, low-cost index funds tracked with live prices. Popular choices, not recommendations. */
export const FUNDS: Record<Exclude<CountryCode, "NG">, Fund[]> = {
  US: [
    {
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      category: "US large companies",
      risk: "high",
      fee: 0.03,
      what: "The 500 largest US companies",
    },
    {
      symbol: "VTI",
      name: "Vanguard Total Stock Market ETF",
      category: "Whole US market",
      risk: "high",
      fee: 0.03,
      what: "About 3,500 US companies, large to small",
    },
    {
      symbol: "VT",
      name: "Vanguard Total World Stock ETF",
      category: "Global stocks",
      risk: "high",
      fee: 0.06,
      what: "Companies across developed and emerging markets",
    },
    {
      symbol: "QQQ",
      name: "Invesco QQQ Trust",
      category: "US tech-heavy",
      risk: "high",
      fee: 0.2,
      what: "The 100 largest non-financial Nasdaq companies",
    },
    {
      symbol: "SCHD",
      name: "Schwab U.S. Dividend Equity ETF",
      category: "US dividends",
      risk: "medium",
      fee: 0.06,
      what: "US companies with strong, steady dividends",
    },
    {
      symbol: "VXUS",
      name: "Vanguard Total International Stock ETF",
      category: "Stocks outside the US",
      risk: "high",
      fee: 0.05,
      what: "Developed and emerging markets excluding the US",
    },
    {
      symbol: "BND",
      name: "Vanguard Total Bond Market ETF",
      category: "US bonds",
      risk: "low",
      fee: 0.03,
      what: "US government and investment-grade corporate bonds",
    },
  ],
  GB: [
    {
      symbol: "VWRP.L",
      name: "Vanguard FTSE All-World (Acc)",
      category: "Global stocks",
      risk: "high",
      fee: 0.19,
      what: "About 4,000 companies worldwide; dividends reinvested",
    },
    {
      symbol: "SWDA.L",
      name: "iShares Core MSCI World (Acc)",
      category: "Developed-world stocks",
      risk: "high",
      fee: 0.2,
      what: "Large and mid-size companies in developed markets",
    },
    {
      symbol: "VUAG.L",
      name: "Vanguard S&P 500 (Acc)",
      category: "US large companies",
      risk: "high",
      fee: 0.07,
      what: "The 500 largest US companies, held from the UK",
    },
    {
      symbol: "ISF.L",
      name: "iShares Core FTSE 100",
      category: "UK large companies",
      risk: "medium",
      fee: 0.07,
      what: "The 100 largest companies on the London Stock Exchange",
    },
    {
      symbol: "VAGP.L",
      name: "Vanguard Global Aggregate Bond (GBP hedged)",
      category: "Global bonds",
      risk: "low",
      fee: 0.1,
      what: "Government and corporate bonds worldwide, currency-hedged to pounds",
    },
  ],
  CA: [
    {
      symbol: "XEQT.TO",
      name: "iShares Core Equity ETF Portfolio",
      category: "All-in-one, 100% stocks",
      risk: "high",
      fee: 0.2,
      what: "Global stocks in one fund, rebalanced for you",
    },
    {
      symbol: "VEQT.TO",
      name: "Vanguard All-Equity ETF Portfolio",
      category: "All-in-one, 100% stocks",
      risk: "high",
      fee: 0.24,
      what: "Global stocks in one fund, rebalanced for you",
    },
    {
      symbol: "VGRO.TO",
      name: "Vanguard Growth ETF Portfolio",
      category: "All-in-one, 80/20",
      risk: "medium",
      fee: 0.24,
      what: "80% stocks, 20% bonds in one fund",
    },
    {
      symbol: "VFV.TO",
      name: "Vanguard S&P 500 Index ETF",
      category: "US large companies",
      risk: "high",
      fee: 0.09,
      what: "The 500 largest US companies, in Canadian dollars",
    },
    {
      symbol: "XIC.TO",
      name: "iShares Core S&P/TSX Capped Composite",
      category: "Canadian stocks",
      risk: "high",
      fee: 0.06,
      what: "About 220 of the largest Canadian companies",
    },
    {
      symbol: "ZAG.TO",
      name: "BMO Aggregate Bond Index ETF",
      category: "Canadian bonds",
      risk: "low",
      fee: 0.09,
      what: "Canadian government and corporate bonds",
    },
  ],
};

/** Nigerian mutual fund types. Live prices aren't available from a free feed, so we explain and link out. */
export const NG_FUND_TYPES: { name: string; risk: FundRisk; what: string; goodFor: string }[] = [
  {
    name: "Money market funds",
    risk: "low",
    what: "Short-term T-bills and bank deposits. Price stays stable; returns track interest rates.",
    goodFor: "Emergency fund and money you need within a year",
  },
  {
    name: "Fixed income / bond funds",
    risk: "low",
    what: "Government and corporate bonds. Usually a bit more than money market, with small swings.",
    goodFor: "Goals 1–3 years away",
  },
  {
    name: "Dollar (Eurobond) funds",
    risk: "medium",
    what: "Dollar bonds issued by Nigeria and Nigerian companies. Grows in dollars, so protects against Naira weakness.",
    goodFor: "Dollar goals such as school fees abroad or relocation",
  },
  {
    name: "Balanced funds",
    risk: "medium",
    what: "A mix of Nigerian stocks and bonds managed for you.",
    goodFor: "Middle-ground growth over 3–5 years",
  },
  {
    name: "Equity funds",
    risk: "high",
    what: "Shares of companies on the Nigerian Exchange. Can beat inflation over many years but can fall sharply.",
    goodFor: "Long-term money (5+ years) you won't need soon",
  },
  {
    name: "Ethical / Shari'ah-compliant funds",
    risk: "medium",
    what: "Screened investments that avoid interest and certain industries.",
    goodFor: "Investing in line with your values",
  },
];

export const NG_FUND_REPORT_URL = "https://sec.gov.ng/";
