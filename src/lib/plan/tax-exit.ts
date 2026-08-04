/**
 * NO PARTNER LINKS ON THIS PAGE, EVER. Not eSIM, not banking, not formation.
 * This is the page that proves the app is not selling anything, and it is read
 * by someone in the middle of the most consequential paperwork of the move. A
 * commercial link here would be worth more in commission and cost more in trust
 * than anything else in the product.
 *
 * Evidence, not advice — the same rule as the tax report. Describe the process
 * and the artefact it produces. Never tell anyone whether they have ceased
 * residence: that is a determination only their tax authority or adviser makes.
 */

export type TaxExitNote = {
  countryCode: string;
  country: string;
  /** Local name of the process, where one exists. */
  processName: string | null;
  summary: string;
  steps: string[];
  /** The document or record that evidences the exit. */
  evidence: string;
  timing: string;
  /** The thing people most often get wrong. */
  watchOut: string;
};

export const TAX_EXIT_NOTES: TaxExitNote[] = [
  {
    countryCode: "GB",
    country: "United Kingdom",
    processName: "Form P85 and the Statutory Residence Test",
    summary:
      "There is no deregistration in the UK. Residence is decided each tax year by the Statutory Residence Test, which counts days alongside ties such as accommodation, family and work. Filing a P85 tells HMRC you have left and starts the record.",
    steps: [
      "File form P85 after your last day of UK employment or once you have left, unless you already file a Self Assessment return.",
      "Work through the Statutory Residence Test for the year of departure, including the automatic overseas tests and the sufficient-ties test.",
      "Consider whether split-year treatment applies, which can divide the tax year into a UK part and an overseas part.",
      "Keep day counts and travel evidence for the whole year — the test is arithmetic on dates before it is anything else.",
    ],
    evidence: "The filed P85, HMRC's response, and your own day-count record for the tax year.",
    timing: "UK tax year runs 6 April to 5 April. Departure timing relative to that date changes the calculation.",
    watchOut:
      "Keeping a home available in the UK, or returning for more days than you expect, are the two ties that most often keep people resident.",
  },
  {
    countryCode: "DE",
    country: "Germany",
    processName: "Abmeldung",
    summary:
      "Germany ties unlimited tax liability primarily to having a home available to you. Deregistering your address at the Bürgeramt is the formal act, and giving up the dwelling is the substantive one.",
    steps: [
      "Book an Abmeldung appointment at the Bürgeramt and deregister your address, generally within two weeks of moving out.",
      "End the tenancy or otherwise give up any dwelling that stays available to you — an address kept 'just in case' is the usual problem.",
      "Notify the Finanzamt, health insurer, pension insurer and banks of the change.",
      "File a final German return for the year of departure.",
    ],
    evidence: "The Abmeldebescheinigung issued at deregistration.",
    timing: "Deregistration is normally done in the two weeks around the move.",
    watchOut:
      "Extended limited tax liability and exit taxation on company shareholdings can apply after departure. Both are specialist areas.",
  },
  {
    countryCode: "ES",
    country: "Spain",
    processName: "Baja consular and Modelo 030",
    summary:
      "Spain treats you as resident if you spend more than 183 days in a calendar year there, or your main economic interests are there. Leaving involves both the register you are on and your tax file.",
    steps: [
      "If you are on the padrón, deregister with the ayuntamiento; if you are a Spanish national abroad, register the baja consular at the consulate.",
      "Update your tax residence status with the Agencia Tributaria using Modelo 030.",
      "File the final resident return, and check whether Modelo 720 reporting on foreign assets applied for that year.",
      "Obtain a certificate of tax residence from your new country once you have one.",
    ],
    evidence: "The Modelo 030 acknowledgement plus a tax residence certificate from the new country.",
    timing: "Calendar tax year. The 183-day count is per calendar year and does not roll.",
    watchOut:
      "A spouse or dependent children remaining resident in Spain creates a presumption of Spanish residence that must be rebutted.",
  },
  {
    countryCode: "US",
    country: "United States",
    processName: null,
    summary:
      "This process does not apply to US citizens or green card holders. The United States taxes on citizenship, so leaving the country does not end the filing obligation. You continue to file annually on worldwide income wherever you live.",
    steps: [
      "Continue filing a federal return each year, plus FBAR and FATCA reporting where thresholds are met.",
      "Look at the Foreign Earned Income Exclusion and the Foreign Tax Credit, which reduce double taxation but do not remove the filing requirement.",
      "State residency is separate and does need ending — some states are considerably harder to leave than others.",
    ],
    evidence: "There is no exit artefact at federal level. State-level records matter.",
    timing: "Calendar tax year, with an automatic extension available to citizens abroad.",
    watchOut:
      "Formally expatriating is a serious, mostly irreversible step with its own exit tax. Nothing on this page should be read as suggesting it.",
  },
  {
    countryCode: "AU",
    country: "Australia",
    processName: "Cessation of residency",
    summary:
      "Australia applies a set of residency tests centred on where you permanently live and your ongoing ties. There is no single deregistration form; the ATO looks at the whole picture.",
    steps: [
      "Establish a permanent home outside Australia — this is the central fact in most cases.",
      "Lodge a final return and indicate the date you ceased to be a resident for tax purposes.",
      "Review capital gains consequences: ceasing residency is a deemed disposal event for many assets unless you elect otherwise.",
      "Tell Medicare, your bank and your super fund.",
    ],
    evidence: "The final return with the cessation date, and evidence of the permanent home abroad.",
    timing: "Australian tax year runs 1 July to 30 June.",
    watchOut:
      "The deemed-disposal rules mean leaving can trigger a tax event on assets you have not sold. Get this modelled before you go.",
  },
  {
    countryCode: "NL",
    country: "Netherlands",
    processName: "Uitschrijving from the BRP",
    summary:
      "Deregistration from the Basisregistratie Personen is the formal step when you leave for more than eight months in any twelve.",
    steps: [
      "Deregister at the gemeente, no earlier than five days before departure.",
      "File an M-form migration return for the year you leave.",
      "End Dutch health insurance from the date of departure — keeping it while non-resident is a common and expensive error.",
    ],
    evidence: "The gemeente deregistration confirmation and the processed M-form.",
    timing: "Calendar tax year. Deregistration is done in the days around departure.",
    watchOut: "Retaining a Dutch home available to you can keep you resident despite deregistration.",
  },
  {
    countryCode: "CA",
    country: "Canada",
    processName: "Emigrant status and Form NR73",
    summary:
      "Canada decides residency on residential ties: a home, a spouse, dependants, and then secondary ties. You file as an emigrant for the year you leave.",
    steps: [
      "Sever significant residential ties — home, spouse and dependants are weighted most heavily.",
      "File a final return marked with your date of departure.",
      "Deal with the departure tax: a deemed disposition of most property at fair market value on the day you leave.",
      "Form NR73 is optional and requests a CRA opinion. It is not required, and it invites scrutiny.",
    ],
    evidence: "The final emigrant return showing the departure date.",
    timing: "Calendar tax year.",
    watchOut: "The departure tax catches people with appreciated investments who assumed leaving was free.",
  },
  {
    countryCode: "IE",
    country: "Ireland",
    processName: "Form P50 / split-year relief",
    summary:
      "Irish residence is a day-count test: 183 days in a year, or 280 across two years. Split-year relief can apply to employment income in the year of departure.",
    steps: [
      "Tell Revenue you are leaving and claim any refund due for the year using the appropriate form.",
      "Check whether split-year relief applies to your employment income.",
      "Note that ordinary residence continues for three years after residence ends, and has its own consequences.",
      "Keep travel records for the two-year look-back test.",
    ],
    evidence: "Revenue correspondence confirming the change plus your day-count record.",
    timing: "Calendar tax year.",
    watchOut:
      "Ordinary residence trailing for three years surprises almost everyone who assumes the exit was clean.",
  },
];

export function taxExitNote(countryCode: string): TaxExitNote | undefined {
  return TAX_EXIT_NOTES.find((n) => n.countryCode === countryCode);
}

export function isCovered(countryCode: string): boolean {
  return TAX_EXIT_NOTES.some((n) => n.countryCode === countryCode);
}

/**
 * Countries the app deliberately does not yet describe. Listed by name in the
 * UI rather than guessed at: a wrong deregistration deadline is worse than an
 * honest gap.
 */
export const NOT_YET_COVERED =
  "France, Italy, Belgium, Sweden, Norway, Denmark, Poland, Portugal, Switzerland, Austria, New Zealand, South Africa, India and Brazil are not covered yet. The process in each differs enough that a summary written from the outside would be misleading.";

export const TAX_EXIT_FRAMING =
  "This describes processes and the documents they produce. It is not advice, and it cannot tell you whether you have ceased to be tax resident — that depends on facts specific to you and is determined by the tax authority. Speak to an adviser in your home country before relying on any of it.";
