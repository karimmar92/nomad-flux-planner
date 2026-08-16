/**
 * Provider identification and legal constants.
 *
 * Single source of truth so the Impressum, Terms, Privacy Policy and invoice
 * footer cannot drift apart. Details taken from the operator's existing
 * imprint at adurothemagicpen.com.
 *
 * DDG §5 (formerly TMG §5) requires an imprint on commercial German websites
 * to be "leicht erkennbar, unmittelbar erreichbar und ständig verfügbar" —
 * easily recognisable, directly reachable and permanently available. In
 * practice that means a footer link on every page, reachable in one click,
 * which is why LegalFooter renders app-wide rather than only on marketing
 * pages.
 */

export const PROVIDER = {
  tradingName: "Aduro — The Magic Pen",
  legalName: "Karim Marzouki",
  addressLines: ["c/o POSTFLEX PFX-436-295", "Emsdettener Straße 10", "48268 Greven", "Germany"],
  email: "contact@adurothemagicpen.com",
  phone: "+49 1573 0843168",
  representative: "Karim Marzouki",
  /** Einzelunternehmer under §14 BGB; no Handelsregister entry required. */
  legalForm: "Sole proprietor (Einzelunternehmer) under German law (§ 14 BGB)",
  tradeOffice: "Gewerbeamt of the city of Greven, Germany",
  supportHours: "Mon–Fri · 09:00–18:00 CET",
} as const;

/**
 * VAT status. Referenced by the pricing page, checkout and invoices — if this
 * changes, every price display and the Stripe tax configuration change with it.
 *
 * See the long note in billing.functions.ts: the exemption ends at €10,000 of
 * cross-border B2C digital sales into other EU member states, which for a
 * product sold across Europe is the threshold that arrives first.
 */
export const VAT = {
  exempt: true,
  basis: "§ 19 UStG (Kleinunternehmerregelung)",
  /**
   * Currency is USD because that is what src/config/pricing.ts charges. If
   * pricing ever moves to EUR, change it here in the same commit — a price
   * page and a legal note disagreeing about currency is the kind of detail
   * that turns a refund request into a complaint.
   */
  notice:
    "Prices are in USD and final. The amount shown is the amount charged. No VAT is added: the provider is a sole proprietor under § 19 UStG (Kleinunternehmerregelung, Germany). An invoice is emailed automatically after payment.",
} as const;

/**
 * NO ODR LINK — deliberately.
 *
 * The EU Online Dispute Resolution platform was switched off on 20 July 2025
 * and the underlying ODR Regulation repealed, so the duty to link to it is
 * gone. Templates all over the web still carry the old
 * `ec.europa.eu/consumers/odr` link; publishing a dead link to a platform
 * that no longer exists is misleading and is exactly the kind of stale
 * boilerplate a Abmahnung letter picks up.
 *
 * What survives is the ADR duty (§ 36 VSBG): say whether you are willing or
 * obliged to take part in consumer arbitration. The imprint states this.
 */
export const CONSUMER_ARBITRATION_STATEMENT =
  "We are neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration board (Verbraucherschlichtungsstelle).";

/** Everything the app relies on that processes personal data. Named in the
 *  privacy policy because Art. 13 requires recipients to be disclosed. */
export const SUB_PROCESSORS = [
  {
    name: "Supabase",
    purpose: "Database, authentication and file storage",
    location: "EU (Frankfurt, eu-central-1)",
  },
  {
    name: "Vercel",
    purpose: "Website hosting and delivery",
    location: "EU and global edge network",
  },
  {
    name: "Stripe",
    purpose: "Payment processing and subscription billing",
    location: "EU and USA (Standard Contractual Clauses)",
  },
] as const;

export const LEGAL_LAST_UPDATED = "2026-08-14";
