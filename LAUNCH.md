# Go-live runbook

Rewritten after the migration to Lovable payments. **The previous version told
you to set `STRIPE_SECRET_KEY` and create price IDs. Both are obsolete** — there
is no Stripe secret key in this project, and prices are resolved by lookup key.
If you followed the old instructions, nothing you set is being read.

Work top to bottom. Steps marked **YOU** need your own accounts.

---

## Phase 0 — Get the code live (nothing else works first)

Seven commits are unpushed and eleven files uncommitted. Everything below
assumes the current code is actually deployed.

```bash
cd C:\Users\marzo\Documents\GitHub\nomad-flux-planner
npm install                 # stripe, @stripe/stripe-js, @stripe/react-stripe-js
npx tsc --noEmit            # must be clean apart from Lovable's own stripe.ts
git add -A
git commit -m "founding 100, billing admin, gateway fixes"
git pull --rebase origin main
git push origin main
```

Then **Publish** in Lovable. Syncing from GitHub and publishing are separate;
the preview URL tracks every commit, the production URL only moves when you
publish.

- [ ] `npm install` run
- [ ] Pushed
- [ ] Published, and the live site shows the change

**If Lovable regenerates `billing.functions.ts` again**, check `ui_mode`. It has
reintroduced `"embedded_page"` twice. It must be `"embedded"` or checkout shows
a long spinner then "Something went wrong". The reason is commented in the file.

---

## Phase 1 — Database

Four migrations are in the repo. Apply any that have not run, **in filename
order**, via Supabase Dashboard → SQL Editor.

```
20260807090000_plans.sql
20260807140000_fix_delete_my_account.sql      <- fixes a broken deletion function
20260816120000_founding_members.sql           <- REQUIRED for the Founding 100
20260816130000_webhook_events.sql             <- REQUIRED for the admin page
```

`fix_delete_my_account` matters more than it sounds. The deployed version
references three columns that do not exist, so "Delete account" throws. GDPR
Art. 17 does not accept a broken button.

Without `founding_members`, the founding webhook branch errors and a $99
purchase grants nothing. Without `webhook_events`, the admin page has no history
to show.

- [ ] **YOU:** All four applied
- [ ] **YOU:** Types regenerated, then remove the `as unknown as` casts in
      `src/lib/founding/rpc.ts`, `webhook-log.ts` and `admin-billing.functions.ts`
- [ ] **YOU:** Supabase **Pro** — the free tier has no backups and pauses after
      7 days of inactivity, which means paying customers locked out
- [ ] **YOU:** RLS check with two accounts. Sign in as A, note a trip id and a
      document path, then try to read them as B through the UI *and* the browser
      console. Every attempt must fail at the database

---

## Phase 2 — Stripe, the way it actually works now

Lovable's connector gateway holds the real secret. `STRIPE_SANDBOX_API_KEY` and
`STRIPE_LIVE_API_KEY` are connection identifiers, not Stripe keys, and calling
`api.stripe.com` directly with them fails.

### 2.1 Publish the product catalogue

Prices are found by **lookup key**, which is identical in sandbox and live, so
there is no test price that can leak into production.

| Lookup key | Price | Type |
|---|---|---|
| `starter_monthly` | $14 | recurring |
| `starter_yearly` | $140 | recurring |
| `pro_monthly` | $29 | recurring |
| `pro_yearly` | $290 | recurring |
| `teams_monthly` | $59/seat | recurring, per unit |
| `teams_yearly` | $590/seat | recurring, per unit |
| `founding_lifetime` | **$99** | **ONE-TIME, not recurring** |

Yearly is monthly × 10, matching `ANNUAL_MONTHS_CHARGED`. Set prices **tax
inclusive** and leave **Stripe Tax off** — you are a §19 UStG Kleinunternehmer,
so there is no entitlement to collect VAT.

Get `founding_lifetime` wrong and a founding member is billed $99 every month.

- [ ] **YOU:** Seven prices published with exactly these lookup keys

### 2.2 Customer portal

