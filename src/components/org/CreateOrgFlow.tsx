/**
 * Self-serve organisation creation, payment and first invites.
 *
 * `createOrganisation` already existed as a server function, and the RLS
 * policy that lets any authenticated user create one is literally named
 * "authenticated create org" — the backend was ready. Nothing on the
 * frontend ever called it. This is that door.
 *
 * Billing is real, not a promise. `createCheckoutSession` already supported
 * `plan: "teams"` with an adjustable seat quantity — Stripe-side, this was
 * fully wired and simply never exposed to a buyer. The old version of this
 * flow created an unpaid org and said "we'll invoice you", which is a lead
 * form wearing a progress bar. Now the admin pays for their seats inline,
 * in the same embedded checkout the consumer tiers use, before inviting
 * anyone — the org exists the moment they can afford to staff it, and the
 * subscription is real from the first seat.
 *
 * Four steps: create the org shell -> pay for seats -> invite the team ->
 * done. Paying can still be skipped (a real "invoice us" path stays for
 * accounts that need a PO), but it is no longer the only option.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, CreditCard, Users } from "lucide-react";
import { createOrganisation, inviteSeat } from "@/lib/org/org.functions";
import { MINIMUM_SEATS, monthlyEquivalentUsd, usd, yearlyTotal } from "@/lib/org/pricing";
import { EVALUATION_SEATS } from "@/config/business-plans";
import { TRIAL_DAYS } from "@/config/pricing";
import { PlanPicker, type PlanChoice } from "@/components/org/PlanPicker";
import { CheckoutDialog, type CheckoutRequest } from "@/components/billing/CheckoutDialog";
import { paymentsAvailable } from "@/lib/stripe";

type Step = "create" | "billing" | "invite" | "done";

export function CreateOrgFlow({ onFinished }: { onFinished: () => void }) {
  const [step, setStep] = useState<Step>("create");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [seats, setSeats] = useState(String(MINIMUM_SEATS));
  const [choice, setChoice] = useState<PlanChoice>({
    tier: "advanced",
    seats: MINIMUM_SEATS,
  });
  const [checkout, setCheckout] = useState<CheckoutRequest | null>(null);
  const [emailsText, setEmailsText] = useState("");

  const create = useServerFn(createOrganisation);
  const invite = useServerFn(inviteSeat);
  const seatCount = Math.max(MINIMUM_SEATS, Number(seats) || MINIMUM_SEATS);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const org = await create({
        data: { name, billing_email: billingEmail, seats: seatCount },
      });
      setOrgId(org.org_id);
      setOrgName(name);
      setStep("billing");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create that organisation.");
    } finally {
      setBusy(false);
    }
  }

  function startCheckout() {
    if (!paymentsAvailable()) {
      toast.error("Checkout is not available on this build yet — use “invoice us instead” below.");
      return;
    }
    setCheckout({ plan: "teams", interval: "yearly", seats: seatCount, tier: choice.tier });
  }

  async function submitInvites() {
    if (!orgId) return;
    const emails = Array.from(
      new Set(
        emailsText
          .split(/[\n,]+/)
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    if (emails.length === 0) {
      setStep("done");
      return;
    }
    setBusy(true);
    const results = await Promise.allSettled(
      emails.map((email) => invite({ data: { org_id: orgId, email, role: "member" } })),
    );
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    const failed = rejected.length;
    setBusy(false);
    if (failed > 0) {
      // Say why. A seat limit and a typo need different fixes.
      const reason = rejected[0]?.reason;
      toast.error(
        `${failed} of ${emails.length} ${emails.length === 1 ? "invite" : "invites"} not sent. ${reason instanceof Error ? reason.message : "Check those addresses."}`,
      );
    } else {
      toast.success(`${emails.length} ${emails.length === 1 ? "invite" : "invites"} sent.`);
    }
    setStep("done");
  }

  if (step === "create") {
    return (
      <div className="panel max-w-lg space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold">Start your team, in three steps</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No sales call required to start. Create the org, pay for your seats, invite your people
            — and see real exposure the moment anyone who already tracks their own trips accepts,
            not a blank dashboard.
          </p>
        </div>
        <form onSubmit={submitCreate} className="space-y-3">
          <label className="block space-y-1">
            <span className="label-xs">Organisation name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input"
            />
          </label>
          <label className="block space-y-1">
            <span className="label-xs">Billing email</span>
            <input
              type="email"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              required
              className="input"
            />
          </label>
          <label className="block space-y-1">
            <span className="label-xs">Seats (minimum {MINIMUM_SEATS})</span>
            <input
              type="number"
              min={MINIMUM_SEATS}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className="input num"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              From {usd(monthlyEquivalentUsd("basic"))} a seat a month, billed yearly. You will
              choose a plan on the next step.
            </span>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create organisation"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>
    );
  }

  if (step === "billing") {
    const total = yearlyTotal(seatCount, choice.tier);
    return (
      <div className="panel max-w-lg space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold">Choose a plan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            For {orgName || "your organisation"}. Card charged after a {TRIAL_DAYS}-day trial,
            cancel any time from the billing portal. The same checkout the personal plans use.
          </p>
        </div>

        <PlanPicker
          value={{ ...choice, seats: seatCount }}
          onChange={(c) => {
            setChoice(c);
            setSeats(String(c.seats));
          }}
        />

        <button
          type="button"
          onClick={startCheckout}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          <CreditCard className="h-4 w-4" aria-hidden />
          Start {TRIAL_DAYS}-day trial · {usd(total)} a year after
        </button>
        <button
          type="button"
          onClick={() => setStep("invite")}
          className="min-h-11 w-full rounded-full border border-border px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          Not yet: evaluate with up to {EVALUATION_SEATS} people
        </button>

        {checkout ? (
          <CheckoutDialog request={checkout} returnPath="/org" onClose={() => setCheckout(null)} />
        ) : null}
      </div>
    );
  }

  if (step === "invite") {
    return (
      <div className="panel max-w-lg space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold">Invite your team</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One email per line. Anyone who already logs trips in their own account starts sharing
            country and dates with {orgName || "your organisation"} the moment they accept — their
            history is already there, not re-entered.
          </p>
        </div>
        <label className="block space-y-1">
          <span className="label-xs">Work emails</span>
          <textarea
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            rows={6}
            placeholder={"amina@company.com\njonas@company.com"}
            className="w-full rounded-md border border-input bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-primary"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submitInvites}
            disabled={busy}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send invites"}
          </button>
          <button
            type="button"
            onClick={() => setStep("done")}
            className="min-h-11 rounded-full border border-border px-4 text-sm text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel max-w-lg space-y-3 p-5 text-center">
      <Users className="mx-auto h-6 w-6 text-primary" aria-hidden />
      <h2 className="text-base font-semibold">{orgName || "Your organisation"} is set up</h2>
      <p className="text-sm text-muted-foreground">
        Invited teammates show up here as soon as they accept. While you evaluate, the organisation
        holds {EVALUATION_SEATS} people including you. Choose a plan from the Seats tab to add more.
      </p>
      <button
        type="button"
        onClick={onFinished}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Go to your dashboard
      </button>
    </div>
  );
}
