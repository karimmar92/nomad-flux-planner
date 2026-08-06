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
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ANNUAL_MONTHS_CHARGED, tier } from "@/config/pricing";

export type FaqItem = { q: string; a: string };

export const PRICING_FAQ: FaqItem[] = [
  {
    q: "Is the free plan really free, or a trial?",
    a: "Free, permanently, with no trip cap and no card. Logging where you have been is the part that has to work for everyone — if you only ever use the tracker, that is a complete product and it costs nothing.",
  },
  {
    q: "What does the annual plan actually save?",
    a: `Annual is billed as ${ANNUAL_MONTHS_CHARGED} months instead of 12, so two months are free. Pro is $${tier("pro").monthlyUsd} a month, or $${tier("pro").monthlyUsd * ANNUAL_MONTHS_CHARGED} for the year.`,
  },
  {
    q: "Can I cancel, and what happens to my data?",
    a: "Cancel any time; it stops the next renewal rather than cutting you off mid-period. Your trips and record stay yours — you can export everything as JSON, CSV and PDF at any point, including after you downgrade.",
  },
  {
    q: "Why is Teams priced per seat when everything else is per person?",
    a: "Because the value scales with headcount: each additional employee is another set of day counts and another approval trail. A team of five pays for five, and the employer dashboard covers all of them.",
  },
  {
    q: "Does this replace my accountant?",
    a: "No, and it is not built to. The app produces a defensible record of where you were and how the days were counted, with the method version printed on it. What that means for your tax position is a question for a qualified adviser — this is the document you hand them.",
  },
  {
    q: "What if I am about to overstay and I am on the free plan?",
    a: "The full ranked border-run list opens regardless of plan whenever you are over a limit or within seven days of one. Someone about to overstay is not someone to charge.",
  },
];

export const PRODUCT_FAQ: FaqItem[] = [
  {
    q: "Do I need an account to try it?",
    a: "No. Trips log straight to your device and the tracker works signed out. An account adds sync across devices, the vault and backup — but you can use the counter first and decide later.",
  },
  {
    q: "Does it work offline, at the border?",
    a: "Yes. Your trips, day counts and any vault documents you have already opened are cached on the device, so the app works in an immigration hall with no signal. New uploads and syncing need a connection.",
  },
  {
    q: "How accurate is the Schengen calculation?",
    a: "It implements the rolling 90/180 rule with both entry and exit days counted as full days, and is covered by a test suite that runs in multiple timezones. Where a trip has no exit date yet, it is counted only up to today — never beyond.",
  },
  {
    q: "Where is my data stored, and who can see it?",
    a: "In the EU, on infrastructure with row-level security so your rows are readable only by your account. There are no analytics or tracking scripts. Document vault access additionally requires a second factor, so a stolen password alone does not open your passport scans.",
  },
  {
    q: "What happens if I want to leave?",
    a: "Download everything as JSON, CSV and PDF, then delete your account in-app. Deletion removes your files, your rows and your local caches — not a support ticket, a button.",
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

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm font-medium hover:bg-surface"
      >
        {item.q}
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? <p className="px-4 pb-4 text-sm text-muted-foreground">{item.a}</p> : null}
    </div>
  );
}