Stripe Dashboard → Settings → Billing → Customer portal → enable **"Customers
can cancel subscriptions"** and invoice history.

Off by default. With it off, the "Manage or cancel" button opens a portal with
no way out, which is the exact defect § 312k BGB targets — and your Terms,
refund policy and pricing page all promise cancellation without contacting
support.

- [ ] **YOU:** Cancellation enabled
- [ ] **YOU:** Invoice history enabled

### 2.3 Webhook

Endpoint: `https://<your-domain>/api/public/payments/webhook?env=live`
(and a second with `?env=sandbox` for testing).

The `/api/public/` prefix is the only one Lovable's proxy passes through
unauthenticated. Anywhere else Stripe gets a 403, retries for three days, then
drops the event, and subscription state drifts silently.

Events: `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.paid`, `charge.refunded`, `charge.dispute.created`.

- [ ] **YOU:** Both endpoints registered with all seven events

### 2.4 Finish go-live

Your Lovable checklist is on step 3 of 5: install the Lovable app on your **live**
Stripe account, create live API keys, run the readiness check.

**Do Phase 3 in test mode first.** Test mode does not need go-live finished.

- [ ] **YOU:** Steps 3, 4 and 5 complete

---

## Phase 3 — Test the money path (test mode, card `4242 4242 4242 4242`)

Every one of these has been broken at some point in this build.

**Subscription:**

1. Click a plan on the homepage → lands on `/pricing` with the plan preselected
2. Signed out → `/auth`, then straight back into checkout, no second choice
3. The embedded form renders inline (not a spinner, not "Something went wrong")
4. Amount matches the card you clicked. For Teams, the seat selector starts at
   the minimum, not an arbitrary number
5. Pay → returns to `/profile?checkout=success`, **not a 404**
6. Green "Payment received" banner
7. **Within a few seconds the plan updates.** This is the webhook writing to
   Postgres and `usePlanSync` reading it back. If this fails, the customer paid
   and got nothing
8. A gated feature (exports, vault) is now unlocked
9. "Manage or cancel subscription" opens the portal **with a visible cancel**
10. Cancel → back to Free within a few seconds

**Founding 100:**

11. `/pricing` shows the founding card with a real counter (or no number at all
    if the RPC fails — never an invented one)
12. Buy → charged **once**, no subscription created in Stripe
13. Profile shows **Founding Lifetime**, and a spot number exists in `profiles`
14. Pro features unlocked
15. In Stripe, resend the `checkout.session.completed` event. The spot number
    must stay the same and no second spot may be issued

**Admin:**

16. `/admin/billing` — search your own email, confirm the Stripe column is
    populated (if it says "none" for an account that has a subscription, the
    gateway call is failing)
17. "Reconcile entitlement" on a correct account reports **nothing changed**
18. Webhook events list shows the events from steps 5 and 12

- [ ] **YOU:** All 18 pass in test mode
- [ ] **YOU:** Switch to live and repeat 1–7 with a real card, then refund it

---

## Phase 3.5 — Threshold alerts (Scaleway TEM)

`pricing.ts` sells "Threshold alerts at 75% and 90%, by email and in-app" on
Starter. The code now exists; **until this phase is done the claim is still
false**, so either finish it or pull the line.

Scaleway was chosen over Resend and Postmark because the alert body contains
travel history tied to a named person, and the landing page states we host in
the EU. Scaleway is French infrastructure, so no SCCs and no new US
sub-processor.

### 3.5.1 Domain and keys

- [ ] **YOU:** Scaleway account, Transactional Email enabled
- [ ] **YOU:** Add the sending domain and publish **SPF, DKIM and DMARC** DNS
      records, then verify in the console. This is the step that matters: an
      unverified domain puts overstay warnings in spam, and a warning nobody
      sees is worse than none, because the person believes they are covered
- [ ] **YOU:** API key with `TransactionalEmailFullAccess`

Set in the platform project settings, **never in `.env`** (tracked in git):

