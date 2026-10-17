/**
 * Right-to-work and social-security facts per country.
 *
 * Every entry below was taken from an official source and carries the link and
 * the date it was checked. See src/lib/work-rights.ts for the rules entries
 * must satisfy; they are enforced by tests.
 *
 * Add or change an entry only with a source you have read. "unclear" is a
 * complete and honest answer; a guess that reads as fact is not.
 *
 * Two things to keep in mind when reading a position:
 *  - "grey_area" is the common, honest answer. Most countries' law bars "work"
 *    on a visitor's status but never says whether remote work for a foreign
 *    employer counts, and that is exactly what the entry says.
 *  - US totalization status comes from the Social Security Administration's own
 *    list of agreements in force, which can change when a new one takes effect.
 */
import type { WorkRightsEntry } from "@/lib/work-rights";

export const WORK_RIGHTS: WorkRightsEntry[] = [
  {
    countryCode: "AL",
    country: "Albania",
    visitorWork: {
      status: "grey_area",
      summary:
        "Short stay is capped at 90 days in 180 (Arts 29, 31); employment in Albania needs a unique permit (Art 56). The law is silent on whether remote work for a foreign employer counts as such employment.",
      sources: [
        {
          label:
            "Law 79/2021 'On Aliens' as amended by Law 43/2025 (consolidated, Albanian) - Arts 29, 31, 56",
          url: "https://asp.gov.al/wp-content/uploads/2025/11/Ligj-PER-TE-HUAJT-2021-06-24-79-perditesuar-2025-PDF.pdf",
        },
      ],
    },
    remoteRoute: {
      name: "Unique residence permit for digital mobile workers (Law 79/2021 Art 68)",
      conditions:
        "First permit up to 1 year; applicant must already be lawfully in Albania, hold a contract with an employer/client abroad, show sufficient income (no figure in the law), accommodation, 1-year health insurance and a criminal record certificate.",
      sources: [
        {
          label: "Law 79/2021 as amended 2025 - Art 68 (p. 38) and Art 2(39) definition",
          url: "https://asp.gov.al/wp-content/uploads/2025/11/Ligj-PER-TE-HUAJT-2021-06-24-79-perditesuar-2025-PDF.pdf",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Albania is outside Reg 883/2004, so an EU A1 does not apply there, and the US has no agreement. No official Albanian statement was found on contributions for a short-stay remote worker for a foreign employer.",
      sources: [
        {
          label: "European Commission - EU social security coordination (countries covered)",
          url: "https://employment-social-affairs.ec.europa.eu/node/76_en",
        },
        {
          label: "SSA POMS GN 01701.005 (Albania not listed)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "Income threshold, fees and document list sit in a Council of Ministers decision (Art 56(7)) that was not retrieved. Third-party figures conflict.",
      "Whether authorities treat short-stay remote work as employment under Art 56: no official guidance found.",
      "The Ministry of Interior English text and e-Albania service page were blocked or not reachable.",
      "Albanian social security treatment of visitors working for foreign employers not established.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "AR",
    country: "Argentina",
    visitorWork: {
      status: "grey_area",
      summary:
        "No express ban or permission for remote work by tourists. The immigration authority's 2022 disposition says the tourist category covers rest and leisure and does not fit people staying to work, which is why it created a separate nomad residence.",
      sources: [
        {
          label: "DNM Disposición 758/2022, official text (considerandos)",
          url: "https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-758-2022-364601/texto",
        },
        {
          label: "Boletín Oficial notice",
          url: "https://www.boletinoficial.gob.ar/detalleAviso/primera/262282/20220511",
        },
      ],
    },
    remoteRoute: {
      name: "Residencia transitoria 'Nómada Digital' (Disposición DNM 758/2022)",
      conditions:
        "Up to 180 days, one extension of equal length. Only for nationals of countries not needing a tourist visa. Proof of remote work for clients abroad (contract or income receipts). Extension needs income proof, criminal record certificate and 50% of the period spent in Argentina. No minimum income stated.",
      sources: [
        {
          label: "Disposición 758/2022 text",
          url: "https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-758-2022-364601/texto",
        },
        {
          label: "argentina.gob.ar service page",
          url: "https://www.argentina.gob.ar/servicio/obtener-una-residencia-transitoria-como-nomada-digital",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Argentina is not on SSA's in-force list. Absent an agreement, dual coverage is possible. Argentine contribution duties for a short-term foreign-employer remote worker were not established from an official source.",
      sources: [
        {
          label: "SSA POMS GN 01701.005, agreements in force",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "Law 25.871 itself was not retrieved; tourist-category reasoning is from the disposition's considerandos.",
      "Current fees and whether the rules changed after 2022 not verified.",
      "Argentine social-security treatment of short stays not verified.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "CN",
    country: "China",
    visitorWork: {
      status: "grey_area",
      summary:
        "State Council rules bar tourist (L) visa holders from working in China, and the Exit-Entry Law requires a work permit for work. Visa-free entry covers business, tourism and similar purposes. Remote work for a foreign employer is not expressly addressed in the sources read.",
      sources: [
        {
          label: "NIA, Rules for the Administration of Employment of Foreigners, Art. 8",
          url: "https://en.nia.gov.cn/n147418/n147458/c155980/content.html",
        },
        {
          label:
            "Exit-Entry Administration Law, Arts. 37, 41, 80 (Shenzhen government English copy)",
          url: "https://www.sz.gov.cn/en_szgov/services/personal/employment/content/post_8034735.html",
        },
        {
          label: "NIA, unilateral visa exemption (30-day stays; purposes listed)",
          url: "https://en.nia.gov.cn/n147418/n147463/c183390/content.html",
        },
      ],
    },
    remoteRoute: {
      name: null,
      conditions: null,
      sources: [],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "China is not on SSA's in-force list. Chinese law requires foreigners employed in China to join its social insurance. A short-term remote worker's duty to contribute was not established.",
      sources: [
        {
          label: "SSA POMS GN 01701.005, agreements in force",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
        {
          label:
            "Ministry of Justice, social insurance for foreign employees (seen via search extract only)",
          url: "https://en.moj.gov.cn/2019-06/20/c_383619.htm",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "No official source found that addresses remote work for a foreign employer from China. The position rests on the general tourist-visa work bar and the work-permit rule.",
      "Searched for a remote-worker or digital-nomad visa and found none from an official source; absence not proven.",
      "The Social Insurance Law Art. 97 and Ministry of Justice page were not opened directly.",
      "The NIA rules page is the 1996 rules as amended in 2017 and may have been superseded.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "CO",
    country: "Colombia",
    visitorWork: {
      status: "conditional",
      summary:
        "Cancillería's rule lets digital nomads and remote workers from visa-exempt nationalities enter without a visa and stay on an entry permit, provided the stay generates no payments from Colombian companies. 90 days, extendable to 180 a year. The Labour Ministry words it differently.",
      sources: [
        {
          label: "Cancillería, Resolución 5477 de 2022, Art. 46 and its paragraph",
          url: "https://www.cancilleria.gov.co/normograma/compilacion/docs/resolucion_minrelaciones_5477_2022.htm",
        },
        {
          label: "Cancillería, visa page (nómada digital section)",
          url: "https://www.cancilleria.gov.co/atencion-y-servicio-al-ciudadano/tramites-y-servicios/visa/necesito-un-visa",
        },
        {
          label: "Cancillería press release, 4 Aug 2022",
          url: "https://www.cancilleria.gov.co/sala-de-prensa/noticias/la-visa-para-nomadas-digitales-ya-es-una-realidad-y-comenzara-funcionar-este-ano-en-colombia",
        },
      ],
    },
    remoteRoute: {
      name: "Visa V (Visitante) - Nómadas Digitales / Trabajadores Remotos",
      conditions:
        "Valid up to 2 years. Income of at least 3 monthly minimum wages, shown by 3 months of bank statements. Letter from the foreign employer, health insurance valid in Colombia. No work for Colombia-based clients or employers.",
      sources: [
        {
          label: "Cancillería, Resolución 5477 de 2022, Art. 46",
          url: "https://www.cancilleria.gov.co/normograma/compilacion/docs/resolucion_minrelaciones_5477_2022.htm",
        },
        {
          label: "Cancillería visa page",
          url: "https://www.cancilleria.gov.co/atencion-y-servicio-al-ciudadano/tramites-y-servicios/visa/necesito-un-visa",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Colombia is not on SSA's in-force list. Absent an agreement, dual coverage is possible. Colombian contribution duties for a short-term foreign-employer remote worker were not established from an official source.",
      sources: [
        {
          label: "SSA POMS GN 01701.005, agreements in force",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "high",
    openQuestions: [
      "Not checked whether Resolution 5477 was amended after 2022; the Cancillería pages read were current at access.",
      "Cancillería says visa-exempt visitors may work remotely, but the Labour Ministry says a tourist entry does not allow work; the two may be about different situations.",
      "Colombian social-security contribution rules for short-stay foreign remote workers not verified (UGPP).",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "CZ",
    country: "Czechia",
    visitorWork: {
      status: "not_permitted",
      summary:
        "The Interior Ministry's foreigners portal says a visa-free stay is exclusively for non-profit purposes, so you cannot be employed or do business. Remote work for a foreign employer is not specifically addressed, though the wording is broad.",
      sources: [
        {
          label: "Ministry of the Interior information portal - Visa-free stays",
          url: "https://ipc.gov.cz/en/visa-and-residence-permit-types/third-country-nationals/short-term-and-visa-free-stays/visa-free-stays/",
        },
        {
          label: "Ministry of Foreign Affairs - Schengen visa for employment (short stay)",
          url: "https://mzv.gov.cz/jnp/en/information_for_aliens/short_stay_visa/visa_for_a_stay_up_to_90_days_for_the_2.html",
        },
      ],
    },
    remoteRoute: {
      name: "Digital Nomad Program (Government Resolution No. 475/2023)",
      conditions:
        "IT or marketing specialists only, from listed countries including the US. Employee of a foreign employer with 50+ staff worldwide: income at least 1.5x the average gross annual salary; visa for 'other' purposes. Freelancers need a Czech IT or marketing trade licence and a business visa. No legal entitlement to admission.",
      sources: [
        {
          label: "Ministry of Industry and Trade - Digital Nomad Program (PDF, 2025)",
          url: "https://mpo.gov.cz/assets/en/foreign-trade/economic-migration/programs-and-projects/2025/7/Digital-Nomad-EN.pdf",
        },
        {
          label: "Ministry of Industry and Trade - Digital Nomad Program page",
          url: "https://www.mpo.gov.cz/en/foreign-trade/economic-migration/digital-nomad-program--275799/",
        },
      ],
    },
    socialSecurity: {
      euCoordination: true,
      usTotalization: true,
      usTotalizationYear: 2009,
      note: "EU Member State, so Reg. 883/2004 and the A1 posting rule (up to 24 months) apply. You are normally insured where you work. Czechia signed the 2023 cross-border telework framework (in force 1 Jul 2023). US-Czech agreement entered into force 1 Jan 2009.",
      sources: [
        {
          label: "SSA POMS GN 01701.005 - totalization agreement list with dates",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
        {
          label: "Your Europe - posted workers (A1, 24 months)",
          url: "https://europa.eu/youreurope/citizens/work/work-abroad/posted-workers/index_en.htm",
        },
        {
          label: "Your Europe - social security coverage rules",
          url: "https://europa.eu/youreurope/citizens/work/social-security-and-benefits/country-coverage/index_en.htm",
        },
        {
          label: "Belgian FPS Social Security (depositary) - telework framework signatory list",
          url: "https://socialsecurity.belgium.be/en/internationally-active/cross-border-telework-eu-eea-and-switzerland",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "The portal's 'cannot be employed or do business' wording does not mention remote work, so applying it to remote work for a foreign employer is an inference.",
      "The programme document gives the income test as a multiple of the average gross annual salary, with no euro figure. The current CZK figure was not found.",
      "Eligible nationalities and sectors are narrow and may change; the ministry page is dated 1 Jul 2025.",
      "The SSA overview page and EUR-Lex were not directly readable.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "EE",
    country: "Estonia",
    visitorWork: {
      status: "unclear",
      summary:
        "No official page that could be read says whether a visa-free visitor may work remotely for a foreign employer. Official sources describe a teleworking D-visa for such work; the Aliens Act text itself was inaccessible.",
      sources: [
        {
          label: "PPA - Long-term visa (teleworking conditions)",
          url: "https://www.politsei.ee/en/instructions/visa-and-extending-period-of-stay/long-term-visa",
        },
        {
          label: "Ministry of the Interior, 10 June 2020 - digital nomad visa announcement",
          url: "https://www.siseministeerium.ee/en/news/estonia-be-one-first-countries-world-create-digital-nomad-visa",
        },
        {
          label: "PPA - Working in Estonia (short-term employment registration, for employers)",
          url: "https://www.politsei.ee/en/instructions/working-in-estonia/for-employers",
        },
      ],
    },
    remoteRoute: {
      name: "Long-stay (D) visa for teleworking (digital nomad visa)",
      conditions:
        "D-visa up to 12 months (365 days of stay per 12 months); must work for a foreign employer, own foreign company or mainly foreign customers. The foreign ministry table lists funds of 132 EUR/day (3,960/month); the police and border guard asks for six months' income proof.",
      sources: [
        {
          label: "PPA - Long-term visa",
          url: "https://www.politsei.ee/en/instructions/visa-and-extending-period-of-stay/long-term-visa",
        },
        {
          label: "Ministry of Foreign Affairs - Application for a long-stay (D) visa",
          url: "https://vm.ee/en/consular-visa-and-travel-information/visa-information/application-long-stay-d-visa",
        },
      ],
    },
    socialSecurity: {
      euCoordination: true,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Reg 883/2004 applies. General rule: covered by the state where you work (Art 11(3)(a)); employer-posted workers stay under the sending state up to 24 months (Art 12), shown by A1. A1 for self-initiated remote work not established.",
      sources: [
        {
          label: "Regulation (EC) 883/2004, Arts 2, 11(3)(a), 12(1)",
          url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32004R0883",
        },
        {
          label: "European Commission - EU social security coordination (countries covered)",
          url: "https://employment-social-affairs.ec.europa.eu/node/76_en",
        },
        {
          label: "SSA POMS GN 01701.005 - totalization agreements in force (Estonia not listed)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "Whether a visa-free visitor may lawfully telework for a foreign employer: the Aliens Act text was not readable; a search summary said teleworking-visa holders are exempt from short-term employment registration, but this could not be verified.",
      "Income threshold: the foreign ministry page lists 3,960 EUR/month; the police page gives no figure; third-party sites cite 3,500-4,500 EUR. Needs confirmation.",
      "Whether the multilateral telework social security framework agreement was extended, and whether an A1 is available for self-initiated remote work.",
      "The SSA overview page returned an error; the SSA POMS table was used instead.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "GE",
    country: "Georgia",
    visitorWork: {
      status: "conditional",
      summary:
        "The Labour Migration Law Art 1(4)(k) excludes work or services for a non-resident, tied to activities outside Georgia, from the right-to-work regime; remote work for a local employer needs a right to work (from 1 March 2026).",
      sources: [
        {
          label: "Law of Georgia on Labour Migration (consolidated, Matsne) - Art 1(4)(j),(k)",
          url: "https://matsne.gov.ge/en/document/view/2806732",
        },
        {
          label:
            "Law on the Legal Status of Aliens (Matsne) - Art 10 (visa-free 90/180, up to one year for listed countries), Art 29",
          url: "https://matsne.gov.ge/en/document/view/2278806",
        },
        {
          label: "Georgian MFA - New rules for employed/self-employed aliens from 1 March 2026",
          url: "https://norway.mfa.gov.ge/en/news/929284-new-rules-for-the-employed-self-employed-aliens-with-no-permit-for-permanent-residence-in-georgia-sh",
        },
      ],
    },
    remoteRoute: {
      name: "C5 category ordinary (short-term) visa for remote work for non-resident persons (Aliens Law, Art 7)",
      conditions:
        "Multiple-entry, up to 5 years validity, stay up to 1 year; holder may act only for non-resident persons on activities outside Georgia. Refusal on immigration-policy grounds is unappealable. The law states no income threshold; implementing rules were not found.",
      sources: [
        {
          label: "Law on the Legal Status of Aliens (Matsne) - Art 6(7^1), Art 7(c.e), Art 11(3^2)",
          url: "https://matsne.gov.ge/en/document/view/2278806",
        },
        {
          label: "Parliament of Georgia, 15 April 2026 - C5 visa adopted at third reading",
          url: "https://parliament.ge/en/media/news/parlamentma-akhali-c5-kategoriis-ordinaluri-vizis-datsesebis-sakitkhs-mkhari-dauchira",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Outside Reg 883/2004; no US agreement. No official Georgian statement was found on social security for a temporary remote worker paid by a foreign employer.",
      sources: [
        {
          label: "European Commission - EU social security coordination (countries covered)",
          url: "https://employment-social-affairs.ec.europa.eu/node/76_en",
        },
        {
          label: "SSA POMS GN 01701.005 (Georgia not listed)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "Government ordinances (visa-free country list and durations, short-term professional activities, C5 procedure, fee, documents, eligible nationalities) were not retrieved.",
      "The Ministry of Labour FAQ returned an error, so official guidance on foreign-employer remote work could not be confirmed.",
      "The statutory conclusion rests on the Matsne consolidated texts, which show amendments through 25 June 2026; later changes are not reflected.",
      "Georgian tax residency (183 days) was not checked against the revenue service.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "GR",
    country: "Greece",
    visitorWork: {
      status: "unclear",
      summary:
        "No official Greek source found that states whether a visa-free or short-stay visitor may work remotely for a foreign employer. Law 5038/2023 art. 68 creates a dedicated digital nomad route, but does not address visitors.",
      sources: [],
    },
    remoteRoute: {
      name: "Digital Nomad national visa, then digital nomad residence permit (Law 5038/2023, art. 68)",
      conditions:
        "Remote work for employers or clients outside Greece; sworn statement of no work for a Greek-based employer. Net income 3,500 EUR/month (+20% spouse, +15% per child) per the law text as reproduced on a private legal database. Visa up to 12 months, then 2-year permit.",
      sources: [
        {
          label:
            "Law 5038/2023 art. 68 as reproduced by taxheaven.gr (private legal database, not the official gazette)",
          url: "https://www.taxheaven.gr/law/5038/2023/arthro/68",
        },
      ],
    },
    socialSecurity: {
      euCoordination: true,
      usTotalization: true,
      usTotalizationYear: 1994,
      note: "EU Member State, so Reg. 883/2004 and the A1 posting rule (up to 24 months) apply. You are normally insured where you work. Greece is not a signatory to the 2023 cross-border telework framework agreement. US-Greece agreement entered into force 1 Sep 1994.",
      sources: [
        {
          label: "SSA POMS GN 01701.005 - totalization agreement list with dates",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
        {
          label: "Your Europe - posted workers (A1, 24 months)",
          url: "https://europa.eu/youreurope/citizens/work/work-abroad/posted-workers/index_en.htm",
        },
        {
          label: "Your Europe - social security coverage rules",
          url: "https://europa.eu/youreurope/citizens/work/social-security-and-benefits/country-coverage/index_en.htm",
        },
        {
          label:
            "Belgian FPS Social Security (depositary) - telework framework signatory list (Greece not listed)",
          url: "https://socialsecurity.belgium.be/en/internationally-active/cross-border-telework-eu-eea-and-switzerland",
        },
      ],
    },
    confidence: "low",
    openQuestions: [
      "Greek official pages (the foreign ministry and parliament sites) could not be opened. The 3,500 EUR and duration figures come from a private legal database, not an official site.",
      "Secondary sources claim a February 2026 change (Law 5275/2026) ending in-country conversion from visa-free entry. This could not be verified from an official source.",
      "Nothing official found on visitors working remotely for foreign clients.",
      "The permit code for the extension is inconsistent across sources and was not resolved.",
      "The SSA overview page and EUR-Lex were not directly readable.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "HU",
    country: "Hungary",
    visitorWork: {
      status: "grey_area",
      summary:
        "Official guidance says visa-exempt nationals may work only with the required Hungarian work permit. The extra bilateral-agreement stay (e.g. for US citizens) cannot be used for gainful activity. Remote work for a foreign employer is not addressed.",
      sources: [
        {
          label:
            "OIF - Information for employers on short-term employment of third-country nationals (edited 2026-03-03)",
          url: "https://oif.gov.hu/factsheets/information-for-employers-regarding-the-short-term-employment-of-third-country-nationals-in-hungary",
        },
        {
          label:
            "OIF - Information notice for persons entitled to a visa-free stay (edited 2026-03-08)",
          url: "https://oif.gov.hu/factsheets/information-notice-for-persons-entitled-to-a-visa-free-stay",
        },
      ],
    },
    remoteRoute: {
      name: "White Card (residence permit for remote work from Hungary)",
      conditions:
        "Verified employment abroad (or a share in a profitable foreign company); no gainful activity in Hungary. Income of at least 3,000 EUR net/month for 6 months before entry. Valid up to 1 year, extendable once for 1 year. No family reunification.",
      sources: [
        {
          label: "OIF - White Card factsheet (edited 2026-03-11)",
          url: "https://oif.gov.hu/factsheets/white-card-residency-for-digital-nomads",
        },
        {
          label: "Enter Hungary - White Card page (shows 2,000 EUR; conflicts with OIF)",
          url: "https://enterhungary.gov.hu/eh/tajekoztato/en/okmanyfeherkartya",
        },
      ],
    },
    socialSecurity: {
      euCoordination: true,
      usTotalization: true,
      usTotalizationYear: 2016,
      note: "EU Member State, so Reg. 883/2004 and the A1 posting rule (up to 24 months) apply. You are normally insured where you work. Hungary is not on the telework framework signatory list. US-Hungary agreement entered into force 1 Sep 2016.",
      sources: [
        {
          label: "SSA POMS GN 01701.005 - totalization agreement list with dates",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
        {
          label: "Your Europe - posted workers (A1, 24 months)",
          url: "https://europa.eu/youreurope/citizens/work/work-abroad/posted-workers/index_en.htm",
        },
        {
          label: "Your Europe - social security coverage rules",
          url: "https://europa.eu/youreurope/citizens/work/social-security-and-benefits/country-coverage/index_en.htm",
        },
        {
          label:
            "Belgian FPS Social Security (depositary) - telework framework signatory list (Hungary not listed)",
          url: "https://socialsecurity.belgium.be/en/internationally-active/cross-border-telework-eu-eea-and-switzerland",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "The OIF factsheet (3,000 EUR net) and the Enter Hungary page (2,000 EUR) conflict. OIF is shown because its page is more recently edited, but it is not confirmed which is current.",
      "No official text found that addresses remote work for a foreign employer by a visa-free visitor.",
      "The underlying statute (Act XC of 2023) was not read.",
      "The SSA overview page and EUR-Lex were not directly readable.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "ID",
    country: "Indonesia",
    visitorWork: {
      status: "grey_area",
      summary:
        "The official C1 tourist-visa page bars selling goods or services and taking payment from Indonesian parties; remote work for foreign employers is not mentioned. The Director-General of Immigration called remote work a regulatory problem under study (Aug 2026, press report).",
      sources: [
        {
          label: "Directorate General of Immigration, C1 tourist visa page",
          url: "https://imigrasi.go.id/wna/daftar-visa-indonesia/C1",
        },
        {
          label: "Republika, 13 Aug 2026, reporting the Director-General's remarks (press report)",
          url: "https://news.republika.co.id/berita/tjodpk7530000/imigrasi-kaji-aturan-baru-pajak-dan-visa-untuk-digital-nomad-di-bali",
        },
      ],
    },
    remoteRoute: {
      name: "E33G Remote Worker (Second Home) visa",
      conditions:
        "Bank record showing income of at least USD 60,000/yr; 3 months of statements showing at least USD 2,000; contract with a company established outside Indonesia. Stay up to 1 year, extendable online; visa must be used within 90 days of issue.",
      sources: [
        {
          label: "Directorate General of Immigration, E33G page",
          url: "https://imigrasi.go.id/wna/daftar-visa-indonesia/E33G",
        },
        {
          label: "Indonesia.travel (Ministry of Tourism), visas page",
          url: "https://www.indonesia.travel/id/en/general-information/visas",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Indonesia is not on SSA's agreement list. Absent an agreement, US and local coverage can both apply. Reported BPJS participation for foreigners working 6+ months was not verified at an official source.",
      sources: [
        {
          label: "SSA POMS GN 01701.005, list of totalization agreements (Indonesia not listed)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "The Visa on Arrival page returned no content. Only the C1 page was read.",
      "Press reports of a 2026 Bali crackdown treating remote work for overseas clients as work were not traced to an official statement.",
      "Maximum total stay and renewal on the E33G is unclear: the official page says online extension is possible, while secondary sources conflict on a second year.",
      "BPJS (Law 24/2011) and tax residency effects of the E33G were not verified at official sources.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "MY",
    country: "Malaysia",
    visitorWork: {
      status: "grey_area",
      summary:
        "The Immigration Department lists working or doing activities contrary to pass conditions as an offence. A September 2026 press report quotes its Director-General that social visit pass holders may not be employed or run a business. Remote work for foreign clients is not addressed.",
      sources: [
        {
          label:
            "Malaysian Immigration Dept, Enforcement page (lists working or doing activities contrary to pass conditions as an offence)",
          url: "https://www.imi.gov.my/?p=1762",
        },
        {
          label:
            "The Star, 19 Sep 2026, reporting the Immigration Director-General's statement (press report, not an official portal)",
          url: "https://www.thestar.com.my/news/nation/2026/09/19/fine-jail-deportation-for-foreigners-working-on-social-visit-pass",
        },
        {
          label:
            "MDEC DE Rantau FAQ v10, Q17: conversion from a tourist pass to DE Rantau is not permitted",
          url: "https://www.mdec.my/api/media/file/DE-Rantau_Pass_FAQ_v10.pdf",
        },
      ],
    },
    remoteRoute: {
      name: "DE Rantau Nomad Pass (Professional Visit Pass)",
      conditions:
        "Tech roles: at least USD 24,000/yr; non-tech: USD 60,000/yr. Employed by a foreign firm not registered in Malaysia, or freelancing for foreign clients. 3-12 months, renewable once for 12 (24 max). Peninsular Malaysia and Labuan only.",
      sources: [
        {
          label: "MDEC DE Rantau Pass FAQ v10.0 (28 Aug 2026)",
          url: "https://www.mdec.my/api/media/file/DE-Rantau_Pass_FAQ_v10.pdf",
        },
        { label: "MDEC DE Rantau programme page", url: "https://mdec.my/derantau" },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Malaysia is not on SSA's agreement list. Absent an agreement, US and local coverage can both apply. EPF contributions reportedly became mandatory for many foreign employees in Oct 2025; whether that reaches pass holders paid from abroad is unverified.",
      sources: [
        {
          label: "SSA POMS GN 01701.005, list of totalization agreements (Malaysia not listed)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "The Director-General's statement is known only from a press report; the original release and the regulation text were not found.",
      "That statement concerns employment and business generally and does not mention remote work for foreign employers, which is why the position is shown as unclear in law rather than as a ban.",
      "EPF's mandatory foreign-employee scheme was seen only in law-firm summaries because the EPF site returned an error.",
      "Those summaries list Professional Visit Pass holders as covered, which would include DE Rantau. This is unverified, and so is how it applies to someone paid by a foreign employer.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "MU",
    country: "Mauritius",
    visitorWork: {
      status: "grey_area",
      summary:
        "The Labour Ministry says tourist-visa visitors may not take up employment. The Non-Citizens Act bars occupation for reward or profit in Mauritius without a permit. Neither addresses remote work for a foreign employer. The Premium Visa is aimed at remote workers.",
      sources: [
        {
          label: "Non-Citizens (Employment Restriction) Act, s3 (DHA copy)",
          url: "https://dha.govmu.org/Documents/Legislations/non-citizens-employment-restriction-act-08.02.2024.pdf",
        },
        {
          label: "Ministry of Labour, work permit guidelines (tourist visa holders)",
          url: "https://empment-labour.govmu.org/Documents/Guidelines%20for%20Work%20Permit%20Application%20June%202016_V1.pdf",
        },
      ],
    },
    remoteRoute: {
      name: "Premium Visa (Economic Development Board)",
      conditions:
        "Over 6 months up to 1 year, renewable. Funds of USD 1,500 a month per adult and USD 500 per dependent child. Income source outside Mauritius, no entry into the Mauritian labour market, health insurance. Free of charge.",
      sources: [
        {
          label: "EDB Premium Visa FAQ (Dec 2023 upload)",
          url: "https://edbmauritius.org/wp-content/uploads/2023/12/FAQs-Premium-Visa.pdf",
        },
        {
          label: "Passport and Immigration Office, Premium Visa page",
          url: "https://passport.govmu.org/passport/?page_id=595",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Mauritius is not on SSA's in-force list. Absent an agreement, dual coverage is possible. The EDB FAQ gives only income-tax treatment for Premium Visa holders; social contribution duties were not established.",
      sources: [
        {
          label: "SSA POMS GN 01701.005, agreements in force",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
        {
          label: "EDB Premium Visa FAQ (taxation section)",
          url: "https://edbmauritius.org/wp-content/uploads/2023/12/FAQs-Premium-Visa.pdf",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "The Labour Ministry guideline dates from 2016 and the FAQ was uploaded in Dec 2023; current EDB thresholds not re-confirmed.",
      "No official statement on short-stay remote work by tourists.",
      "Permitted length of visa-exempt stay not confirmed from an official page.",
      "Mauritian social-security contribution rules not checked.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "MX",
    country: "Mexico",
    visitorWork: {
      status: "grey_area",
      summary:
        "Visitor status (up to 180 days) gives no permission for activities subject to remuneration in the country. The law does not say whether remote work paid from abroad counts. The consulate says temporary residents may work only if paid from abroad.",
      sources: [
        {
          label:
            "Ley de Migración, Art. 52 fr. I (Chamber of Deputies; text seen only via search extract, page unreachable)",
          url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LMigra.pdf",
        },
        {
          label: "SRE consulate Houston: visa categories and work with foreign-paid salary",
          url: "https://consulmex.sre.gob.mx/houston/index.php/visas/visas/18-visas",
        },
      ],
    },
    remoteRoute: {
      name: "Residente temporal (temporary resident) by economic solvency; no dedicated nomad visa found",
      conditions:
        "More than 180 days, under 4 years. Washington consulate 2025 sheet: 12-month balance of MXN 1,394,000 or MXN 83,640 monthly income for 6 months. Amounts vary by consulate.",
      sources: [
        {
          label: "Mexican consulate Washington, Residente Temporal 2025 requirements sheet",
          url: "https://consulmex.sre.gob.mx/washington/images/2025/visas/esp/RESIDENTE_TEMPORAL_2025.pdf",
        },
        {
          label: "SRE consulate Houston visa page",
          url: "https://consulmex.sre.gob.mx/houston/index.php/visas/visas/18-visas",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Not among the 31 US agreements in force on SSA's POMS list. Without an agreement dual coverage is possible, since agreements exist to prevent paying into both systems. Mexican contribution duty for short stays not verified.",
      sources: [
        {
          label: "SSA POMS GN 01701.005, agreements in force",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "Could not open the Ley de Migración text directly; Art. 52 wording seen only in a search excerpt of Chamber of Deputies material.",
      "No official statement found on remote work for a foreign employer by a visitor.",
      "INM site and several consulate pages blocked by bot checks; solvency amounts differ by consulate.",
      "Mexico-US agreement said to be signed 2004 but not in force; the source was an SSA appendix that could not be opened.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "PL",
    country: "Poland",
    visitorWork: {
      status: "grey_area",
      summary:
        "The 2025 foreigners-employment act (art. 1(4)(5)) excludes only occasional, incidental activities for a foreign entity by a foreigner staying for another purpose. It is silent on regular remote work for a foreign employer. The permit requirement attaches to work performed in Poland.",
      sources: [
        {
          label: "Dz.U. 2025 poz. 621 - Act of 20 March 2025, art. 1 ust. 4 pkt 5 (PDF)",
          url: "https://dziennikustaw.gov.pl/D2025000062101.pdf",
        },
        {
          label:
            "Zielona Linia (government info line) - remote work by foreigners, status as of 1 Oct 2021 under the repealed law",
          url: "https://zielonalinia.gov.pl/praca-zdalna-swiadczona-przez-cudzoziemca/",
        },
      ],
    },
    remoteRoute: {
      name: null,
      conditions: null,
      sources: [],
    },
    socialSecurity: {
      euCoordination: true,
      usTotalization: true,
      usTotalizationYear: 2009,
      note: "EU Member State, so Reg. 883/2004 and the A1 posting rule (up to 24 months) apply. You are normally insured where you work. Poland signed the 2023 cross-border telework framework (in force 1 Jul 2023), which applies to residents. US-Poland agreement entered into force 1 Mar 2009.",
      sources: [
        {
          label: "SSA POMS GN 01701.005 - totalization agreement list with dates",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
        {
          label: "Your Europe - posted workers (A1, 24 months)",
          url: "https://europa.eu/youreurope/citizens/work/work-abroad/posted-workers/index_en.htm",
        },
        {
          label: "Your Europe - social security coverage rules",
          url: "https://europa.eu/youreurope/citizens/work/social-security-and-benefits/country-coverage/index_en.htm",
        },
        {
          label: "Belgian FPS Social Security (depositary) - telework framework signatory list",
          url: "https://socialsecurity.belgium.be/en/internationally-active/cross-border-telework-eu-eea-and-switzerland",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "No official statement found on how authorities treat regular remote work for a foreign employer by a visa-free visitor.",
      "It could not be confirmed from an official source that Poland has no digital nomad visa; non-official sources say it has none.",
      "The government info line's remote-work page dates from 2021 and describes the repealed law.",
      "The SSA overview page and EUR-Lex were not directly readable.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "PT",
    country: "Portugal",
    visitorWork: {
      status: "unclear",
      summary:
        "No official page found that states whether remote work for a foreign employer is allowed on a visa-free or short-stay visit. The visa portal treats remote work as its own D-category visa, but that is not an explicit rule for visitors.",
      sources: [
        {
          label: "Vistos MNE - Residency visa documentation (remote work/digital nomads section)",
          url: "https://vistos.mne.gov.pt/en/national-visas/necessary-documentation/residency",
        },
        {
          label:
            "Vistos MNE - Type of visa (lists remote work as a national visa purpose; silent on visitors)",
          url: "https://vistos.mne.gov.pt/en/national-visas/general-information/type-of-visa",
        },
      ],
    },
    remoteRoute: {
      name: 'Temporary stay visa or residency visa for remote professional activity ("digital nomads", commonly called D8)',
      conditions:
        "Proof of average monthly income over the last 3 months of at least 4x the monthly minimum guaranteed remuneration; employment or service contract; proof of tax residence. Residency visa: 2 entries, 4 months, then apply to AIMA. Temporary stay visa duration not stated. Euro amount not stated on the page.",
      sources: [
        {
          label: "Vistos MNE - Temporary stay (digital nomads section)",
          url: "https://vistos.mne.gov.pt/en/national-visas/necessary-documentation/temporary-stay",
        },
        {
          label: "Vistos MNE - Residency (digital nomads section)",
          url: "https://vistos.mne.gov.pt/en/national-visas/necessary-documentation/residency",
        },
      ],
    },
    socialSecurity: {
      euCoordination: true,
      usTotalization: true,
      usTotalizationYear: 1989,
      note: "EU Member State, so Reg. 883/2004 applies and an A1 can cover a posting from another EU state of up to 24 months. The general rule is that you are insured where you work, with posting as the exception. US-Portugal agreement entered into force 1 Aug 1989.",
      sources: [
        {
          label: "SSA POMS GN 01701.005 - totalization agreement list with dates",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
        {
          label: "Your Europe - posted workers (A1, 24 months)",
          url: "https://europa.eu/youreurope/citizens/work/work-abroad/posted-workers/index_en.htm",
        },
        {
          label: "Your Europe - social security coverage rules",
          url: "https://europa.eu/youreurope/citizens/work/social-security-and-benefits/country-coverage/index_en.htm",
        },
        {
          label:
            "Belgian FPS Social Security (depositary) - telework framework signatories; Portugal in force 1 Jul 2023",
          url: "https://socialsecurity.belgium.be/en/internationally-active/cross-border-telework-eu-eea-and-switzerland",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "No official text found on what a visa-free or short-stay visitor may do regarding remote work (Lei 23/2007 consolidated text could not be read).",
      "The portal states the threshold as 4x the monthly minimum guaranteed remuneration, with no euro figure; the current euro amount is not confirmed.",
      "Temporary stay visa duration not stated on the portal pages.",
      "The SSA overview page and EUR-Lex were not directly readable. The detached-worker rule under the US agreement was not verified.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "RS",
    country: "Serbia",
    visitorWork: {
      status: "grey_area",
      summary:
        "The official portal lets visa-free visitors work up to 90/180 days without a single permit only in listed categories (business contacts, owners, events); remote work for a foreign employer is not listed and no official page addresses it.",
      sources: [
        {
          label: "Welcome to Serbia - Residence and work permit",
          url: "https://welcometoserbia.gov.rs/residence-and-work-permit",
        },
        {
          label: "Welcome to Serbia - Income taxes (digital nomads / foreign payer)",
          url: "https://welcometoserbia.gov.rs/income-taxes",
        },
      ],
    },
    remoteRoute: {
      name: "Temporary residence on the 'digital nomad' basis (Law on Foreigners Art 40(4); listed on the Welcome to Serbia portal)",
      conditions:
        "The law lets the Government set criteria; the portal lists the basis but states no income, duration or documents on the pages that could be opened. General rule: temporary residence up to 3 years per request.",
      sources: [
        {
          label: "Welcome to Serbia - Temporary residence (grounds list, up to 3 years)",
          url: "https://welcometoserbia.gov.rs/temporary-residence-international-agreements",
        },
        {
          label: "Welcome to Serbia - Digital nomads in Serbia (no criteria given)",
          url: "https://welcometoserbia.gov.rs/digital-nomads-in-serbia",
        },
        {
          label:
            "Law on Foreigners, consolidated text (Paragraf, a commercial reproduction of the Official Gazette) - Art 40(4)",
          url: "https://www.paragraf.rs/propisi/zakon_o_strancima.html",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Outside Reg 883/2004; no US agreement. The portal says non-resident nomads paid from abroad self-calculate and pay quarterly tax plus pension, disability and health contributions; for referred workers, unless an international agreement provides otherwise.",
      sources: [
        {
          label: "Welcome to Serbia - Income taxes",
          url: "https://welcometoserbia.gov.rs/income-taxes",
        },
        {
          label: "European Commission - EU social security coordination (countries covered)",
          url: "https://employment-social-affairs.ec.europa.eu/node/76_en",
        },
        {
          label: "SSA POMS GN 01701.005 (Serbia not listed)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "low",
    openQuestions: [
      "No Government act with digital nomad criteria (income, duration, work rights) was found. Third-party claims of a 3,500 EUR threshold are unverified.",
      "Whether a visa-free visitor doing remote work for a foreign employer needs a permit: not stated officially.",
      "Law on Foreigners article numbering comes from a commercial reproduction, not the Official Gazette PDF.",
      "Any bilateral social security agreements between Serbia and the traveller's home state were not checked.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "ZA",
    country: "South Africa",
    visitorWork: {
      status: "grey_area",
      summary:
        "The Immigration Act bars visitor's-visa holders from conducting work, defined as business, commercial or remunerative activity in the Republic. Nothing official says whether remote work for a foreign employer counts. The home affairs department created a Remote Work visa for it.",
      sources: [
        {
          label: "Immigration Act 13 of 2002, consolidated by DHA, s11(1)-(2)",
          url: "https://www.dha.gov.za/images/PDFs/IMMIGRATION-ACT-2002---UPDATED-2015.pdf",
        },
        {
          label: "Immigration Act as enacted, definition of work (s1)",
          url: "https://www.treasury.gov.za/legislation/acts/2002/act13-02.pdf",
        },
        {
          label: "DHA Remote Work visitor's visa checklist",
          url: "https://www.dha.gov.za/images/notices/8october24/Remote_Work_Visa_-_requirements_-_9_Oct_2024.pdf",
        },
      ],
    },
    remoteRoute: {
      name: "Remote Work visitor's visa (s11(1)(b)(iv), prescribed activity of remote work)",
      conditions:
        "Over 3 months up to 3 years. Gross salary of at least R650,796 a year, shown by 3 months of bank statements. Contract with a foreign employer. SARS registration: always for non-treaty residents; treaty residents after 183 days in 12 months. No local employment.",
      sources: [
        {
          label: "DHA Remote Work visa checklist, effective 9 Oct 2024",
          url: "https://www.dha.gov.za/images/notices/8october24/Remote_Work_Visa_-_requirements_-_9_Oct_2024.pdf",
        },
        {
          label: "SAnews, gazetting announcement, 9 Oct 2024",
          url: "https://www.sanews.gov.za/south-africa/department-announces-gazetting-remote-work-visitor-visa",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "South Africa is not on SSA's in-force list. Absent an agreement, dual coverage is possible. Whether South African social contributions apply to a short-stay foreign-employer remote worker was not established.",
      sources: [
        {
          label: "SSA POMS GN 01701.005, agreements in force",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "The Act text read is the 2015 consolidated version; the definition of work was read only in the 2002 as-enacted text.",
      "Whether the R650,796 threshold or checklist changed after Oct 2024 not verified.",
      "SARS source-of-income guidance was not retrievable (PDF unreadable).",
      "UIF/SDL treatment for short-stay remote workers not checked.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "KR",
    country: "South Korea",
    visitorWork: {
      status: "grey_area",
      summary:
        "The foreign ministry states a C-3 short-term visa cannot be issued for profit-making, while allowing market research, business contact and contracts. Visa-free entry and remote work for foreign employers are not specifically addressed; the workation visa exists for this.",
      sources: [
        {
          label: "MOFA (overseas missions), short-term visit C-3 guidance",
          url: "https://overseas.mofa.go.kr/fi-en/brd/m_20979/view.do?seq=1",
        },
        {
          label:
            "Immigration Act, KLRI English translation (table of contents only; Art. 17-20 titles read, text not)",
          url: "https://elaw.klri.re.kr/eng_service/lawViewTitle.do?hseq=33079",
        },
      ],
    },
    remoteRoute: {
      name: "Digital Nomad (Workation) visa, F-1-D",
      conditions:
        "Permanent from 30 Jun 2026. Income tiers of 1x, 1.5x or 2x the 2025 GNI per capita (KRW 52.41m), set by age and Seoul-area residence; foreign employer; age 18+; stay up to 3 years. Korean employment and profit-making activity restricted (2024 notice).",
      sources: [
        {
          label:
            "Ministry of Justice / Immigration Service release, 7 Jul 2026 (PDF; income tiers and GNI figures read, Korean text garbled)",
          url: "https://www.immigration.go.kr/bbs/immigration/214/496883/download.do",
        },
        {
          label:
            "Immigration Service workation visa notice, 22 Feb 2024 (pilot terms: foreign company, 1+ year experience, KRW 100m insurance, profit-making restricted)",
          url: "https://immigration.go.kr/bbs/immigration/47/580178/artclView.do",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: true,
      usTotalizationYear: 2001,
      note: "US-Korea agreement in force 1 Apr 2001. A worker sent abroad by an employer to the same or an affiliated employer, for up to 5 years, stays under the sending country's system only, with a certificate of coverage. A self-directed remote worker may not fit this rule (not verified).",
      sources: [
        {
          label:
            "SSA POMS GN 01701.005, list of totalization agreements (Korea (South): April 1, 2001)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
        {
          label: "SSA POMS GN 01741.001, US-Korea agreement overview and effective date",
          url: "https://secure.ssa.gov/apps10/poms.nsf/lnx/0201741001",
        },
        {
          label: "SSA POMS RS 02001.965, detached worker rule under the Korea agreement",
          url: "https://secure.ssa.gov/POMS.NSF/lnx/0302001965",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "The 2026 Ministry of Justice PDF text was garbled, so the 2026 insurance and experience wording could not be read. The insurance and experience terms given are the 2024 pilot terms.",
      "The Immigration Act text of Art. 20 (activities outside status) and the penalty articles was not read.",
      "The MOFA page covers the C-3 visa; no official page was found on activity limits for visa-free entrants.",
      "Whether the US-Korea agreement's rules fit a remote worker employed by a non-US employer was not verified.",
      "The stay-period structure within the 3-year maximum is read from tables in the garbled PDF and should be confirmed.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "ES",
    country: "Spain",
    visitorWork: {
      status: "grey_area",
      summary:
        "Organic Law 4/2000 art. 36 requires authorisation to reside and work before any lucrative, labour or professional activity. It does not address a visitor working remotely for a foreign employer. The 2022 remote-work regime implies a dedicated route is needed.",
      sources: [
        {
          label:
            "BOE - Ley Organica 4/2000, art. 36 (authorisation required for any lucrative activity)",
          url: "https://www.boe.es/buscar/act.php?id=BOE-A-2000-544",
        },
        {
          label:
            "BOE - Ley 28/2022, disposicion final quinta (new arts. 74 bis-quinquies of Ley 14/2013)",
          url: "https://www.boe.es/buscar/act.php?id=BOE-A-2022-21739",
        },
      ],
    },
    remoteRoute: {
      name: "Visado / autorizacion de residencia de teletrabajo de caracter internacional (international remote-work visa)",
      conditions:
        "Work only for non-Spanish companies, or Spanish work no more than 20% of activity. Degree or 3 years' experience; 3 months' relationship with the employer; company active 1+ year. Visa up to 1 year; permit up to 3 years, renewable in 2-year periods. Income 200% of the minimum wage (SMI); the current euro figure is not confirmed.",
      sources: [
        {
          label: "BOE - Ley 28/2022 (arts. 74 bis to 74 quinquies)",
          url: "https://www.boe.es/buscar/act.php?id=BOE-A-2022-21739",
        },
        {
          label: "Spanish Consulate General Bahia Blanca - teletrabajo visa requirements (PDF)",
          url: "https://www.exteriores.gob.es/Consulados/bahiablanca/es/Comunicacion/Noticias/PublishingImages/Paginas/VISADO-DE-TELETRABAJO/Instr.Visado%20de%20Teletrabajo.pdf",
        },
        {
          label: "Spanish Embassy Singapore - Digital Nomad Visa page",
          url: "https://www.exteriores.gob.es/Embajadas/singapur/en/ServiciosConsulares/Paginas/Consular/Digital-Nomad-Visa.aspx",
        },
      ],
    },
    socialSecurity: {
      euCoordination: true,
      usTotalization: true,
      usTotalizationYear: 1988,
      note: "EU Member State, so Reg. 883/2004 and the A1 posting rule (up to 24 months) apply. You are normally insured where you work. The consulate sheet requires a declaration of social security compliance. US-Spain agreement entered into force 1 Apr 1988.",
      sources: [
        {
          label: "SSA POMS GN 01701.005 - totalization agreement list with dates",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
        {
          label: "Your Europe - posted workers (A1, 24 months)",
          url: "https://europa.eu/youreurope/citizens/work/work-abroad/posted-workers/index_en.htm",
        },
        {
          label: "Your Europe - social security coverage rules",
          url: "https://europa.eu/youreurope/citizens/work/social-security-and-benefits/country-coverage/index_en.htm",
        },
        {
          label:
            "Spanish Consulate Bahia Blanca - teletrabajo visa sheet (social security declaration)",
          url: "https://www.exteriores.gob.es/Consulados/bahiablanca/es/Comunicacion/Noticias/PublishingImages/Paginas/VISADO-DE-TELETRABAJO/Instr.Visado%20de%20Teletrabajo.pdf",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "No official Spanish source found that directly says whether a tourist or visa-free visitor may work remotely for a foreign employer. The grey-area position is a reading of art. 36 together with art. 74 bis.",
      "The current SMI-based euro threshold was not confirmed; a consulate sheet shows an older figure.",
      "The Ministry of Inclusion pages were not reachable, so consulate sheets stand in for them.",
      "The SSA overview page and EUR-Lex were not directly readable.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "TW",
    country: "Taiwan",
    visitorWork: {
      status: "grey_area",
      summary:
        "Visa-exempt entry covers tourism and business activities; anything needing a permit under other agencies' rules still requires one. Employment Service Act Art. 43 requires a permit for foreigners to work. Remote work for foreign employers is not addressed.",
      sources: [
        {
          label: "Bureau of Consular Affairs, Visa-Exempt Entry",
          url: "https://www.boca.gov.tw/cp-149-4486-7785a-2.html",
        },
        {
          label: "Employment Service Act (MOJ Laws & Regulations Database), Art. 43 and Art. 68",
          url: "https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=N0090001",
        },
      ],
    },
    remoteRoute: {
      name: "Employment Gold Card (not remote-specific; combined open work permit, residence and visa)",
      conditions:
        "Salary route: NT$160,000/month in eligible fields only (other qualification routes exist by field). Validity 1, 2 or 3 years at the applicant's choice; extension can be requested within 4 months before expiry.",
      sources: [
        {
          label: "Gold Card application qualifications (official)",
          url: "https://goldcard.nat.gov.tw/en/subtags/application-qualification",
        },
        {
          label: "Gold Card FAQ: validity (official)",
          url: "https://goldcard.nat.gov.tw/en/faq/how-long-is-a-gold-card-valid/",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Taiwan is not on SSA's agreement list. Absent an agreement, US and local coverage can both apply. Taiwan's labour insurance treatment of short-stay remote workers was not established from official sources.",
      sources: [
        {
          label: "SSA POMS GN 01701.005, list of totalization agreements (Taiwan not listed)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "No official statement was found on remote work for a foreign employer during a visa-exempt stay.",
      "Whether 'conducting business' under visa-exempt entry covers ongoing remote work for a foreign employer is untested.",
      "The Gold Card is a general work and residence permit, not a remote-worker visa. No Taiwan-specific remote-worker visa was found from official sources.",
      "Gold Card law changes effective 2026 and the current tax concessions were not verified here.",
      "Labour Insurance and National Health Insurance rules for short-stay visitors were not checked.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "TH",
    country: "Thailand",
    visitorWork: {
      status: "grey_area",
      summary:
        "The foreigners' working decree defines 'work' broadly (knowledge used in an occupation, paid or not) with no carve-out for work for a foreign employer. No official ruling on remote work for foreign clients was found.",
      sources: [
        {
          label:
            "Foreigners' Working Management Emergency Decree B.E. 2560, s.5 definition of 'work' (Council of State tentative translation, non-authoritative)",
          url: "https://asean.org/wp-content/uploads/2016/08/Foreigners%E2%80%99-Working-Management-Emergency-Decree-2017.pdf",
        },
      ],
    },
    remoteRoute: {
      name: "Destination Thailand Visa (DTV), Workcation track",
      conditions:
        "Bank statement showing at least THB 500,000, 6 months' salary slips, foreign employment contract or freelance portfolio, proof of 6 months' Thai accommodation. Up to 180 days per entry, 5-year validity, one 180-day extension (Swiss embassy page).",
      sources: [
        {
          label: "Thai MFA / Royal Thai Embassy Kuala Lumpur, DTV document checklist (PDF)",
          url: "https://image.mfa.go.th/mfa/0/n3gTFT2TOE/Visa_Requirements/Checklist_DTV.pdf",
        },
        {
          label:
            "Royal Thai Embassy Bern, DTV page (180 days per entry, 5-year validity, one extension)",
          url: "https://thaiembassy.ch/Content/Embassy/217.html",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Thailand is not on SSA's agreement list. Absent an agreement, US and local coverage can both apply. Whether Thai social security reaches a short-stay remote worker employed abroad was not established from official sources.",
      sources: [
        {
          label: "SSA POMS GN 01701.005, list of totalization agreements (Thailand not listed)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "No Thai Department of Employment or Immigration Bureau statement on remote work for a foreign employer was found.",
      "Thai embassy pages reportedly say no work without a permit on any visa, but they could not be opened and are not relied on here.",
      "The official source read does not state that DTV holders may not take Thai work permits or Thai clients. That claim appears only in secondary sources.",
      "DTV document rules are reported to have changed in 2026 and the fee varies by embassy. Neither is verified on the official e-Visa portal, which returned no content.",
      "Thai social security coverage of foreign-employed visitors was not checked against the Social Security Office, which was unreachable.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "TR",
    country: "Türkiye",
    visitorWork: {
      status: "not_permitted",
      summary:
        "Law 6735 Art 6(2) bans work in Türkiye without a work permit; Turkish consulate guidance says a would-be digital nomad must enter on a Digital Nomad visa. No official text expressly addresses visa-exempt remote work for foreign clients.",
      sources: [
        {
          label: "Law 6735 on International Labour Force (Art 2, Art 6) - mevzuat.gov.tr",
          url: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6735.pdf",
        },
        {
          label: "Law 6458 (Art 11: 90 days in 180) - mevzuat.gov.tr",
          url: "https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6458.pdf",
        },
        {
          label: "Turkish Consulate General Houston 2026 - Digital Nomad visa process",
          url: "https://houston-cg.mfa.gov.tr/Content/assets/consulate/images/localCache/1/ebc34ad1-dd9f-4248-9dc5-e52f24355a7c.pdf",
        },
      ],
    },
    remoteRoute: {
      name: "Digital Nomad Visa, with a Digital Nomad Identification Certificate from the GoTürkiye platform",
      conditions:
        "Consulate guidance: visa allows max 90 days; longer stay needs a residence permit from Migration Management. Reported requirements (USD 3,000/month, age 21-55, degree, contract with a non-Turkish firm) come from a search excerpt of a page that could not be opened.",
      sources: [
        {
          label:
            "Turkish Consulate General Miami - Digital Nomad visa procedure (90-day stay, residence permit via e-ikamet)",
          url: "https://miami-cg.mfa.gov.tr/Content/assets/consulate/images/localCache/1/e5c91fc7-4497-46cd-98d2-c3ce836d7677.pdf",
        },
        {
          label: "Turkish Consulate General Houston 2026",
          url: "https://houston-cg.mfa.gov.tr/Content/assets/consulate/images/localCache/1/ebc34ad1-dd9f-4248-9dc5-e52f24355a7c.pdf",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Outside Reg 883/2004; no US agreement. The ministry says foreign workers owe Law 5510 contributions; exemption under a bilateral agreement requires a valid work permit and posting by an employer in the partner country.",
      sources: [
        {
          label: "Ministry of Labour - Social security for foreign workers",
          url: "https://www.csgb.gov.tr/uigm/en/general-information/yabanci-calisanlarin-sosyal-guvenligi/",
        },
        {
          label:
            "Ministry of Labour - Countries with social security agreements (no US, Estonia or UAE)",
          url: "https://www.csgb.gov.tr/uigm/en/general-information/social-security-agreements/",
        },
        {
          label: "European Commission - EU social security coordination (countries covered)",
          url: "https://employment-social-affairs.ec.europa.eu/node/76_en",
        },
        {
          label: "SSA POMS GN 01701.005 (Türkiye not listed)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "Whether the work-permit ban reaches remote work for foreign clients by a visa-exempt visitor: no ministry statement found; the position rests on the statute plus consulate wording.",
      "The GoTürkiye pages could not be opened, so income, age and nationality criteria were not read first-hand. The Houston and Miami consulate PDFs differ on eligible countries, insurance minimum and funds.",
      "Duration and renewal of the short-term residence permit for nomads not established from an official page.",
      "Law text retrieved from the legislation site may not reflect the newest amendments.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "AE",
    country: "United Arab Emirates",
    visitorWork: {
      status: "not_permitted",
      summary:
        "The official u.ae portal states a visit or tourist visa does not give the right to work in the UAE, and a work permit from the labour ministry is required. It does not mention remote work for a foreign employer at all.",
      sources: [
        {
          label: "u.ae - Tips to avoid labour and visa fraud (updated 24 Sep 2026)",
          url: "https://u.ae/en/information-and-services/visa-and-emirates-id/Visa-information/tips-to-avoid-labour-and-visa-fraud",
        },
        {
          label: "u.ae - Work permits (updated 14 Oct 2026)",
          url: "https://u.ae/en/information-and-services/jobs/Sector-of-employment/employment-in-the-private-sector/work-permits",
        },
      ],
    },
    remoteRoute: {
      name: "Virtual work (remote work) residence visa for working outside the UAE",
      conditions:
        "Salary certificate of at least USD 3,500 (or equivalent); one-year visa, self-sponsored; health insurance, medical fitness test, proof of work outside the UAE; apply via ICP or GDRFA Dubai. u.ae page updated 7 Aug 2026.",
      sources: [
        {
          label: "u.ae - Residence visa for working outside the UAE",
          url: "https://u.ae/en/information-and-services/visa-and-emirates-id/Types-of-visas/Residence-visa/residence-visa-for-working-outside-the-uae",
        },
      ],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Outside Reg 883/2004; no US agreement. u.ae says non-GCC expatriates have no pension scheme (end-of-service gratuity instead); no rule was found for visitors working for foreign employers.",
      sources: [
        {
          label: "u.ae - Pension schemes for expatriate workers (updated 30 Dec 2024)",
          url: "https://u.ae/en/information-and-services/moving-to-the-uae/expatriates-working-in-the-uae/pension-schemes-for-expatriate-workers",
        },
        {
          label: "European Commission - EU social security coordination (countries covered)",
          url: "https://employment-social-affairs.ec.europa.eu/node/76_en",
        },
        {
          label: "SSA POMS GN 01701.005 (UAE not listed)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "medium",
    openQuestions: [
      "Whether the general no-work statement is applied to a visitor working remotely for a non-UAE employer: no official page addresses it either way.",
      "Search summaries mentioned a USD 5,000 threshold (2026 circular) and an AED 15,000 salary figure; neither was found on an official page. The u.ae page read says USD 3,500.",
      "The ICP service page failed to load; fees and bank-statement duration (3 vs 6 months) are unverified.",
      "Emirate-level differences (Dubai vs federal) were not compared.",
    ],
    verifiedOn: "2026-10-17",
  },
  {
    countryCode: "VN",
    country: "Vietnam",
    visitorWork: {
      status: "grey_area",
      summary:
        "Law 47/2014 requires work permits for foreigners coming to work (Art. 10(4)(c)) and activity in line with the purpose of entry (Art. 44(2)(b)). Remote work for foreign employers is not addressed in the texts found. Read via a commercial mirror, not the official portal.",
      sources: [
        {
          label:
            "Law 47/2014/QH13, English text (commercial mirror; articles 5, 8, 10, 12, 44 read here)",
          url: "https://english.luatvietnam.vn/law-no-47-2014-qh13-on-entry-exit-transit-and-residence-of-foreigners-in-vietnam-87925-doc1.html",
        },
      ],
    },
    remoteRoute: {
      name: null,
      conditions: null,
      sources: [],
    },
    socialSecurity: {
      euCoordination: false,
      usTotalization: false,
      usTotalizationYear: null,
      note: "Vietnam is not on SSA's agreement list. Absent an agreement, US and local coverage can both apply. Whether Vietnamese social insurance reaches a short-stay remote worker employed abroad was not established from official sources.",
      sources: [
        {
          label: "SSA POMS GN 01701.005, list of totalization agreements (Vietnam not listed)",
          url: "https://secure.ssa.gov/poms.nsf/lnx/0201701005",
        },
      ],
    },
    confidence: "low",
    openQuestions: [
      "The law text came from a commercial mirror of the 2014 original. The 2019 and 2023 amendments were not checked.",
      "No official remote-worker or digital-nomad visa was found. Only secondary guides say none exists in 2026, so this reflects 'not established', not a confirmed absence.",
      "The official e-visa portals gave no information on permitted activities, and one had a certificate error.",
      "The exemption for short-term experts under Decree 152/2020 was seen only in law-firm summaries and may not apply to remote work for foreign employers.",
      "Vietnamese social insurance rules for foreigners were not checked at official sources.",
    ],
    verifiedOn: "2026-10-17",
  },
];

export function workRightsFor(countryCode: string): WorkRightsEntry | null {
  const code = countryCode.toUpperCase();
  return WORK_RIGHTS.find((e) => e.countryCode === code) ?? null;
}
