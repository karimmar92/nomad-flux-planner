# Plans — build spec

## The core decision

**Don't match people. Surface plans.**

*"Dinner at Warung Bu Mi — Thursday 7pm — 3 going"* is social, useful, and structurally not a dating app. It is a group, in public, organised around an activity rather than a person. Nobody browses humans; they browse things that are happening.

An app becomes dating through four mechanics: **photo-first browsing, swiping or matching, gender filters, and 1:1 private messaging as the primary interaction.** Meetup, Couchsurfing Hangouts and Timeleft are all genuinely social and use none of them. Plans uses none of them either.

The existing radar answers *who is around*. Plans answers *what is happening*. The second is the one that gets people out of the house.

---

## Why this beats a radar of faces

**Cold start.** One person posting a plan activates twenty. A radar full of profiles nobody messages activates nobody. Plans is the cheaper path to a community that feels alive.

**Moderation.** Groups self-police. Private channels between strangers do not. This removes most of the moderation cost before it exists.

**Safety.** Public venue, group setting, no private channel until people have actually met. The structure does the work that policy would otherwise have to.

---

## The object

```
plan
  id
  host_id            -> auth.users
  city_id            text
  activity           enum: coffee | lunch | dinner | drinks | coworking
                           | walk | gym | other
  venue_name         text, required
  venue_hint         text, optional  ("upstairs, the back tables")
  starts_at          timestamptz
  capacity           int, default 6, max 10
  note               text, 200 char cap
  status             open | full | cancelled | past
  created_at
```

```
plan_attendee
  plan_id, user_id, joined_at, status: going | left
  PRIMARY KEY (plan_id, user_id)
```

```
plan_message          -- one thread per plan, attendees only
  id, plan_id, sender_id, body (500 cap), created_at
```

Reports reuse the existing `reports` table with a `target_type` of `plan`.

---

## Rules the code must enforce

**Public venue, always.** A venue name is required and accommodation addresses are never acceptable. A standing line sits on the create form and the join confirmation: *"Public places only. Never share where you're staying."* This is the single most important rule on the screen.

**Capacity 2–10, default 6.** Small enough to actually talk to everyone. Larger gatherings are events and need different tooling — not this.

**Plans expire.** Nothing more than 14 days ahead, and a plan disappears from discovery once its time passes. Spontaneity is the point, and distant plans have terrible turnout.

**No gender field, no gender filter.** Kept from the radar spec. It is the single feature that most reliably turns a meetup product into a harassment vector, and its absence costs nothing.

**No photos of people anywhere in Plans.** Avatars stay as generated initials. The venue and the activity are the visual, not the attendees.

**No 1:1 messaging.** The plan thread is visible to everyone attending. If two people want to talk privately, they can do that after they have met, through the existing connection request flow — which requires a written intro and acceptance.

**Blocking is transitive.** If A blocks B, neither sees plans hosted by the other, and neither sees the other in an attendee list. Enforce it in the query, not the UI.

---

## Screens

**Plans list** — `/plans`. Plans in the user's current city, soonest first. Each row: activity icon, venue, day and time, "3 of 6 going", host's first name. Filter chips by activity. Empty state is *"Nothing planned in Canggu yet — be the first"* with the create button, not a shrug.

**Plan detail** — venue, time, note, who is going (names and headlines only), Join or Leave, and the thread once you have joined. Report and a standing safety line.

**Create plan** — activity, venue, date, time, capacity, optional note. Three taps for the common case: default to tomorrow, default capacity 6, most-used activity first. Friction here is the difference between a live board and a dead one.

**Joining** — one tap, no approval. A first-time joiner sees a short safety note once: public places, tell someone where you are, leave if it feels off. Never shown again.

---

## Privacy interaction with the radar

Joining a plan reveals your display name and headline to the other attendees. That is a deliberate disclosure and the UI must say so plainly at the moment of joining — **it overrides ghost mode for that plan only**, and for nothing else. Ghost mode continues to hide you from the radar itself.

Never expose precise location through Plans. The venue is a place, not the user.

---

## Cold start

Plans is worthless empty, so the launch has to be hand-run:

1. **Bali only**, same as the radar. Density beats coverage.
2. **Seed the first two weeks yourself.** Post three or four real plans — a Tuesday coworking session, a Thursday dinner — and actually attend them. A board with four plans reads as alive; a board with zero reads as abandoned.
3. **The first plan matters more than the first hundred users.** Prompt anyone who joins one to host the next.

---

## Monetisation

**None, and I would keep it that way.** Plans is a retention feature — it makes the app the one people keep installed, which is what makes the tracker and reports convert later.

Venue partnerships would monetise it directly and would also destroy it: the moment a bar pays for placement, the recommendations stop being real. Same rule as the city rankings.

**Free tier, permanently.** Gating it would kill the density it depends on.

---

## What this deliberately is not

No general social feed, no photo sharing, no follower graph, no reviews. Those are commodity features with real moderation costs, and every one of them pulls the product further from a compliance tool that happens to have a community.

Plans does one thing: helps someone who does not know anybody get a beer with three people this week.

---

## Build order

1. Schema, RLS, blocking-aware queries
2. Create and list — the loop only needs these two to work
3. Join, leave, attendee list
4. Plan thread
5. Report

One through three is the minimum that produces value. The thread can wait until people are actually turning up.
