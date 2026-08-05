# Driftly: Nomad Navigator

Build "Driftly" — a geo-arbitrage and visa-compliance app for freelancers and remote workers. Mobile-first responsive web app. Working name; make it a single constant so it's easy to rename.

## Positioning
Existing nomad sites tell you what a city costs. Driftly tells you what a city costs *you*, given your income, your passport, and how many days you have left before you trip a visa or tax rule. Every number is personalised. That's the whole product.

## Design direction
Dark-first (with a light toggle), deep navy/charcoal base, one warm accent for positive arbitrage and a muted red for warnings. Tight, data-dense, closer to a trading terminal than a travel blog. Use Inter or similar. Cards with subtle borders, no heavy shadows. Numbers are the hero — big tabular figures, small labels. Fast, no decorative hero images.

## Data model (Supabase)
Enable the database. Create these tables:

**cities** — id (text PK), city, country, country_code, region, lat, lng, local_currency, costs (jsonb), scores (jsonb), visa (jsonb), tax (jsonb), arbitrage_note (text), last_verified (date), confidence (text: high/medium/low)
Public read. No auth needed to read.

**profiles** — id (uuid, FK auth.users), display_name, nationality (ISO country code, drives visa answers), monthly_income_usd (numeric), income_type (employed/freelance/founder), home_city_id, currency_display, plan (free/pro), created_at

**trips** — id, user_id, country_code, city_id (nullable), entry_date, exit_date (nullable = currently there), purpose (tourist/nomad_visa/residence), notes. RLS: users see only their own.

**saved_cities** — user_id, city_id, created_at. RLS: own rows only.

**waitlist** — id, email, feature (community/stays), created_at. Insert-only for anon.

Row Level Security on everything user-owned. I will send the full seed data for cities in my next message — for now seed 3 placeholder cities so the UI renders.

## Screens

**1. Onboarding (first run, 4 steps, skippable)**
Passport nationality → monthly income in USD → income type → current city. Store in profiles. If skipped, use sensible defaults and prompt later. Keep it to four taps.

**2. Explore (home)**
Grid of city cards. Each card: city, country, flag, monthly cost mid-range, and — the key element — a personalised "you'd keep $X/mo" figure computed from the user's income. Colour-code that figure. Small badges: internet speed, nomad visa available (yes/no), Schengen (yes/no).
Filters: region, max monthly budget slider, minimum internet speed, "has nomad visa", "outside Schengen", "income requirement below mine", minimum safety score.
Sort: highest savings, cheapest, fastest internet, best weather.
Search by city or country name.

**3. City detail**
- Header: city, country, last verified date, confidence badge
- **Your numbers** panel: their income, this city's mid-range cost, monthly surplus, annual surplus, savings rate as a percentage, and a runway figure ("your current savings would last N months here" if they've entered savings — optional field).
- Cost breakdown: itemised bar/row list from the costs jsonb — rent central vs outskirts, coliving, coworking, groceries, meal, utilities, mobile, transport, gym. Show lean vs mid-range toggle.
- Scores: internet speed, safety, nomad community, walkability, English, weather. Simple bars, not radar charts.
- **Visa card**: tourist days allowed for THIS user's passport, rule type explained in one plain sentence, and the nomad visa if one exists — name, income requirement (with a green tick if their income clears it, red if not), duration, renewable, path to residency.
- **Tax card**: residency trigger days, tax year (flag non-calendar years like South Africa's March–February and Mauritius' July–June prominently), any special regime (Georgia's 1% small business, Spain's Beckham Law, Greece's 50% exemption, Taiwan's Gold Card exemption).
- The honest note: render arbitrage_note verbatim, including the negative parts. Do not hide downsides.
- Buttons: Save city, Compare, Add trip.

**4. Compare**
Side-by-side table, 2–4 cities, same rows as city detail. Highlight best value per row. Shareable via URL params.

**5. Arbitrage calculator**
Input monthly income, optionally current city. Output: a ranked table of all cities by monthly and annual surplus, with savings-rate percentage. Include a "years to X" input — enter a savings target and see how long it takes in each city. This is the screenshot people will share; make it export as a clean image or at least look good cropped.

**6. Visa tracker — the retention feature, build this carefully**
- Add trips: country, entry date, exit date (or "still here").
- **Schengen 90/180 engine**: rolling window, not a fixed reset. For any given date, look back 180 days and count days in Schengen countries. Entry day AND exit day both count as full days. Time in non-Schengen countries does NOT pause or reset the window. Show: days used, days remaining today, and the earliest future date on which the user could re-enter for a full 90 days. Include a forward-looking "if I enter on [date], how long can I stay?" planner.
- **Per-country day counters**: cumulative days per country against that country's tax residency trigger (183 for most, 180 for Thailand and Malaysia's 182, and respect non-calendar tax years — count South Africa against March–February, Mauritius against July–June).
- Visual timeline of the last 12 months, colour-blocked by country, with the Schengen window overlaid.
- Alerts: warn at 75% and 90% of any threshold.
- Every visa and tax screen carries a persistent, non-dismissable footer: "Informational only. Not legal or tax advice. Verify with the relevant authority before travelling." This is not optional.

**7. Community and Stays (stub tabs)**
Do not build these yet. Render a clean "coming soon" state for each explaining the plan — Community: match freelancers with startup founders by city and skill. Stays: nomad-vetted monthly rentals. Each has an email capture writing to the waitlist table with the feature name. This validates demand before we build either.

**8. Pricing**
Free: 8 cities, basic cost data, single-country day counter.
Pro at $9/mo or $69/yr: all cities, personalised arbitrage across every city, compare, full Schengen engine with alerts, unlimited trips, data export.
Build the page and the plan field now. Do not wire Stripe yet — put the checkout button behind a "coming soon" toast.

## Non-negotiable engineering details
- The Schengen calculation must be a single pure, well-named, unit-testable function that takes a list of trips and a reference date. No date logic scattered through components. Use date-fns. Watch for timezone-induced off-by-one errors — compare dates, never timestamps.
- Every displayed cost figure shows its last_verified date somewhere reachable. Stale data is worse than no data in this category.
- Handle the empty state everywhere: no trips yet, no income entered, no saved cities.
- Make the arbitrage math visible, not magic — a user should be able to see how the surplus figure was derived.

Start with auth, the schema, Explore, and City detail. Get those solid before the tracker.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2139fa1f-a2f0-40dd-8a54-2cf84a11a298).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
