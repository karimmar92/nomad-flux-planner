# Employer plans: pricing and revenue model

Prices and gates live in `src/config/business-plans.ts`. This document explains
why those numbers, and what has to be true for them to reach six figures a month.
Nothing here is a forecast of customers. There are none yet; it is arithmetic on
stated assumptions.

## The plans

Per seat, per month. Annual billing charges 8 of 12 months (the app-wide rule), so
the effective annual price is two thirds of the monthly one. Minimum 10 seats,
maximum 500 on self-serve.

| | Basic | Advanced | Pro |
|---|---|---|---|
| Monthly | $19 | $39 | $59 |
| Annual, per month | $13 | $26 | $39 |
| Buyer | HR needing day counts and flags | People/finance setting policy and approving travel | Companies with people abroad year-round, answering to auditors |
| Day counts, threshold flags, CSV | yes | yes | yes |
| Needs-attention list, policies, approvals, show-working, PE exposure, PDF pack | | yes | yes |
| Dated crossing warnings, priority support, onboarding | | | yes |
| Each seat holder personally gets | Free | Starter | Pro |

An unpaid organisation evaluates the Basic features with 3 people (including the
admin). Without that limit there would be nothing left to buy.

## Why these prices

Evidence gathered (vendor pages are marketing, and none of this is independently verified):

- Generic HR software is cheap: roughly $6-12 per employee. Day-count tracking is
  not leave management, so it should cost more.
- Enterprise mobility platforms (Topia, BDO QuickTrip, Fragomen, Vialto) are
  quote-only. One marketplace listing for Topia shows $75k a year plus $25k setup
  and a 3-year minimum, but it is unclear which module that covers.
- Localyze is listed around EUR 49 per user in directories; its own site shows no
  price, and the unit is unclear.
- No direct competitor found publishes a per-seat price or sells without a demo.

$19 / $39 / $59 sits well under mobility tooling and above HR software, and
publishing the price is itself a differentiator. **Verify willingness to pay with
real buyers before treating these as settled.**

## Assumptions

- Seat mix: 25% Basic, 55% Advanced, 20% Pro.
- Billing mix: 70% annual, 30% monthly.
- Blended revenue per seat: **$29.13 per month**. Sensitivity: Basic-heavy mix
  (50/40/10) gives $23.77; Pro-heavy (10/40/50) gives $36.03.

## Scenarios

| Scenario | Companies x seats | Seats | MRR | ARR |
|---|---|---|---|---|
| First customers | 8 x 25 | 200 | $5.8k | $70k |
| Early traction | 30 x 50 | 1,500 | $43.7k | $524k |
| Six figures, few large accounts | 10 x 350 | 3,500 | $102.0k | $1.22M |
| Six figures, mid-market | 40 x 100 | 4,000 | $116.5k | $1.40M |
| $160k target | 20 x 275 | 5,500 | $160.2k | $1.92M |
| $160k target, fewest companies | 11 x 500 | 5,500 | $160.2k | $1.92M |

What this says plainly:

- $100k MRR needs about 3,430 paid seats. $160k needs about 5,490.
- "A few companies" reaching six figures means a few **large** companies: 7 at
  500 seats, or 34 at 100. At 25 seats each it takes about 137 companies.
- The mid-market (50-300 seats) is the sweet spot for self-serve. Beyond 500
  seats is a custom contract.

## What must be true

1. **The Stripe catalogue exists.** The six Teams prices (`teams_basic_monthly`,
   `teams_basic_yearly`, and the same for `advanced` and `pro`) must be created
   with those exact lookup keys and published. Until then checkout answers
   "Price not found".
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
- Policy writes below Advanced are refused by the server, not just hidden.
- Dated projections appear only on Pro.
- A seat holder's personal plan is raised to what the tier grants, never lowered.
- Approvals and the PDF pack are hidden below Advanced in the dashboard. The
  approval write path itself is not yet gated server-side.
