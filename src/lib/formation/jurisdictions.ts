/**
 * Jurisdiction facts for the company-formation eligibility tool.
 *
 * Everything here is a documented rule of the country's own tax system, not
 * our opinion. Where a rule has a threshold or a name, it is written down so
 * the user can go and verify it — that is the whole point of the feature.
 *
 * NOTHING in this file may be reordered or filtered by what a partner pays.
 */

export interface CfcCountry {
  code: string;
  name: string;
  /** Short, checkable statement of the look-through rule. */
  rule: string;
}

/**
 * Countries with controlled-foreign-company (or equivalent look-through /
 * place-of-effective-management) rules that can attribute a foreign company's
 * profits to a resident owner whether or not a distribution was made.
 *
 * This is the list that makes the tool honest: for a resident of any of these,
 * a US LLC is very unlikely to reduce the personal tax bill, and we show no
 * formation partner on that outcome. See DISQUALIFYING_OUTCOMES in
 * src/config/partners.ts.
 *
 * Two separate mechanisms are grouped here deliberately, because for the user
 * the effect is the same:
 *   - CFC attribution (UK, DE, AU, US, JP, and most of the EU under ATAD)
 *   - Corporate residence by place of effective management: if you run the
 *     company from your sofa, many countries treat the company itself as
 *     locally resident and tax it directly.
 */
