/**
 * Imprint / Impressum — DDG §5.
 *
 * Legally required on commercial German websites, and the single most likely
 * thing on this site to cost real money if missing: competitors and
 * Abmahnvereine send cease-and-desist letters over a missing or incomplete
 * imprint, and the fee is charged to the recipient.
 *
 * `noindex` is deliberate: an imprint should be reachable, not ranked.
 */
import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app";
import { LEGAL_LAST_UPDATED, ODR_URL, PROVIDER, VAT } from "@/config/legal";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/legal/imprint")({
  head: () => ({
    meta: [
      { title: `Imprint | ${APP_NAME}` },
      { name: "description", content: "Provider identification and legal notice." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: Imprint,
});

function Imprint() {
  return (
    <LegalPage title="Imprint" subtitle="Provider identification and legal notice.">
      <LegalSection title="Provider">
        <p className="font-medium text-foreground">{PROVIDER.tradingName}</p>
        <p>{PROVIDER.legalName}</p>
        {PROVIDER.addressLines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Email:{" "}
          <a href={`mailto:${PROVIDER.email}`} className="text-primary hover:underline">
            {PROVIDER.email}
          </a>
        </p>
        <p>Phone: {PROVIDER.phone}</p>
        <p>{PROVIDER.supportHours}</p>
      </LegalSection>

      <LegalSection title="Authorised representative">
        <p>{PROVIDER.representative}</p>
      </LegalSection>

      <LegalSection title="Business status">
        <p>
          Legal form: {PROVIDER.legalForm}. Not entered in the commercial register
          (Handelsregister); no entry is required for this legal form.
        </p>
        <p>Business registration: Registered with the competent {PROVIDER.tradeOffice}.</p>
        <p>
          VAT: Exempt under the small-business regulation pursuant to {VAT.basis}. No
          VAT is charged and no VAT identification number is issued under Art. 214
          Directive 2006/112/EC.
        </p>
      </LegalSection>

      <LegalSection title="Responsible for content">
        <p>
          {PROVIDER.representative}, {PROVIDER.addressLines.join(", ")}
        </p>
      </LegalSection>

      <LegalSection title="EU dispute resolution">
        <p>
          The European Commission provides a platform for online dispute resolution
          (ODR):{" "}
          <a href={ODR_URL} className="text-primary hover:underline" rel="noopener noreferrer" target="_blank">
            {ODR_URL}
          </a>
          . We are not obliged and not willing to participate in dispute resolution
          proceedings before a consumer arbitration board.
        </p>
      </LegalSection>

      <LegalSection title="Liability for content">
        <p>
          The contents of this website have been created with care. However, we cannot
          guarantee the accuracy, completeness or timeliness of the content. As a
          service provider we are responsible for our own content on these pages in
          accordance with applicable law. We are not obliged to monitor transmitted or
          stored third-party information, or to investigate circumstances that indicate
          illegal activity.
        </p>
        <p>
          Visa, tax and cost-of-living information published in {APP_NAME} is provided
          for guidance only and does not constitute legal or tax advice. See the Terms
          for the full position.
        </p>
      </LegalSection>

      <LegalSection title="Liability for links">
        <p>
          This website contains links to external third-party websites over whose
          content we have no influence. We therefore accept no liability for that
          external content. The respective provider or operator of the linked pages is
          always responsible for their content.
        </p>
      </LegalSection>

      <LegalSection title="Copyright">
        <p>
          Content and works created by the site operator are subject to copyright law.
          Duplication, processing, distribution or any form of commercialisation beyond
          the scope of copyright law requires the prior written consent of the author.
        </p>
      </LegalSection>

      <p className="pt-4 text-xs text-muted-foreground">
        Last updated: {LEGAL_LAST_UPDATED}
      </p>
    </LegalPage>
  );
}