```
SCALEWAY_SECRET_KEY     API secret key
SCALEWAY_PROJECT_ID     Project holding the verified domain
SCALEWAY_TEM_REGION     fr-par
ALERT_FROM_EMAIL        must be on the verified domain
ALERT_FROM_NAME         Driftly
ALERT_CRON_SECRET       long random string, see below
```

### 3.5.2 Migration

- [ ] **YOU:** Apply `20260817090000_alert_state.sql`. It adds `alert_state`
      and `profiles.nationality` — the passport previously lived only in
      localStorage, so the server could not tell who the Schengen rule even
      applies to
- [ ] **YOU:** Regenerate types, then drop the `UntypedDb` cast in
      `src/routes/api/public/alerts/run.ts`

### 3.5.3 Schedule it

The job is an endpoint, not a scheduled function, so any scheduler works:

```
POST https://<your-domain>/api/public/alerts/run
Header: x-alert-secret: <ALERT_CRON_SECRET>
```

`/api/public/` is the only prefix the proxy passes through unauthenticated,
same as the Stripe webhook. It is *not* unauthenticated: the secret is compared
in constant time, and the route accepts no user id or address from the caller,
so holding the secret cannot be turned into sending mail to arbitrary people
from your verified domain.

- [ ] **YOU:** Point something at it nightly — Supabase `pg_cron` + `pg_net`, a
      scheduled edge function, GitHub Actions, or a hosted cron service
- [ ] **YOU:** Confirm a wrong secret returns 403 and a missing one returns 503

### 3.5.4 Test

1. Log trips putting yourself over 75% of Schengen, run the job, check the mail
2. Run it **again** with nothing changed. No second email. This is the whole
   deduplication design and the thing most likely to be wrong in practice
3. Add trips crossing 90%. A second email arrives
4. Check the text part renders in a plain-text client
5. Confirm a free-plan account is skipped entirely
6. Confirm an EU-passport account gets no Schengen alert

- [ ] **YOU:** All six pass

---

## Phase 4 — Public

- [ ] `SITE_URL` set to the real domain (canonicals currently fall back to
      localhost, which tells Google your pages are duplicates of an unreachable host)
- [ ] Uncomment the `Sitemap:` line in `public/robots.txt` with the real domain
- [ ] Supabase → Authentication → URL Configuration: site URL plus a
      `https://*-<vercel-org>.vercel.app/**` wildcard for previews
- [ ] **YOU:** GitHub auth provider enabled, or remove the button.
      Apple needs a paid developer account (~$99/yr) — remove it unless you want that
- [ ] **YOU:** Google Search Console: verify, submit `/sitemap.xml`, request
      indexing for `/` and the four `/rules/*` pages
- [ ] **YOU:** Decide the name. Driftly was never cleared, and it is cheap to
      change now, expensive after inbound links and a Stripe account exist

---

## Do not sell a founding spot until

- `20260816120000_founding_members.sql` is applied
- Step 15 passes (replay does not issue a second spot)
- The customer portal has cancellation enabled

The cap is enforced in the database, so selling 101 is impossible — but only
once that migration exists.

---

## Known remaining issues

**`tier()` falls back instead of throwing.** Deliberate. A bad plan value would
otherwise crash the profile page of the person who just paid.

**Email search in the admin page loads up to 1000 users and filters in memory.**
Fine now, wrong at 50,000. The fix then is a search index, not a bigger page.

**`webhook_events` payloads contain billing addresses and emails.** The
migration ships `purge_old_webhook_events()` with a 90-day retention. Nothing
calls it yet — schedule it before you have real customers.

**Zero users.** The free tracker works and nobody has used it. Five
conversations would tell you more than a working checkout with nobody to charge.

**The alert job reads every eligible profile on each run.** Fine at this size,
wrong at fifty thousand. The fix then is to filter on plan in the query and
page the results, not to run it less often.

**Alerts cover limit rules only.** FEIE counts up toward a good outcome, so it
is deliberately excluded — "90% of 330 days" is progress, not danger. Falling
short of FEIE deserves its own alert with inverted logic and different copy.
