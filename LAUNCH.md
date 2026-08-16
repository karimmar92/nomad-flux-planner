# Launch runbook

Work through this in order. The sequence is not arbitrary: each step assumes
the one above it is done, and two of them will silently corrupt data if run out
of order.

Tick the boxes as you go. Anything marked **YOU** needs your own account and
credentials, so it is yours to do rather than something to delegate.

---

## Phase 1 — Database (do this first)

Nothing else can be tested until the schema is right.

### 1.1 Apply the two pending migrations

Two files exist in `supabase/migrations/` that have never been run:

```
20260807090000_plans.sql              # the Plans / meetup feature
20260807140000_fix_delete_my_account.sql   # fixes a broken deletion function
```

The second one matters more than it sounds. The currently deployed
`delete_my_account()` references three columns that do not exist
(`user_referral_rewards.user_id`, `referral_clicks.user_id`,
`fraud_flags.user_id`) and tries to set `commission_ledger.creator_id` to NULL
on a NOT NULL column. plpgsql does not validate function bodies at creation
time, so it compiled cleanly and will throw on the first real deletion. Right
now, if a user clicks "Delete account", it fails — and GDPR Art. 17 does not
accept "the button was broken" as an answer.

**YOU:** Supabase Dashboard → SQL Editor → paste each file's contents → Run.
Apply `plans.sql` first, then the fix.

- [ ] `20260807090000_plans.sql` applied
- [ ] `20260807140000_fix_delete_my_account.sql` applied

### 1.2 Regenerate the TypeScript types

The new `plans` tables are not in `src/integrations/supabase/types.ts`, which
is why `src/lib/plans/plans.ts` currently carries a `from(table): any` cast to
compile. That cast disables type checking on every plans query.

**YOU:** Supabase Dashboard → API Docs → generate types, or run the CLI:

```bash
npx supabase gen types typescript --project-id <your-project-id> > src/integrations/supabase/types.ts
```

Then remove the `any` cast in `plans.ts` and run `npx tsc --noEmit`. If it
still compiles, the types are correct.

- [ ] Types regenerated
- [ ] `any` cast removed from `src/lib/plans/plans.ts`
- [ ] `npx tsc --noEmit` passes

### 1.3 Upgrade to Supabase Pro

The free tier has no backups and pauses the project after 7 days of inactivity.
A paused database means the app is down and paying customers cannot sign in.
Do this before you take money, not after.

- [ ] **YOU:** Supabase Pro active

### 1.4 RLS audit with two real accounts

Create two test accounts. Sign in as A, note a trip ID and a document path.
Sign in as B and try to read them, both through the UI and by calling the
Supabase client directly from the browser console. Every attempt should fail
at the database, not just be hidden in the interface.

Check specifically: `trips`, `profiles`, the `documents` storage bucket,
`commission_ledger`, and the org tables. The org tables are the risky ones —
that is where a bug leaks one company's data to another.

- [ ] **YOU:** Two accounts tested, no cross-account reads possible

---

## Phase 2 — Money

Do not start this before Phase 1. A webhook that fires against the old schema
writes garbage.

### 2.1 Create the products and prices in Stripe

Three products, two recurring prices each. Set them **tax inclusive**, and
leave **Stripe Tax off** — you are a §19 UStG Kleinunternehmer, so there is no
entitlement to collect VAT and no registration to remit it against. The code
already sets `automatic_tax: { enabled: false }` to match.

| Product | Monthly | Yearly |
|---|---|---|
| Starter | $14 | $140 |
| Pro | $29 | $290 |
| Teams (per seat) | $59 | $590 |

Yearly is monthly × 10, matching `ANNUAL_MONTHS_CHARGED` in
`src/config/pricing.ts`. If you change a price in Stripe, change it there in
the same commit — the site displays `pricing.ts`, Stripe does the charging, and
the two disagreeing is a misleading price claim rather than a cosmetic bug.

- [ ] **YOU:** Six prices created, Teams set to "per unit"

### 2.2 Turn on cancellation in the customer portal

Stripe Dashboard → Settings → Billing → Customer portal → enable
**"Customers can cancel subscriptions"**.

This is off by default. With it off, the "Manage or cancel subscription" button
on the profile page opens a portal with no way out, which is the exact defect
§ 312k BGB targets — and your Terms and refund policy both promise cancellation
without contacting support. A written promise with no button behind it is worse
than having neither.

While you are there, enable invoice history so customers can get their own
receipts.

- [ ] **YOU:** Cancellation enabled in portal
- [ ] **YOU:** Invoice history enabled

### 2.3 Set the environment variables where the site is actually hosted

The live site is `nomad-flux-planner.lovable.app`, so these go in **Lovable's**
project settings, not Vercel. Setting them in Vercel while Lovable serves the
traffic is a long afternoon of confusion: checkout keeps reporting "Billing is
not configured yet" and everything in the dashboard looks correct.

```
SITE_URL=https://yourdomain.com        # no trailing slash
STRIPE_SECRET_KEY=sk_live_...          # or sk_test_ while testing
STRIPE_WEBHOOK_SECRET=whsec_...        # from step 2.4
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_TEAMS_MONTHLY=price_...
STRIPE_PRICE_TEAMS_YEARLY=price_...
```

`SITE_URL` is not optional. Without it, checkout throws immediately, and
canonical tags fall back to `localhost:8080` — which tells Google your
production pages are duplicates of a machine nobody can reach.

- [ ] **YOU:** All variables set in Vercel

### 2.3b Create the Founding 100 price (ONE-TIME, not recurring)

In Stripe, add a product "Driftly Founding 100" with a **one-time** price of
**$99**. If you create it as recurring by mistake, Stripe rejects the checkout
session, which is the one place this is hard to get wrong silently.

