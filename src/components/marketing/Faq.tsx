/**
 * FAQ blocks. Answers are written to remove the objection, not to sell — a
 * hedged answer reads as a dodge and costs more conversions than a blunt one.
 *
 * Two rules for anything added here:
 *   * Never answer a tax question with a determination. This app produces
 *     evidence, not conclusions (see src/lib/reports/tax-report.ts).
 *   * Never promise behaviour the code does not have. Published claims about a
 *     paid service are enforceable.
 */
import { ChevronDown } from "lucide-react";
import { ANNUAL_MONTHS_CHARGED, tier } from "@/config/pricing";

export type FaqItem = { q: string; a: string };

export const PRICING_FAQ: FaqItem[] = [
  {
    q: "Is the free plan really free, or a trial?",
    a: "Free, permanently, with no trip cap and no card. Logging where you have been is the part that has to work for everyone. If you only ever use the tracker, that is a complete product and it costs nothing.",
  },
  {
    q: "What does the annual plan actually save?",
    a: `Annual is billed as ${ANNUAL_MONTHS_CHARGED} months instead of 12, so two months are free. Pro is $${tier("pro").monthlyUsd} a month, or $${tier("pro").monthlyUsd * ANNUAL_MONTHS_CHARGED} for the year.`,
  },
  {
    q: "Can I cancel, and what happens to my data?",
    a: "Cancel any time; it stops the next renewal rather than cutting you off mid-period. Your trips and record stay yours: you can export everything as JSON, CSV and PDF at any point, including after you downgrade.",
  },
  {
    q: "Why is Teams priced per seat when everything else is per person?",
    a: "Because the value scales with headcount: each additional employee is another set of day counts and another approval trail. A team of five pays for five, and the employer dashboard covers all of them.",
  },
  {
    q: "Does this replace my accountant?",
    a: "No, and it is not built to. The app produces a defensible record of where you were and how the days were counted, with the method version printed on it. What that means for your tax position is a question for a qualified adviser: this is the document you hand them.",
  },
  {
    q: "What if I am about to overstay and I am on the free plan?",
    a: "The full ranked border-run list opens regardless of plan whenever you are over a limit or within seven days of one. Someone about to overstay is not someone to charge.",
  },
];

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {items.map((item) => (
        <FaqRow key={item.q} item={item} />
      ))}
    </div>
  );
}

/**
 * Native <details>, not React state.
 *
 * The browser toggles this itself, in the same frame as the click, with no
 * re-render and no JavaScript at all. It is also keyboard-accessible for free,
 * announced correctly by screen readers, findable by the browser's own Ctrl+F,
 * and it still works if the JS bundle fails. A useState version can only ever
 * be equal to this, never better.
 */
function FaqRow({ item }: { item: FaqItem }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:hidden hover:bg-surface">
        {item.q}
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <p className="px-4 pb-4 text-sm text-muted-foreground">{item.a}</p>
    </details>
  );
}
