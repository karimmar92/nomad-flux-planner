/**
 * Privacy Policy — GDPR Art. 13/14.
 *
 * Written from what the code ACTUALLY does, not from a template. Every claim
 * here is checkable against the repo, and several were only true because the
 * architecture was built that way deliberately:
 *
 *   - no analytics anywhere (verified: no gtag, posthog, plausible, mixpanel)
 *   - EU-hosted database (Supabase eu-central-1)
 *   - radar location fuzzed to ~1km before it leaves the device, no history
 *   - emergency health fields never leave the device at all
 *   - referral attribution session-scoped, not a 30-day cookie
 *
 * If any of those change, this page becomes false and must change with it.
 *
 * NOT DRAFTED BY A LAWYER. This is complete and honest, but the product
 * processes passport scans and travel history for EU residents, which is
 * high-risk. A DPIA under Art. 35 is likely mandatory. Get it reviewed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app";
import { PROVIDER, SUB_PROCESSORS } from "@/config/legal";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: `Privacy Policy | ${APP_NAME}` },
      { name: "description", content: "What we collect, why, and what we never do." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="What is collected, why, where it lives, and what never leaves your device."
    >
      <LegalSection title="Controller">
        <p>
          {PROVIDER.legalName}, trading as {PROVIDER.tradingName},{" "}
          {PROVIDER.addressLines.join(", ")}. Contact for any privacy question or
          request: {PROVIDER.email}.
        </p>
      </LegalSection>

      <LegalSection title="The short version">
        <p>
          There is no analytics or tracking script anywhere in this app. Nothing follows
          you between sites. The database is hosted in the EU. Your travel history is
          yours: you can export all of it as a file, or delete everything permanently,
          from your profile — no email to support required.
        </p>
      </LegalSection>

      <LegalSection title="What is collected, and why">
        <p>
          <span className="font-medium text-foreground">Account details</span> — email
          address, when you create an account. Needed to sign you in and back up your
          data. Lawful basis: performance of a contract (Art. 6(1)(b)).
        </p>
        <p>
          <span className="font-medium text-foreground">Trips and profile</span> —
          countries, entry and exit dates, nationality, income if you enter it. This is
          the product: the calculations are impossible without it. Lawful basis:
          contract.
        </p>
        <p>
          <span className="font-medium text-foreground">Documents</span> — anything you
          choose to upload to the vault, which may include passport scans and insurance
          certificates. Stored in a private bucket, encrypted at rest, retrievable only
          by you. Entirely optional. Lawful basis: consent (Art. 6(1)(a)).
        </p>
        <p>
          <span className="font-medium text-foreground">Approximate location</span> —
          only if you switch on the community radar, and only ever rounded to roughly a
          one-kilometre grid <em>before it leaves your device</em>. Your precise
          position is never transmitted and no location history is kept. Invisible by
          default; you choose to appear. Lawful basis: consent.
        </p>
        <p>
          <span className="font-medium text-foreground">Payment details</span> — handled
          entirely by Stripe. We receive a subscription status and an invoice reference;
          we never see or store card numbers. Lawful basis: contract.
        </p>
      </LegalSection>

      <LegalSection title="What never leaves your device">
        <p>
          Emergency health information — blood type, allergies, current medication — is
          stored only in your browser&apos;s local storage. It is deliberately excluded
          from synchronisation and never reaches our servers.
        </p>
        <p>
          Health data is special category personal data under Art. 9 and carries a
          higher bar than anything else here. Since the feature&apos;s entire value is
          being available offline on your device, there is no reason to accept that
          exposure — so we do not.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and similar storage">
        <p>
          No advertising or analytics cookies are set. The app uses local storage and
          IndexedDB to hold your trips and cached city data so it works offline, and a
          session cookie to keep you signed in — both strictly necessary for a service
          you have asked for.
        </p>
        <p>
          Referral links are held for the current browsing session only and are cleared
          when the tab closes. There is no persistent tracking cookie.
        </p>
      </LegalSection>

      <LegalSection title="Who else processes your data">
        <ul className="space-y-1.5">
          {SUB_PROCESSORS.map((p) => (
            <li key={p.name}>
              <span className="font-medium text-foreground">{p.name}</span> — {p.purpose}.{" "}
              {p.location}.
            </li>
          ))}
        </ul>
        <p>
          Each acts as a processor under a data processing agreement. Transfers outside
          the EU rely on Standard Contractual Clauses.
        </p>
        <p>Your data is never sold, and never shared for advertising.</p>
      </LegalSection>

      <LegalSection title="If your employer provides your account">
        <p>
          Where a company pays for your seat, it can see only country day-counts and
          threshold status — the minimum needed for its own compliance obligations.
        </p>
        <p>
          It cannot see your radar activity, your income or savings, your documents,
          your saved cities, your notes, or your location. That boundary is enforced in
          the database, not merely hidden in the interface, and a settings page shows
          you exactly what is shared.
        </p>
      </LegalSection>

      <LegalSection title="How long it is kept">
        <p>
          Account data is kept while your account exists. Delete your account and it is
          removed permanently, including stored files — this is immediate and cannot be
          undone.
        </p>
        <p>
          Invoices and payment records are retained where tax and commercial law
          requires it, independently of account deletion.
        </p>
        <p>
          Radar location data expires automatically after 7 days of inactivity.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You have the right to access, rectify, erase, restrict and port your data, and
          to object to processing. Where processing rests on consent, you may withdraw
          it at any time without affecting what was lawful beforehand.
        </p>
        <p>
          Two of these are built in rather than requiring a request: <strong>Download
          my data</strong> produces a machine-readable file of everything held, and{" "}
          <strong>Delete account</strong> erases it. Both are in your profile.
        </p>
        <p>
          For anything else, email {PROVIDER.email}. You also have the right to complain
          to a supervisory authority — in Germany, the data protection authority of your
          federal state.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Data is encrypted in transit and at rest. Access is enforced at the database
          level through row-level security, so a request for someone else&apos;s data
          fails at the source rather than relying on the interface to hide it. Document
          storage is private, reachable only through short-lived signed links.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          The service is not directed at children and paid accounts require you to be 18
          or over.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
