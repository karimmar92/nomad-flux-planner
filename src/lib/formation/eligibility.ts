/**
 * Company-formation eligibility engine.
 *
 * Pure and deterministic: answers in, verdict out. No network, no partner
 * data, no pricing. The partner layer reads `showPartners` from the verdict —
 * the verdict never reads anything from the partner layer. That direction of
 * dependency is the structural defence: this file cannot be influenced by what
 * a formation referral pays, because it does not know.
 *
 * This engine MUST be able to return "don't do this". The CFC outcome is the
 * most common real-world answer and it carries no affiliate link. If a future
 * change makes every path revenue-generating, the feature has been corrupted
 * and should be reverted.
 *
 * Wording rule, identical to the tax report (src/lib/reports/tax-report.ts):
 * this produces INFORMATION, never ADVICE and never a number. No projected
 * saving, ever — a specific figure is the line between information and
 * regulated tax advice.
 */
import {
  findCfc,
  findTerritorial,
  FORM_5472,
  GEORGIA_SMALL_BUSINESS,
  type CfcCountry,
} from "./jurisdictions";

export type ResidencyAnswer = string | "none" | "unsure";

export interface FormationAnswers {
  /** ISO code of citizenship. "US" is load-bearing: citizenship-based taxation. */
  citizenship: string;
  /** Current or intended country of tax residency, or none/unsure. */
  taxResidency: ResidencyAnswer;
  /**
   * Whether they have formally exited their home country's tax system —
   * deregistration, a departure return, a P85, a tax-residency certificate
   * elsewhere. Intent is not exit.
   */
  formallyExited: boolean;
  /** Where the paying clients are. */
  clients: Array<"us" | "eu" | "uk" | "other">;
  /** Rough annual revenue band, USD. Bands only — we never do a saving calc. */
  revenueBand: "under_30k" | "30k_75k" | "75k_150k" | "over_150k";
  usClients: boolean;
  /** Any US physical presence: office, staff, inventory, or working days there. */
  usPresence: boolean;
}

export type VerdictKind =
  | "cfc_lookthrough"
  | "no_residency"
  | "us_person"
  | "us_presence"
  | "territorial"
  | "unclear";

export interface VerdictSection {
  heading: string;
  body: string;
}

export interface Verdict {
  kind: VerdictKind;
  /** Plain statement of the outcome. Never "you should form an LLC". */
  headline: string;
  summary: string;
  /** Why this outcome, in checkable terms. */
  reasons: string[];
  /** Extra reading for this specific situation. */
  sections: VerdictSection[];
  /**
   * Whether formation partners may render. False on every outcome where an
   * LLC is unlikely to help — see DISQUALIFYING_OUTCOMES in
   * src/config/partners.ts. This is the only field the UI may use to decide.
   */
  showPartners: boolean;
  /** Shown when showPartners is false, so the absence is explained, not silent. */
  noPartnersReason?: string;
  /** Always rendered, on every outcome. */
  adviserLine: string;
  /** Shown when an LLC is plausible: what it costs you every year, forever. */
  showObligations: boolean;
  /** Shown when they have no settled residency. */
  showGeorgiaAlternative: boolean;
}

export const ADVISER_LINE =
  "These factors may make an LLC unsuitable for you. Speak to a qualified adviser before forming a company.";

const NOT_ADVICE =
  "Information only, not legal or tax advice. Nothing here is a recommendation to form or not form a company.";

export const FORMATION_DISCLAIMER = NOT_ADVICE;

/** "United Kingdom" reads wrong without an article; a handful of names need one. */
function the(name: string): string {
  return /^(United|Netherlands|Philippines|Czechia$)/.test(name) && name !== "Czechia"
    ? `the ${name}`
    : name;
}

function clientsLine(a: FormationAnswers): string {
  if (a.clients.includes("eu") || a.clients.includes("uk")) {
    return "Your clients are in the EU or UK. Many of them will ask for a VAT number or an EU/UK invoice, and a US LLC does not give you either — an EU structure may be the closer fit.";
  }
  if (a.usClients) {
    return "Your clients are in the US. A US entity can make invoicing and payment simpler, and can reduce W-8/W-9 friction. That is an administrative benefit, not a tax one.";
  }
  return "Your clients are outside the US, so a US entity adds little on the invoicing side either.";
}

/**
 * The verdict. Order of checks matters: the disqualifying conditions are
 * tested BEFORE the qualifying ones, so no combination of answers can slip
 * past a look-through problem into a partner link.
 */