export const CFC_COUNTRIES: CfcCountry[] = [
  { code: "GB", name: "United Kingdom", rule: "CFC rules plus central-management-and-control: a company run from the UK is generally UK-resident and taxed here." },
  { code: "DE", name: "Germany", rule: "Hinzurechnungsbesteuerung (AStG): passive income of a controlled foreign company is attributed to the German resident owner." },
  { code: "AU", name: "Australia", rule: "CFC regime plus central management and control — profits can be attributed with no distribution." },
  { code: "ES", name: "Spain", rule: "Transparencia fiscal internacional attributes controlled foreign company income to the Spanish resident." },
  { code: "FR", name: "France", rule: "Article 209 B attributes profits of a controlled foreign entity to the French resident." },
  { code: "IT", name: "Italy", rule: "CFC rules under Article 167 TUIR attribute foreign company profits to the Italian resident." },
  { code: "US", name: "United States", rule: "Citizens and residents are taxed on worldwide income regardless of where a company sits." },
  { code: "CA", name: "Canada", rule: "FAPI rules attribute foreign accrual property income to the Canadian resident." },
  { code: "IE", name: "Ireland", rule: "ATAD CFC rules, plus company residence by central management and control." },
  { code: "NL", name: "Netherlands", rule: "ATAD CFC rules and substance requirements." },
  { code: "BE", name: "Belgium", rule: "ATAD CFC rules attribute undistributed profits to the Belgian resident." },
  { code: "SE", name: "Sweden", rule: "CFC rules in chapter 39a of the Income Tax Act." },
  { code: "NO", name: "Norway", rule: "NOKUS rules attribute the profits of a low-taxed foreign company to Norwegian owners." },
  { code: "DK", name: "Denmark", rule: "CFC rules apply broadly, including to active income." },
  { code: "FI", name: "Finland", rule: "CFC Act attributes profits of a controlled foreign company to the Finnish resident." },
  { code: "AT", name: "Austria", rule: "ATAD CFC rules plus place-of-management residence." },
  { code: "PT", name: "Portugal", rule: "CFC rules in Article 66 CIRC; management from Portugal can also make the company Portuguese-resident." },
  { code: "GR", name: "Greece", rule: "ATAD CFC rules under Article 66 of the Income Tax Code." },
  { code: "PL", name: "Poland", rule: "CFC rules plus place-of-management corporate residence." },
  { code: "CZ", name: "Czechia", rule: "ATAD CFC rules; a company managed from Czechia is Czech tax-resident." },
  { code: "HU", name: "Hungary", rule: "ATAD CFC rules; place of management creates Hungarian corporate residence." },
  { code: "SK", name: "Slovakia", rule: "ATAD CFC rules." },
  { code: "SI", name: "Slovenia", rule: "ATAD CFC rules." },
  { code: "HR", name: "Croatia", rule: "ATAD CFC rules." },
  { code: "RO", name: "Romania", rule: "ATAD CFC rules." },
  { code: "BG", name: "Bulgaria", rule: "ATAD CFC rules." },
  { code: "LT", name: "Lithuania", rule: "ATAD CFC rules." },
  { code: "LV", name: "Latvia", rule: "ATAD CFC rules." },
  { code: "EE", name: "Estonia", rule: "ATAD CFC rules; note Estonia taxes distributions, which changes the maths but not the look-through." },
  { code: "LU", name: "Luxembourg", rule: "ATAD CFC rules." },
  { code: "MT", name: "Malta", rule: "ATAD CFC rules; management and control can make the company Maltese-resident." },
  { code: "CY", name: "Cyprus", rule: "ATAD CFC rules; management and control test for corporate residence." },
  { code: "CH", name: "Switzerland", rule: "No formal CFC regime, but effective-management rules can make the company Swiss-resident and taxable here." },
  { code: "JP", name: "Japan", rule: "Anti-tax-haven (CFC) rules attribute foreign subsidiary income to the Japanese resident." },
  { code: "KR", name: "South Korea", rule: "CFC rules attribute retained income of a low-taxed foreign company." },
  { code: "CN", name: "China", rule: "CFC rules under the Enterprise Income Tax Law, plus place-of-management residence." },
  { code: "IN", name: "India", rule: "Place of effective management (POEM) can make a foreign company Indian-resident and taxable here." },
  { code: "NZ", name: "New Zealand", rule: "CFC and FIF regimes attribute foreign company income to New Zealand residents." },
  { code: "ZA", name: "South Africa", rule: "CFC rules in section 9D, plus place-of-effective-management residence. Tax year runs March to February." },
  { code: "BR", name: "Brazil", rule: "Worldwide taxation of controlled foreign company profits on an accrual basis." },
  { code: "MX", name: "Mexico", rule: "REFIPRE rules attribute income of a preferential-regime foreign entity." },
  { code: "AR", name: "Argentina", rule: "Transparencia fiscal rules attribute foreign entity income to the Argentine resident." },
  { code: "CL", name: "Chile", rule: "CFC rules attribute passive income of controlled foreign entities." },
  { code: "CO", name: "Colombia", rule: "ECE regime attributes controlled foreign entity income; place of management also creates residence." },
  { code: "PE", name: "Peru", rule: "CFC rules attribute passive income of controlled non-domiciled entities." },
  { code: "TR", name: "Türkiye", rule: "CFC rules in Article 7 of the Corporate Tax Law." },
  { code: "IL", name: "Israel", rule: "CFC rules plus control-and-management corporate residence." },
  { code: "RU", name: "Russia", rule: "CFC rules with annual notification obligations." },
  { code: "ID", name: "Indonesia", rule: "CFC rules deem dividends from a controlled foreign company; residence follows management." },
  { code: "VN", name: "Vietnam", rule: "Residents are taxed on worldwide income; a foreign company managed locally can be caught." },
  { code: "PH", name: "Philippines", rule: "Resident citizens are taxed on worldwide income." },
  { code: "EG", name: "Egypt", rule: "Residents taxed on worldwide business income; management can create local corporate residence." },
  { code: "NG", name: "Nigeria", rule: "Residents taxed on worldwide income; management and control test applies to companies." },
  { code: "KE", name: "Kenya", rule: "CFC-style rules and management-based corporate residence." },
];

export interface TerritorialCountry {
  code: string;
  name: string;
  rule: string;
}

/**
 * Territorial (or remittance-based) systems: foreign-source income is normally
 * outside the local tax net. A non-resident-owned US LLC can be genuinely
 * useful here — which is exactly why the obligations must be spelled out
 * alongside, not after the click.
 */