```
STRIPE_PRICE_FOUNDING_LIFETIME=price_...
```

Then apply `supabase/migrations/20260816120000_founding_members.sql`, which
creates the spot counter and the claim function. **The offer cannot work
without it**: the cap is enforced in the database, not in the interface,
because a limit checked in React fails the moment two people click at once.

Add `checkout.session.completed` to the webhook events below if it is not
already there. That single event carries both subscriptions and the founding
purchase; the handler tells them apart by `mode` and `metadata.founding`.

- [ ] **YOU:** One-time $99 price created
- [ ] **YOU:** `STRIPE_PRICE_FOUNDING_LIFETIME` set in Lovable
- [ ] Migration applied
- [ ] Founding purchase tested with `4242 4242 4242 4242`, spot number issued,
      Pro unlocked, and a second webhook replay does **not** issue a second spot

### 2.4 Register the webhook

Stripe Dashboard → Developers → Webhooks → Add endpoint:

```
https://yourdomain.com/api/public/webhooks/stripe
```

Events to send:

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
charge.refunded
charge.dispute.created
```

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

The subscription events are what grant and revoke paid plans. `invoice.paid` is
what pays creator commission. `charge.refunded` and `charge.dispute.created`
claw it back. Miss the deletion event and cancelled customers keep Pro forever,
which is revenue lost silently because nobody complains about that bug.

- [ ] **YOU:** Endpoint registered, all seven events selected
- [ ] **YOU:** Signing secret set, redeployed

### 2.5 Test the whole money path in test mode

Use card `4242 4242 4242 4242`. Walk the full path and check each of these,
because each one was broken at some point in the build:

1. Click a plan on `/pricing` → Stripe checkout opens
2. The price shown matches the card you clicked — for Teams, confirm the
   quantity selector starts at **1 seat**, not 5
3. The checkout page shows the terms checkbox and a "Pay" button
4. Pay → you land on `/profile?checkout=success`, **not a 404**
5. A green "Payment received" banner appears
6. Within a few seconds, the Billing card shows your new plan — this is the
   webhook writing to the database and `usePlanSync` reading it back
7. A previously gated feature (exports, vault) is now unlocked
8. Click "Manage or cancel subscription" → the portal opens **with a cancel
   option visible**
9. Cancel → within a few seconds the app shows you back on Free

Step 6 is the one to watch. Stripe writes the plan to Postgres, but the app
reads it from localStorage; `src/lib/billing/use-plan-sync.ts` is the only
thing connecting them. If your plan never updates, that hook is the suspect,
not Stripe.

- [ ] **YOU:** All nine steps pass in test mode
- [ ] **YOU:** Switched to live keys and repeated steps 1–4 with a real card

---

## Phase 3 — Going public

### 3.1 Supabase auth redirect URLs

Supabase Dashboard → Authentication → URL Configuration:

```
Site URL:      https://yourdomain.com
Redirect URLs: https://yourdomain.com/**
               https://*-<your-vercel-org>.vercel.app/**
```

The wildcard for preview deployments matters. Without it, magic links from any
preview build silently fail and you will assume auth is broken.

- [ ] **YOU:** Redirect URLs set including the preview wildcard

### 3.2 Point robots.txt at the real domain

`public/robots.txt` currently has the Sitemap line commented out, deliberately —
a placeholder URL is worse than no line, because crawlers try to fetch it and
log the failure against your site. Uncomment it and fill in the domain:

```
Sitemap: https://yourdomain.com/sitemap.xml
```

- [ ] Sitemap line uncommented with the real domain

### 3.3 Submit to Google Search Console

Verify the domain, submit `/sitemap.xml`, and request indexing for the homepage
and the four `/rules/*` pages. Those rule pages are the SEO play — they target
queries people actually type when they are worried, which is the moment they
are most likely to try a tool.

- [ ] **YOU:** Domain verified and sitemap submitted

### 3.4 Decide the name

Driftly has trademark and positioning issues that were never resolved. Stamped
and Daykeep both failed clearance. This is cheap to change now and expensive
after you have inbound links and a Stripe account in that name.

- [ ] **YOU:** Name decided and cleared

---

## Phase 4 — After launch

Not blockers. Do them once money can actually change hands.

### 4.1 The em dash pass

`scripts/ai_tells.py` in the `human-copy` skill reports 73 spaced em dashes
across the reader-facing copy — 8.3 per thousand words on the landing page,
about four times what reads as natural. Word choice is clean (zero puffery,
zero AI vocabulary); it is purely punctuation, and it is my fingerprint on your
product rather than yours.

Run it, then fix sentences rather than swapping punctuation. Replacing every
` — ` with a comma leaves the generated sentence shape intact and makes the
prose worse.

```bash
python3 <skill-path>/scripts/ai_tells.py src/components/marketing/Landing.tsx
```

### 4.2 Finish the skill evals

Three test cases exist in `evals/evals.json`. Half the runs completed before
the budget ran out. Re-run them, generate the review viewer, then package with
`package_skill.py` so it installs into your profile and applies automatically.

### 4.3 Look at imigos.com

You asked me to consider it for the feature roadmap and I have not opened it
yet. First thing next session.

### 4.4 Talk to actual nomads

Still the highest-value unticked item, and the one that has been deferred
longest. Two LinkedIn connections accepted, no replies, zero conversations.

The timezone work gives you a legitimate reason to post on r/digitalnomad
without breaking their self-promotion rule: answer the "Argentina or Asia"
question with the real worked table. Bangkok at 15:00–21:00 beats both options
the poster was agonising over, and nobody in that thread worked it out. That is
a comment, not an advert.

- [ ] Five conversations with people who have actually overstayed or nearly did
