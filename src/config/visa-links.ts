/**
 * Official government application entry points for the nomad / long-stay visa
 * named in the seed data. These are GOVERNMENT sources only — never affiliate,
 * never sponsored. Compare is a partner-free zone (see PARTNER_FREE_ZONES);
 * these links exist purely so the user can act on the visa we name.
 */

export type VisaApplyLink = {
  /** Where the application actually starts. */
  url: string;
  /** Short label for the issuing authority. */
  authority: string;
};

/** Keyed by ISO country code, matching City.countryCode. */
export const VISA_APPLY_LINKS: Record<string, VisaApplyLink> = {
  PT: {
    url: "https://vistos.mne.gov.pt/en/national-visas/general-information/types-of-visa",
    authority: "Portuguese MFA (vistos.mne.gov.pt)",
  },
  ES: {
    url: "https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Teletrabajadores-internacionales.aspx",
    authority: "Spanish MFA / UGE",
  },
  GR: {
    url: "https://www.mfa.gr/en/visas/visas-for-foreigners-traveling-to-greece/national-visa-type-d.html",
    authority: "Greek MFA",
  },
  EE: {
    url: "https://www.politsei.ee/en/digital-nomad-visa",
    authority: "Estonian Police and Border Guard",
  },
  CZ: {
    url: "https://mzv.gov.cz/jnp/en/information_for_aliens/digital_nomad_visa/index.html",
    authority: "Czech MFA",
  },
  HU: {
    url: "https://oif.gov.hu/en/white-card/",
    authority: "Hungarian Immigration Office",
  },
  RS: {
    url: "https://welcometoserbia.gov.rs/",
    authority: "Serbian government portal",
  },
  AL: {
    url: "https://e-albania.al/",
    authority: "e-Albania portal",
  },
  GE: {
    url: "https://www.geoconsul.gov.ge/en",
    authority: "Georgian MFA e-consul",
  },
  TR: {
    url: "https://digitalnomads.goturkiye.com/",
    authority: "Türkiye Ministry of Culture and Tourism",
  },
  TH: {
    url: "https://www.thaievisa.go.th/",
    authority: "Thai e-Visa",
  },
  ID: {
    url: "https://evisa.imigrasi.go.id/",
    authority: "Indonesian Directorate General of Immigration",
  },
  MY: {
    url: "https://mdec.my/derantau",
    authority: "MDEC DE Rantau",
  },
  VN: {
    url: "https://evisa.gov.vn/",
    authority: "Vietnam National e-Visa",
  },
  TW: {
    url: "https://goldcard.nat.gov.tw/en/",
    authority: "Taiwan Employment Gold Card office",
  },
  KR: {
    url: "https://www.visa.go.kr/",
    authority: "Korea Visa Portal",
  },
  CN: {
    url: "https://bio.visaforchina.cn/",
    authority: "Chinese Visa Application Service Centre",
  },
  AE: {
    url: "https://u.ae/en/information-and-services/visa-and-emirates-id/residence-visas/virtual-work-residence-visa",
    authority: "UAE government portal",
  },
  MX: {
    url: "https://www.gob.mx/sre/acciones-y-programas/visas",
    authority: "Mexican MFA (SRE)",
  },
  CO: {
    url: "https://www.cancilleria.gov.co/tramites_servicios/visa",
    authority: "Colombian MFA",
  },
  AR: {
    url: "https://www.argentina.gob.ar/interior/migraciones/nomadas-digitales",
    authority: "Argentine Migraciones",
  },
  ZA: {
    url: "https://www.dha.gov.za/index.php/immigration-services/types-of-visas",
    authority: "South African Home Affairs",
  },
  MU: {
    url: "https://residency.mu/premium-visa/",
    authority: "EDB Mauritius",
  },
  PL: {
    url: "https://www.gov.pl/web/udsc",
    authority: "Polish Office for Foreigners",
  },
};

export function visaApplyLink(countryCode: string | undefined | null) {
  if (!countryCode) return undefined;
  return VISA_APPLY_LINKS[countryCode.toUpperCase()];
}