export function evaluate(a: FormationAnswers): Verdict {
  // 1. US citizenship — worldwide taxation follows the passport, not the company.
  if (a.citizenship === "US") {
    return {
      kind: "us_person",
      headline: "A US LLC will not change what you owe.",
      summary:
        "US citizens are taxed on worldwide income wherever they live. A US LLC is a normal domestic structure for you, but it is not a way to reduce that. The foreign-owner arrangements marketed to nomads do not apply to a US person.",
      reasons: [
        "The US taxes citizens on worldwide income regardless of residence.",
        "A single-member LLC owned by a US person is disregarded: the profit lands on your personal return either way.",
        "Foreign earned income exclusion and foreign tax credits, if they apply to you, work independently of whether you have an LLC.",
      ],
      sections: [
        {
          heading: "What an LLC does and does not do here",
          body: "It can give you liability separation and a cleaner business banking setup. It does not change your US tax position, and it does not remove your filing obligations abroad.",
        },
        { heading: "Your clients", body: clientsLine(a) },
      ],
      showPartners: false,
      noPartnersReason:
        "We show formation partners only where a company is plausibly useful for tax or invoicing reasons. It isn't here, so there is nothing for us to link to.",
      adviserLine: ADVISER_LINE,
      showObligations: false,
      showGeorgiaAlternative: false,
    };
  }

  // 2. Tax residency in a look-through country. The most common real answer,
  //    and the one that carries no link. Checked before everything else.
  const cfc: CfcCountry | undefined =
    a.taxResidency !== "none" && a.taxResidency !== "unsure"
      ? findCfc(a.taxResidency)
      : undefined;

  if (cfc) {
    return {
      kind: "cfc_lookthrough",
      headline: `A US LLC will likely be looked through and taxed in ${the(cfc.name)} anyway.`,
      summary: `You told us you are tax resident in ${the(cfc.name)}. Countries with controlled-foreign-company rules attribute the company's profits to you directly and tax them at local rates, whether or not you took a distribution. On that basis a US LLC would not reduce your personal tax bill — it would mainly change how you get paid, and add a US filing obligation on top of your existing one.`,
      reasons: [
        `${cfc.name}: ${cfc.rule}`,
        "Running the company yourself, from where you live, is usually what triggers this. There is no substance elsewhere to point at.",
        "Undistributed profit is still attributed in most of these regimes, so leaving money in the company does not defer anything.",
        a.formallyExited
          ? "You said you have formally exited a previous tax system, but you have a current residency, and that is the one that counts."
          : "You have not formally exited a tax system, so your current residency governs.",
      ],
      sections: [
        {
          heading: "What usually goes wrong",
          body: "People form the company, do not declare it at home, and find out three or four years later during a routine enquiry. The tax is then due with interest and penalties, and the US filings were often missed too, which is a separate problem.",
        },
        {
          heading: "If you want to change this outcome",
          body: "The variable is your tax residency, not the company. Changing where a company is registered while you stay put does not usually change anything. Speak to an adviser in your country before forming anything.",
        },
        { heading: "Your clients", body: clientsLine(a) },
      ],
      showPartners: false,
      noPartnersReason:
        "We earn a commission on company formation, and this is the outcome where forming one is least likely to help you. So we are not showing you a link.",
      adviserLine: ADVISER_LINE,
      showObligations: false,
      showGeorgiaAlternative: false,
    };
  }

  // 3. US physical presence — effectively connected income, a US filing and
  //    possible US tax. Disqualifying regardless of residency.
  if (a.usPresence) {
    return {
      kind: "us_presence",
      headline: "US physical presence changes the analysis completely.",
      summary:
        "You told us you have some physical presence in the US — working days, staff, an office or inventory. That can make the LLC's income effectively connected to a US trade or business, which brings US tax and US filings into scope, and can create state-level obligations too. This is the version of the setup that most often goes wrong quietly.",
      reasons: [
        "Effectively connected income is taxed in the US and requires a return, whatever your residency.",
        "Working days physically in the US are the usual trigger, not just an office.",
        "State nexus rules are separate from federal ones and can apply on their own.",
      ],
      sections: [
        {
          heading: "What to do about it",
          body: "This needs a US tax professional looking at your actual days and activities before anything is registered. Getting it wrong here costs more than the formation fee by a wide margin.",
        },
      ],
      showPartners: false,
      noPartnersReason:
        "The US presence you described needs professional review first. Selling you a formation before that has happened would be irresponsible.",
      adviserLine: ADVISER_LINE,
      showObligations: true,
      showGeorgiaAlternative: false,
    };
  }

  // 4. No settled residency. The most dangerous state, and the one the
  //    marketing targets hardest.
  if (a.taxResidency === "none" || a.taxResidency === "unsure") {
    return {
      kind: "no_residency",
      headline: "Sort out your tax residency before you form anything.",
      summary:
        "This is the situation most likely to go wrong. \u201cTax resident of nowhere\u201d is not a real status: staying under 183 days everywhere does not make you tax-free. Your citizenship, your last country of residence, or a country where you keep ties will usually still claim you, and it is normally the country you least want to be claimed by.",
      reasons: [
        a.formallyExited
          ? "You have formally exited a tax system, which is the right first step — but exit is only half of it. Most countries keep claiming you until you can show residency somewhere else."
          : "You have not formally exited your home country's tax system, so on the balance of probability you are still resident there and its rules — including any look-through rules — still apply to you.",
        "A residency certificate from somewhere is what ends the argument. Absence alone does not.",
        "Forming a company before you know which country taxes you means you cannot know whether it helps or hurts.",
      ],
      sections: [
        {
          heading: "The 183-day myth",
          body: "183 days is only one test, and it is usually the last one applied. Permanent home, centre of vital interests, habitual abode and nationality are applied first in most treaties, and domestic rules can be stricter still. The UK statutory residence test can catch you at 16 days in the right circumstances.",
        },
        {
          heading: "A documented alternative worth reading first",
          body: `${GEORGIA_SMALL_BUSINESS.name}: ${GEORGIA_SMALL_BUSINESS.rate} on turnover up to ${GEORGIA_SMALL_BUSINESS.ceiling}. ${GEORGIA_SMALL_BUSINESS.detail} For most freelancers this beats a US LLC on both tax and complexity, and there is no US filing attached to it. ${GEORGIA_SMALL_BUSINESS.caution}`,
        },
        { heading: "Your clients", body: clientsLine(a) },
      ],
      showPartners: false,
      noPartnersReason:
        "Establishing residency somewhere comes before forming a company. A formation link here would be selling you the second step while the first one is missing.",
      adviserLine: ADVISER_LINE,
      showObligations: true,
      showGeorgiaAlternative: true,
    };
  }

  // 5. Territorial residency, no US presence. An LLC may be genuinely useful.
  const territorial = findTerritorial(a.taxResidency);
  if (territorial) {
    return {
      kind: "territorial",
      headline: `A US LLC may be genuinely useful from ${the(territorial.name)} — if you keep up with the filings.`,
      summary: `${the(territorial.name)} taxes on a territorial or remittance basis, so foreign-source income is often outside the local net, and there is generally no look-through rule pulling the company's profits onto your personal return. That is the situation where a US LLC does something real. What it costs you is an annual compliance obligation that does not go away, including ${FORM_5472.title.split(" (")[0]}, where the penalty is ${FORM_5472.penaltyLabel}.`,
      reasons: [
        `${territorial.name}: ${territorial.rule}`,
        a.formallyExited
          ? "You have formally exited your previous tax system, which is what makes this hold together."
          : "You have not confirmed a formal exit from a previous tax system. If your old country still considers you resident, its rules override everything above — check this first.",
        "No US physical presence, so effectively connected income is unlikely to arise.",
        clientsLine(a),
      ],
      sections: [
        {
          heading: FORM_5472.title,
          body: `${FORM_5472.who} ${FORM_5472.detail} Diarise it: the deadline is the same as the corporate return, and an extension of time to file is not an extension of the obligation.`,
        },
        {
          heading: "The headline fee is not the real number",
          body: "Formation is a one-off. Registered agent, state fees, the 5472 preparation and bookkeeping repeat every year for as long as the company exists, and dissolving a company you stopped using is itself a filing.",
        },
        {
          heading: "Still worth a conversation",
          body: "Territorial systems have conditions and they change — Thailand's remittance rules changed in 2024, Malaysia's exemptions have been revised repeatedly. Check the current position for your country before you rely on it.",
        },
      ],
      showPartners: true,
      adviserLine: ADVISER_LINE,
      showObligations: true,
      showGeorgiaAlternative: false,
    };
  }

  // 6. Anything we do not have a documented rule for. We do not guess.
  return {
    kind: "unclear",
    headline: "We don't have a documented rule for your situation.",
    summary:
      "We only publish outcomes we can point to a written rule for, and we do not have one for the country you selected. Rather than guess, we would rather tell you that.",
    reasons: [
      "No controlled-foreign-company or territorial-system entry in our data for that country.",
      "Guessing here would be worse than saying nothing: the downside is a $25,000 penalty or an unexpected tax bill.",
    ],
    sections: [
      {
        heading: "What to ask an adviser",
        body: "Two questions cover most of it: does my country attribute a foreign company's profits to me personally, and would a company I run from here be treated as tax-resident here?",
      },
    ],
    showPartners: false,
    noPartnersReason:
      "We are not confident enough about your situation to point you at a formation service.",
    adviserLine: ADVISER_LINE,
    showObligations: true,
    showGeorgiaAlternative: false,
  };
}
