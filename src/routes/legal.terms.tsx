/**
 * Terms of Service / Terms of Sale.
 *
 * The liability position is the part that matters here. This product tells
 * people how many days they have left before an immigration or tax threshold.
 * If a figure is wrong and someone overstays, the consequence is a multi-year
 * entry ban — so the limits of what is promised have to be stated plainly and
 * early, not buried.
 *
 * NOT DRAFTED BY A LAWYER. This is a complete, honest starting document, but
 * German consumer law has traps (unfair-terms review under §§307–309 BGB in
 * particular voids over-broad liability exclusions), and a clause that is void
 * is worse than one that is narrow. Have it reviewed before scale.
 */
import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app";
import { PROVIDER, VAT } from "@/config/legal";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: `Terms of Service | ${APP_NAME}` },
      { name: "description", content: `Terms governing use of ${APP_NAME}.` },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle={`The agreement between you and ${PROVIDER.tradingName} for use of ${APP_NAME}.`}
    >
      <LegalSection title="1. Who you are contracting with">
        <p>
          {APP_NAME} is operated by {PROVIDER.legalName}, trading as {PROVIDER.tradingName},{" "}
          {PROVIDER.addressLines.join(", ")}. Contact: {PROVIDER.email}. Full provider details are
          in the Imprint.
        </p>
      </LegalSection>

      <LegalSection title="2. What the service does — and does not — do">
        <p>
          {APP_NAME} counts days you record against published thresholds: the Schengen 90/180 rule,
          per-country tax-residency day limits, and similar tests. It reports arithmetic on the
          information you enter.
        </p>
        <p className="font-medium text-foreground">
          It is not legal, immigration, tax or financial advice, and must not be relied on as the
          sole basis for a decision about travel, residence or taxation.
        </p>
        <p>
          The service never states that you are tax resident in a country, or that a stay is lawful.
          Residency and admissibility depend on factors beyond day counting — permanent home, centre
          of vital interests, family ties, the discretion of a border officer — and those are
          questions for a qualified adviser or the relevant authority.
        </p>
        <p>
          Cost-of-living, visa and tax figures are researched estimates carrying a visible
          last-verified date. Rules change, sometimes without notice. Always confirm with the
          official source before you travel or file.
        </p>
      </LegalSection>

      <LegalSection title="3. Your responsibilities">
        <p>
          The output is only as good as what you enter. You are responsible for the accuracy and
          completeness of the trips you record, and for verifying anything consequential against the
          relevant authority.
        </p>
        <p>You must be at least 18 to hold a paid subscription.</p>
        <p>
          You may not use the service unlawfully, attempt to circumvent access controls, scrape the
          dataset at scale, or resell access.
        </p>
      </LegalSection>

      <LegalSection title="4. Accounts and free use">
        <p>
          Logging trips and viewing your current status is free and requires no account. Without an
          account, data is stored only on your device and is lost if you clear your browser or
          change device. Creating an account backs it up and makes it available across devices.
        </p>
      </LegalSection>

      <LegalSection title="5. Subscriptions, prices and payment">
        <p>
          Paid plans are billed in advance, monthly or annually, and renew automatically until
          cancelled. Payment is processed by Stripe; we never see or store your card details.
        </p>
        <p>{VAT.notice}</p>
        <p>
          You can cancel at any time from your account, without contacting support, in line with §
          312k BGB. Cancellation takes effect at the end of the paid period and access continues
          until then.
        </p>
        <p>
          We may change prices with at least 30 days&apos; notice by email. A price change never
          applies to a period you have already paid for, and you may cancel before it takes effect.
        </p>
      </LegalSection>

      <LegalSection title="6. Right of withdrawal">
        <p>
          Consumers in the EU have a 14-day right of withdrawal on digital services. Because the
          service begins immediately, you are asked at checkout to consent expressly to immediate
          performance and to acknowledge that the right lapses once the service has been fully
          provided.
        </p>
        <p>
          The full policy, including how to withdraw and what happens to any payment, is on the
          Refunds &amp; withdrawal page.
        </p>
      </LegalSection>

      <LegalSection title="7. Availability">
        <p>
          The service is provided as-is and without an uptime guarantee. It is a small independent
          product, not an enterprise system with an SLA. Core day counting is designed to work
          offline on your device precisely so that a server outage does not leave you without an
          answer at a border.
        </p>
      </LegalSection>

      <LegalSection title="8. Liability">
        <p>
          Nothing in these terms limits liability for death or personal injury caused by negligence,
          for intent or gross negligence, for fraudulent misrepresentation, or for any liability
          that cannot be excluded under German law — including under the Produkthaftungsgesetz.
        </p>
        <p>
          Subject to that, and for slight negligence, liability is limited to breach of material
          obligations (Kardinalpflichten) — those whose fulfilment makes proper performance possible
          and on which you may routinely rely — and in that case to foreseeable damage typical for
          this kind of contract.
        </p>
        <p>
          We are not liable for consequences arising from information you entered incorrectly or
          incompletely, from rules changing after publication, or from a decision made by an
          immigration officer, tax authority or other body.
        </p>
      </LegalSection>

      <LegalSection title="9. Termination">
        <p>
          You may delete your account at any time from your profile, which permanently removes your
          data. We may suspend or terminate an account that breaches these terms, with notice where
          reasonably possible.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to these terms">
        <p>
          We may update these terms. Material changes affecting paid subscribers will be notified by
          email at least 30 days in advance, and you may cancel before they take effect.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing law">
        <p>
          German law applies. If you are a consumer, this does not deprive you of the protection of
          mandatory provisions of the law of your country of residence.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
