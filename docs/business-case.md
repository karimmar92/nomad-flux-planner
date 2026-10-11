# Employer plans: pricing and revenue model

Prices and gates live in `src/config/business-plans.ts`. This document explains
why those numbers, and what has to be true for them to reach six figures a month.
Nothing here is a forecast of customers. There are none yet; it is arithmetic on
stated assumptions.

## The plans

Billed **once a year, per seat**. There is no monthly price. A company buys a year,
which is how finance teams buy software, and it removes a toggle from checkout and
half the Stripe prices. The monthly figure is only the yearly price divided by twelve,
for comparison with tools that quote per month. Minimum 10 seats, maximum 500 on
self-serve.

| | Basic | Advanced | Pro |
|---|---|---|---|
| Per seat per year | $149 | $299 | $449 |
| About, per month | $12 | $25 | $37 |
| Buyer | HR needing day counts and flags | People/finance setting policy and approving travel | Companies with people abroad year-round, answering to auditors |
| One verdict on opening, record confidence, four role views, sample preview | yes | yes | yes |
| Day counts, threshold flags, CSV | yes | yes | yes |
| Needs-attention list, policies and templates, requests with headroom, show-working, PE exposure, PDF pack | | yes | yes |
| Dated crossing warnings, priority support, onboarding | | | yes |
| Each seat holder personally gets | Free | Starter | Pro |

Compared with the earlier monthly-or-annual model ($19 / $39 / $59 a month, with
annual billing charging 8 of 12 months, so $152 / $312 / $472 a year), the yearly
prices are 2%, 4% and 5% lower, and the entry plan now includes the verdict, record
confidence, the four role views and the sample-data preview that were previously
unlisted.

An unpaid organisation evaluates the Basic features with 3 people (including the
admin). Without that limit there would be nothing left to buy.

## Why these prices

Evidence gathered (vendor pages are marketing, and none of this is independently verified):

- Generic HR software is cheap: roughly $6-12 per employee per month. Day-count
  tracking is not leave management, so it should cost more.
- Enterprise mobility platforms (Topia, BDO QuickTrip, Fragomen, Vialto) are
  quote-only. One marketplace listing for Topia shows $75k a year plus $25k setup
  and a 3-year minimum, but it is unclear which module that covers.
- Localyze is listed around EUR 49 per user in directories; its own site shows no
  price, and the unit is unclear.
- No direct competitor found publishes a per-seat price or sells without a demo.

About $12 / $25 / $37 a seat a month sits well under mobility tooling and above HR
software, and publishing the price is itself a differentiator. **Verify willingness
to pay with real buyers before treating these as settled.**

## Assumptions

- Seat mix: 25% Basic, 55% Advanced, 20% Pro.
- Blended revenue per seat: **$291.50 a year, $24.29 a month**. Sensitivity:
  Basic-heavy mix (50/40/10) gives $239 a year; Pro-heavy (10/40/50) gives $359.
- Everyone pays yearly, so monthly recurring revenue is the yearly total divided by
  twelve. Cash arrives up front, which helps, but a renewal that fails lands as a
  whole year at once.

## Scenarios

| Scenario | Companies x seats | Seats | Yearly revenue | Monthly equivalent |
|---|---|---|---|---|
| First customers | 8 x 25 | 200 | $58k | $4.9k |
| Early traction | 30 x 50 | 1,500 | $437k | $36.4k |
| Few large accounts | 10 x 350 | 3,500 | $1.02M | $85.0k |
| Mid-market | 40 x 100 | 4,000 | $1.17M | $97.2k |
| $160k a month | 20 x 330 | 6,600 | $1.92M | $160.3k |
| $160k a month, fewest companies | 14 x 500 | 7,000 | $2.04M | $170.0k |

What this says plainly:

- $100k a month needs about 4,120 paid seats. $160k needs about 6,590.
- "A few companies" reaching six figures means a few **large** companies: about 8 at
  the 500-seat cap for $100k. At 25 seats each it would take about 165 companies.
- The yearly prices are a little lower than before, so the same revenue needs about
  20% more seats than the earlier model assumed. The trade is a lower barrier to
  buying and a stronger entry plan.

## What must be true

1. **The Stripe catalogue exists.** Three Teams prices must be created with these
   exact lookup keys and published: `teams_basic_yearly` (149), `teams_advanced_yearly`
   (299), `teams_pro_yearly` (449), each per seat per year. Until then checkout
   answers "Price not found". Earlier monthly keys are still understood so an
   existing subscription resolves to its tier, but none are sold.
2. **VAT.** The provider is currently a section 19 UStG Kleinunternehmer, so
   prices are final with no VAT (`src/config/legal.ts`). That exemption has
   turnover limits that six-figure monthly revenue exceeds almost immediately.
   Before the first large invoice, register for VAT, and revisit B2B pricing
   (businesses normally expect net prices, with reverse charge across the EU).
   Confirm with a Steuerberater; this is not tax advice.
3. **Sales motion above 500 seats** is not built: it goes through the lead form.
4. **Roadmap, not sold:** single sign-on, HR system import, API access. Larger
   buyers usually ask for these first, so expect them to gate the biggest accounts.
5. **Distribution.** The model says how many seats are needed, not how to win them.
   The rule guides under /rules are the existing acquisition surface.

## What a customer sees, checked against the code

- Seat limits are enforced server-side: paid seats from Stripe, 3 while evaluating.
- Policy writes and travel requests below Advanced are refused by the server, not
  just hidden.
- Dated projections appear only on Pro.
- A seat holder's personal plan is raised to what the tier grants, never lowered.
- The PDF pack is hidden below Advanced in the dashboard but the export itself runs
  in the browser, so it is not enforced server-side.
