/**
 * Refunds & right of withdrawal (Widerrufsrecht).
 *
 * The mechanism worth understanding, because it constrains checkout:
 *
 *   §356(5) BGB — the 14-day withdrawal right on digital services lapses early
 *   ONLY if the customer (a) expressly consented to performance starting before
 *   the period ends, AND (b) acknowledged losing the right, AND (c) the service
 *   was then fully performed. A subscription is not "fully performed" on day
 *   one, so in practice the right survives into the period regardless.
 *
 * That is why this page promises a refund inside 14 days rather than arguing
 * about it. Denying a consumer right that is hard to extinguish would produce
 * chargebacks and a Stripe dispute rate, which costs more than the refunds.
 *
 * The goodwill policy beyond day 14 is a business choice, not a legal duty —
 * but once published it binds, so it is written narrowly and honestly.
 *
 * NOT DRAFTED BY A LAWYER. Have it reviewed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app";
import { PROVIDER } from "@/config/legal";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/legal/refunds")({
  head: () => ({
    meta: [
      { title: `Refunds & Withdrawal | ${APP_NAME}` },
      { name: "description", content: "Your 14-day withdrawal right and how refunds work." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: Refunds,
});

function Refunds() {
  return (
    <LegalPage
      title="Refunds & right of withdrawal"
      subtitle="Your statutory 14-day right, and what we do beyond it."
    >
      <LegalSection title="The short version">
        <p>
          Email {PROVIDER.email} within 14 days of paying and you get your money back. No form, no
          reason needed, no attempt to talk you out of it.
        </p>
      </LegalSection>

      <LegalSection title="Your statutory right of withdrawal">
        <p>
          If you are a consumer in the EU, you have 14 days from the conclusion of the contract to
          withdraw from it without giving any reason.
        </p>
        <p>
          To exercise it, tell us clearly. An email to {PROVIDER.email} saying you withdraw is
          enough. Sending it before the 14 days expire is what counts, not when we read it. You may
          use the model withdrawal form below, but you do not have to.
        </p>
        <p>
          We refund all payments received within 14 days of being informed, using the same payment
          method you used, at no charge to you.
        </p>
      </LegalSection>

      <LegalSection title="Why checkout asks you to tick a box">
        <p>
          Access starts the moment you pay, which is what almost everyone wants. Under German law,
          starting a digital service before the withdrawal period ends requires your express
          consent, so checkout asks for it.
        </p>
        <p>
          In principle that consent can cause the right to lapse once the service has been fully
          provided. We do not rely on that during your first 14 days. The policy above applies
          regardless.
        </p>
      </LegalSection>

      <LegalSection title="After 14 days">
        <p>
          Subscriptions are billed in advance for a period. After the withdrawal window, payments
          for a period already begun are not automatically refundable, and cancelling stops the next
          renewal rather than refunding the current period. Your access continues until the period
          ends.
        </p>
        <p>
          Two exceptions, applied without argument: if the service was substantially broken for a
          meaningful part of a period you paid for, and if an annual plan renewed and you tell us
          within 14 days that you did not intend to continue.
        </p>
      </LegalSection>

      <LegalSection title="Cancelling">
        <p>
          Cancel any time from your account. There is a cancellation button and no requirement to
          contact support, as required by § 312k BGB. You keep access until the end of the period
          you have paid for.
        </p>
      </LegalSection>

      <LegalSection title="Model withdrawal form">
        <div className="rounded-md border border-border bg-muted/30 p-4 text-xs leading-relaxed">
          <p>
            To: {PROVIDER.legalName}, {PROVIDER.addressLines.join(", ")}, {PROVIDER.email}
          </p>
          <p className="mt-2">
            I/we hereby give notice that I/we withdraw from my/our contract for the provision of the
            following service: {APP_NAME} subscription.
          </p>
          <p className="mt-2">Ordered on: ____________________</p>
          <p>Name of consumer: ____________________</p>
          <p>Address of consumer: ____________________</p>
          <p>Email used for the account: ____________________</p>
          <p className="mt-2">Signature (only if on paper): ____________________</p>
          <p>Date: ____________________</p>
        </div>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          Email {PROVIDER.email}. {PROVIDER.supportHours}. Refund requests are answered within two
          working days.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