export const TERRITORIAL_COUNTRIES: TerritorialCountry[] = [
  { code: "GE", name: "Georgia", rule: "Foreign-source income is generally untaxed for individuals. Small Business Status taxes local turnover at 1% up to 500,000 GEL." },
  { code: "PA", name: "Panama", rule: "Territorial: income earned from work performed outside Panama is generally not taxed." },
  { code: "PY", name: "Paraguay", rule: "Territorial: foreign-source income is generally outside the tax net." },
  { code: "UY", name: "Uruguay", rule: "Territorial, with a tax holiday on foreign income for new residents." },
  { code: "MY", name: "Malaysia", rule: "Foreign-source income is taxed only when remitted, subject to current exemptions." },
  { code: "CR", name: "Costa Rica", rule: "Territorial: income from services performed outside Costa Rica is generally not taxed." },
  { code: "HK", name: "Hong Kong", rule: "Territorial: profits sourced outside Hong Kong are generally outside profits tax." },
  { code: "SG", name: "Singapore", rule: "Largely territorial for individuals; foreign income received is generally exempt, with conditions." },
  { code: "GT", name: "Guatemala", rule: "Territorial: only Guatemalan-source income is taxed." },
  { code: "NI", name: "Nicaragua", rule: "Territorial: only Nicaraguan-source income is taxed." },
  { code: "BZ", name: "Belize", rule: "Territorial for individuals on foreign-source income." },
  { code: "TH", name: "Thailand", rule: "Remittance-based, and tightened from 2024: foreign income remitted in the year it is earned is taxable. Check the current position before relying on it." },
  { code: "AE", name: "United Arab Emirates", rule: "No personal income tax. Corporate tax applies to UAE businesses above the threshold; a US LLC managed from the UAE may fall inside it." },
];

export function findCfc(code: string): CfcCountry | undefined {
  return CFC_COUNTRIES.find((c) => c.code === code);
}

export function findTerritorial(code: string): TerritorialCountry | undefined {
  return TERRITORIAL_COUNTRIES.find((c) => c.code === code);
}

/** Every country the questionnaire offers, alphabetically, plus the escapes. */
export function residencyOptions(): { code: string; name: string }[] {
  const all = [
    ...CFC_COUNTRIES.map((c) => ({ code: c.code, name: c.name })),
    ...TERRITORIAL_COUNTRIES.map((c) => ({ code: c.code, name: c.name })),
  ];
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Form 5472. The single most under-reported fact in this whole category, and
 * the reason the tool exists in this shape.
 */
export const FORM_5472 = {
  title: "Form 5472 (with a pro-forma Form 1120)",
  who: "Every foreign-owned single-member US LLC, whether or not it owes any US tax and whether or not it traded.",
  penalty: 25000,
  penaltyLabel: "$25,000 per form, per year",
  detail:
    "The penalty applies for failure to file, late filing, or a substantially incomplete filing. It is assessed per form and per year, and it is not proportionate to your revenue.",
} as const;

/** Ongoing costs nobody puts on the landing page. Ranges, in USD per year. */
export const ANNUAL_OBLIGATIONS: { label: string; cost: string; detail: string }[] = [
  {
    label: "Registered agent",
    cost: "$50–$300 / year",
    detail: "Required in every state. Usually bundled for year one, then billed annually.",
  },
  {
    label: "State franchise tax or annual report",
    cost: "$0–$800 / year",
    detail: "Wyoming and New Mexico are cheap; Delaware and California are not. California charges $800 a year even on zero revenue.",
  },
  {
    label: "Form 5472 + pro-forma 1120 preparation",
    cost: "$300–$1,000 / year",
    detail: "Most people pay a US preparer for this because the penalty for getting it wrong is $25,000.",
  },
  {
    label: "Bookkeeping",
    cost: "$300–$2,000 / year",
    detail: "The 5472 requires reportable transactions between you and the LLC to be tracked all year.",
  },
  {
    label: "Home-country reporting",
    cost: "Varies",
    detail: "Many countries require you to declare a foreign company you control, separately from any tax due on it.",
  },
];

/**
 * The documented alternative we point at when someone has no settled
 * residency. It is in the seed data already (Tbilisi), it is cheaper, and for
 * most freelancers it is simpler than a US LLC. It is also not an affiliate
 * product, which is the point.
 */
export const GEORGIA_SMALL_BUSINESS = {
  name: "Georgian Small Business Status",
  rate: "1% of turnover",
  ceiling: "500,000 GEL per year (roughly $185,000)",
  detail:
    "Individual entrepreneur registration with Small Business Status. Turnover above the ceiling is taxed at 3%, and losing the status has consequences, so the ceiling matters. Georgia also gives many nationalities a 365-day visa-free stay, so residency and the business registration can line up.",
  caution:
    "It only helps if you are actually tax resident in Georgia. It is not a mailbox arrangement.",
} as const;
