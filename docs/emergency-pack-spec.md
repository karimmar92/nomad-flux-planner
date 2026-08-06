# Emergency pack — build spec

## What it is

The screen you open when something has gone wrong abroad: passport stolen, hospitalised, robbed, arrested, phone lost. It must work with **no connectivity**, because that is the state you are in when it matters — foreign country, no roaming, possibly no phone of your own.

## The uncomfortable decision first: this should be free

Gating emergency information behind a paywall is indefensible. *"The app wanted €9 before it would show me the embassy number after I was robbed"* is a story that ends a product.

So it does **not** justify Pro, and I would stop pretending it does. What it justifies is **keeping the app installed** — and an app people keep is an app that converts later, when the tax report or the Schengen deadline actually bites.

The honest €9 case remains what it was: risk avoidance. A three-year Schengen ban, an accidental tax residency, an accountant charging €200 to reconstruct your year from boarding passes. That is a framing problem, not a feature gap, and adding features will not fix it.

---

## Structure — four blocks

### 1. Your details (user-entered, device-only)

Entered once, available offline forever. Requires no data seeding, which is why it is the cheapest high-value part of this whole feature.

| Field | Notes |
|---|---|
| Insurance provider + policy number | The single most-needed number in a medical emergency |
| Insurance 24h emergency line | Distinct from customer service — people grab the wrong one |
| Emergency contact name + number | With country code, because you will be dialling internationally |
| Blood type | **Health data — see below** |
| Allergies and medication | **Health data — see below** |
| Passport number and expiry | For police reports and replacement applications |

**Health fields are stored locally only and never synced to the server.**

Blood type, allergies and medication are health data — **special category personal data under GDPR Article 9**, which carries a materially higher bar than everything else in this app. Holding it server-side would mean explicit consent, a stronger lawful basis and a heavier DPIA, for a feature whose entire value is being available offline on the device anyway.

So: these fields live in IndexedDB, are excluded from the sync queue, are excluded from the Article 20 export, and the UI says so plainly. Add an assertion in the sync layer so a future refactor cannot quietly start uploading them.

Passport number is not special category but is high-risk — same local-only treatment.

### 2. This country (seeded, ~30 rows)

Small dataset, high value, rarely changes.

- Emergency number (many countries have several — police, ambulance, fire)
- Whether **112** works (it does across the EU and in many other places, and most people don't know)
- Tourist police, where it exists — Thailand's 1155 is genuinely different from 191
- Whether hospitals expect payment upfront, and roughly how much
- Whether the police report needs to be filed in person, and in which language

### 3. Playbooks (generic, cached)

Short, ordered, imperative. Written for someone panicking. No paragraphs.

**Passport stolen**
1. Police report first — your embassy will require it
2. Photograph or collect the report reference
3. Contact your embassy (block 4)
4. Emergency travel document, not a replacement passport, if you need to move soon
5. Tell your insurer — many cover the replacement fee

**Hospitalised** · **Robbed** · **Arrested** · **Phone lost or stolen**

Each five to seven steps. Around 800 words for the whole set, cached with the app shell.

### 4. Embassy contacts (seeded, honest gaps)

Your embassy, for **your** nationality, in the country you are currently in. This is a matrix — ten nationalities across thirty countries is three hundred rows — so it cannot be complete at launch.

Seed the highest-traffic pairs only, and **state coverage honestly**: *"We don't have your embassy in Georgia yet. Your government's locator is at [URL] — save it before you travel."*

An honest gap is fine. A wrong address in an emergency is not.

---

## Behaviour

- Reachable in **two taps from anywhere**, and from the lock-screen shortcut if the PWA is installed. Nobody navigates a menu in a crisis.
- Everything renders from cache. If any part needs the network, it is in the wrong block.
- Country auto-selected from the current open trip, manually overridable.
- Phone numbers are `tel:` links with the country code pre-pended.
- Large type. Assume stress, poor light, a cracked screen, or borrowed hands.
- If "your details" is empty, prompt once during the pre-departure checklist — the moment someone is already thinking about preparation.

## Where insurance affiliate fits

Under the medical playbook only, and only as: *"No cover? Most nomad visas require it anyway."* Never on the screen someone opened because they are already in trouble — selling to a frightened person is the clearest possible violation of the partner rules we already set.

## Build order

1. **Your details** — no data needed, immediate value, entirely device-local
2. **Playbooks** — write once, ~800 words, cached
3. **Country emergency numbers** — ~30 rows
4. **Embassy matrix** — last, incrementally, with visible gaps

One and two are a day's work and cover most of the value.

## What this does not do

No hospital finder, no lawyer directory, no translation. Those need live data, verification and liability cover this product cannot carry. If someone needs a lawyer, the embassy has the list — that is what block 4 is for.
