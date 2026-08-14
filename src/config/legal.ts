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
  addressLines: [
    "c/o POSTFLEX PFX-436-295",
    "Emsdettener Straße 10",
    "48268 Greven",
    "Germany",
  ],
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
  notice:
    "Prices are in EUR and final. No VAT is charged — sole proprietor under § 19 UStG (Kleinunternehmerregelung, Germany). An invoice is emailed automatically after payment.",
} as const;

export const ODR_URL = "https://ec.europa.eu/consumers/odr";

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
