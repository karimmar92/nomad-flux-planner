/**
 * One indexable page per rule.
 *
 * People do not search for "nomad compliance app". They search for the specific
 * rule that is worrying them today — "schengen calculator", "330 day rule",
 * "am I UK resident". Each of those is a different person with a different
 * problem, and a single homepage cannot rank for all four.
 *
 * These pages exist to be found and to be USEFUL WITHOUT SIGNING UP: the rule
 * explained properly, the mistakes that cost people money, and the live
 * calculator. Someone who gets a real answer for free is who comes back with
 * their whole trip history later.
 *
 * COPY RULE, same as everywhere else: explain the rule and the threshold, never
 * state someone's status. "183 days engages the automatic UK test" is a fact;
 * "you are UK resident" is regulated advice.
 */
import type { RuleId } from "@/lib/rules/types";

export type RulePage = {
  id: RuleId;
  /** URL segment. */
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  /** Two or three sentences. What the rule is, and who it binds. */
  intro: string;
  /** The mistakes, in order of how often they cost somebody money. */
  mistakes: { title: string; body: string }[];
  faq: { q: string; a: string }[];
  /** Country preset the calculator should open on. */
  defaultCountry: string;
};

export const RULE_PAGES: RulePage[] = [
  {
    id: "schengen",
    slug: "schengen-90-180",
    title: "Schengen 90/180 calculator — how the rolling window really works",
    metaDescription:
      "Work out your Schengen days from your actual trips. The 90/180 rule is a rolling window, not an annual reset, and both your entry and exit days count in full. Free, no account.",
    h1: "The Schengen 90/180 rule, counted properly",
    intro:
      "Ninety days in any rolling 180-day period, across all 29 Schengen countries combined. The window moves with you: every day, the question is how many of the previous 180 days you spent inside the area. There is no annual reset and no per-country allowance.",
    mistakes: [
      {
        title: "Leaving does not reset the clock",
        body: "Days leave the window only by ageing past 180 days. A weekend in Serbia or Morocco stops you accruing new days, but it returns none of the ones you already used. The 'border run' that works for other visa regimes does nothing here.",
      },
      {
        title: "Both the entry day and the exit day count in full",
        body: "Land at 23:50 and that is a whole day gone. Leave at 06:00 and that is another. A four-night trip costs five days, and people routinely under-count by two days per trip.",
      },
      {
        title: "The rule is tested every single day, not just at the border",
        body: "A stay that is legal when you arrive can become illegal halfway through, because the window keeps moving. Being waved through on arrival is not a ruling that your whole stay is lawful.",
      },
      {
        title: "It is one allowance across 29 countries",
        body: "Days in Portugal, Germany and Greece all come from the same 90. Overstaying risks a fine, a removal order and an entry ban of up to three years — recorded against you across the whole area.",
      },
    ],
    faq: [
      {
        q: "Does a national long-stay visa or residence permit use up my 90 days?",
        a: "No. Days spent under a national D visa or a residence permit issued by a Schengen state are counted separately from the 90/180 short-stay allowance. This app tracks them separately for that reason.",
      },
      {
        q: "When does my allowance return to a full 90 days?",
        a: "Only once 180 days have passed since your earliest counted days. The calculator shows that exact date rather than making you work backwards through a calendar.",
      },
      {
        q: "Do Ireland, Romania or Bulgaria count?",
        a: "Ireland is not in the Schengen area and has its own rules. Bulgaria and Romania joined, so their days now count toward the same allowance — a change that catches out people relying on older advice.",
      },
    ],
    defaultCountry: "PT",
  },
  {
    id: "feie",
    slug: "feie-330-day-test",
    title: "FEIE 330-day physical presence test calculator",
    metaDescription:
      "Count your full days abroad against the 330-day physical presence test for the Foreign Earned Income Exclusion. Arrival days do not count, and the 12-month window rolls. Free, no account.",
    h1: "The 330-day physical presence test, counted from your real trips",
    intro:
      "US citizens and residents can exclude a large amount of foreign earned income if they are physically present in a foreign country for 330 full days in any 12 consecutive months. It is the highest-stakes day count there is: missing it by a single day can cost the entire exclusion.",
    mistakes: [
      {
        title: "Arrival days do not count",
        body: "A qualifying day is a full day, midnight to midnight, in a foreign country. Land in Lisbon at 14:00 and that day is worth nothing to this test — the exact opposite of Schengen, where the same day is burned in full.",
      },
      {
        title: "The 12-month window rolls, and you choose it",
        body: "It does not have to match the calendar year or your tax year. You may pick whichever consecutive twelve months give you 330 days, which frequently rescues a year that looks short on a calendar basis.",
      },
      {
        title: "International waters count toward nothing",
        body: "Time over international waters or in international airspace is neither in the US nor in a foreign country. A week-long Atlantic crossing costs seven days from your 330 — a costly surprise for anyone who takes a repositioning cruise.",
      },
      {
        title: "Short trips home are what usually break it",
        body: "You have only 35 days of slack in a whole year. Two trips home for a wedding and a funeral, with travel days at each end, can quietly consume most of it.",
      },
    ],
    faq: [
      {
        q: "Does flying between two foreign countries break my presence?",
        a: "Not if the travel takes under 24 hours. Moving from Portugal to Thailand directly keeps your presence intact, which is why this calculator merges back-to-back foreign trips into one continuous period before counting.",
      },
      {
        q: "Is this the same as the bona fide residence test?",
        a: "No. That is a separate route to the same exclusion, based on establishing genuine residence abroad for an uninterrupted tax year rather than on counting days. Someone who fails the day count may still qualify that way.",
      },
      {
        q: "How exact does my day count need to be?",
        a: "Exact enough to defend. This calculator deliberately errs low by excluding the travel days at each end of a period abroad — understating your qualifying days is the safe direction of error when the alternative is claiming an exclusion you did not earn.",
      },
    ],
    defaultCountry: "TH",
  },
  {
    id: "tax_183",
    slug: "183-day-rule",
    title: "The 183-day rule — tax residency day counter by country",
    metaDescription:
      "Count your days against each country's residency threshold, on that country's own tax year. South Africa runs March–February, Mauritius July–June. Free, no account.",
    h1: "The 183-day rule, on each country's own calendar",
    intro:
      "Most countries presume you are tax resident once you spend 183 days there within their tax year. The number is nearly universal; the calendar it is measured on is not, and that is where people get caught.",
    mistakes: [
      {
        title: "The tax year is often not January to December",
        body: "South Africa runs March to February. Mauritius runs July to June. The UK runs 6 April to 5 April. Counting on the wrong calendar produces a confident answer that is simply wrong.",
      },
      {
        title: "183 days is a presumption, not the whole test",
        body: "Permanent home, centre of vital interests, family and habitual abode all matter too. You can be treated as resident on far fewer days, and treaties decide which country wins when two both claim you.",
      },
      {
        title: "Leaving one country does not settle where you are resident",
        body: "Deregistering at home does not automatically make you non-resident, and being under 183 days everywhere does not make you resident nowhere. Both assumptions are common and both are expensive.",
      },
    ],
    faq: [
      {
        q: "Can I be tax resident in two countries at once?",
        a: "Yes, and it happens often. Double tax treaties contain tie-breaker rules — permanent home, then centre of vital interests, then habitual abode, then nationality — to allocate residence between them.",
      },
      {
        q: "Does this app tell me where I am tax resident?",
        a: "No, deliberately. It tells you how many days you have recorded in each country and what that country's published threshold is. What follows from that is a question for a qualified adviser, and this is the document to bring them.",
      },
    ],
    defaultCountry: "VN",
  },
  {
    id: "uk_srt",
    slug: "uk-statutory-residence-test",
    title: "UK Statutory Residence Test — day counter and ties thresholds",
    metaDescription:
      "Count your UK days across the 6 April tax year and see which SRT test they engage: automatic overseas, automatic UK, or the sufficient ties bands. Free, no account.",
    h1: "The UK Statutory Residence Test, one step at a time",
    intro:
      "The SRT is not a single day count. It is three tests applied in order: the automatic overseas tests, the automatic UK tests, and — for everything in between — the sufficient ties test, where the day threshold moves according to how many ties you have to the UK.",
    mistakes: [
      {
        title: "The UK tax year starts on 6 April",
        body: "Not 1 January, and not 1 April. Counting on a calendar year will put days in the wrong year and can change which band you fall into.",
      },
      {
        title: "The threshold depends on your history, not just your days",
        body: "If you were UK resident in any of the previous three tax years you are a 'leaver' and the thresholds are tighter — 16 days rather than 46 for the automatic overseas test, and a lower bar in every ties band.",
      },
      {
        title: "Ties are defined in statute, not by intuition",
        body: "Family, accommodation, work, the 90-day tie and — for leavers only — the country tie each have precise definitions. Miscounting your ties moves your threshold by 30 days or more.",
      },
      {
        title: "Days are counted at midnight",
        body: "You are generally present on a day if you are in the UK at the end of it. There are anti-avoidance rules for transit and exceptional circumstances that this counter does not attempt to model.",
      },
    ],
    faq: [
      {
        q: "Does this tell me whether I am UK resident?",
        a: "No. It reports which test your recorded days engage and, in the ties band, the published threshold for the number of ties you declare. Residence status depends on facts about your life that an app cannot verify, and it is a question for a qualified adviser.",
      },
      {
        q: "What if I spend 183 days or more in the UK?",
        a: "That engages an automatic UK test, and the ties test never comes into it. Below 16 days as a leaver, or 46 as an arriver, an automatic overseas test is engaged instead. The ties test only decides the middle ground.",
      },
      {
        q: "Does split-year treatment apply to me?",
        a: "Possibly, and it is outside what this counter models. Split-year treatment can divide a tax year into resident and non-resident parts in specific circumstances, such as leaving to work abroad full time.",
      },
    ],
    defaultCountry: "GB",
  },
];

export function rulePageBySlug(slug: string): RulePage | undefined {
  return RULE_PAGES.find((p) => p.slug === slug);
}
