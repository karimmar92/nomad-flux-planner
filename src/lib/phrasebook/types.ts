/**
 * Situation phrasebook — the narrow, verifiable alternative to a translator.
 *
 * WHY THIS IS NOT A TRANSLATOR, and must never become one:
 *
 * A neural translator cannot be checked. It produces a plausible sentence for
 * any input, including a wrong one, and at an immigration counter a plausible
 * wrong sentence is the failure mode that costs someone their stay. A fixed
 * list can be reviewed by a native speaker once and then be right permanently.
 *
 * That verifiability is the entire product argument. It is also why every
 * phrase carries a `verifiedBy` and `verifiedOn`: a phrase nobody has checked
 * renders as UNVERIFIED in the UI, never silently as fact. See
 * src/lib/phrasebook/phrasebook.test.ts, which fails the build if that
 * invariant is broken.
 *
 * Consequences that follow from the same argument:
 *   * No free-text input. There is nothing to translate, only phrases to pick.
 *   * No model, no download. The whole dataset is kilobytes and ships with the
 *     app, so it works offline for real — the same promise as the vault.
 *   * Audio uses the browser's SpeechSynthesis, which is on-device on most
 *     phones. Where a voice for the language is missing we say so rather than
 *     reading Vietnamese with an English voice, which is worse than silence.
 */

/** Situations the app already knows a user is in, from trips and checklists. */
export type SituationId =
  | "immigration"
  | "visa_office"
  | "police"
  | "pharmacy"
  | "housing"
  | "bank"
  | "sim_card"
  | "emergency";

export type Situation = {
  id: SituationId;
  label: string;
  /** When this matters — shown under the heading, no fluff. */
  context: string;
};

export const SITUATIONS: Situation[] = [
  {
    id: "immigration",
    label: "Immigration counter",
    context: "Arrival, departure, and being pulled aside for secondary questioning.",
  },
  {
    id: "visa_office",
    label: "Visa / extension office",
    context: "Extending a stay, collecting an approval letter, asking what is missing.",
  },
  {
    id: "police",
    label: "Police station",
    context: "A lost or stolen passport, and the report you need for a replacement.",
  },
  {
    id: "pharmacy",
    label: "Pharmacy and doctor",
    context: "Describing a problem and asking what a medicine contains.",
  },
  { id: "housing", label: "Renting a place", context: "Viewings, deposits, and what is included." },
  { id: "bank", label: "Bank", context: "Opening an account and what documents are required." },
  { id: "sim_card", label: "SIM and data", context: "Buying a local SIM and registering it." },
  {
    id: "emergency",
    label: "Emergency",
    context: "The few sentences worth having when there is no time to search.",
  },
];

export type VerificationStatus = "verified" | "unverified";

export type Phrase = {
  id: string;
  situation: SituationId;
  /** English source. This is the authoritative meaning. */
  en: string;
  /** Target-language text. Empty string means not yet translated. */
  target: string;
  /**
   * Pronunciation for someone who cannot read the script. Optional because it
   * is meaningless for Latin-script languages.
   */
  pronunciation?: string;
  /** What a likely ANSWER looks like, so the reply is not a wall of nothing. */
  likelyReplies?: { target: string; en: string }[];
  /** Practical note — a custom, a document name, a thing that goes wrong. */
  note?: string;
};

export type PhrasebookLocale = {
  countryCode: string;
  country: string;
  languageName: string;
  /** BCP-47 tag, used to pick a speech voice. */
  bcp47: string;
  /**
   * Who checked these and when. NULL means nobody has — the UI must then
   * label the whole set as unverified. Never fill this in speculatively:
   * it is the one claim this feature rests on.
   */
  verifiedBy: string | null;
  verifiedOn: string | null;
  phrases: Phrase[];
};

export function verificationOf(locale: PhrasebookLocale): VerificationStatus {
  return locale.verifiedBy && locale.verifiedOn ? "verified" : "unverified";
}

/** Phrases that actually have a translation, in situation order. */
export function usablePhrases(locale: PhrasebookLocale, situation?: SituationId): Phrase[] {
  return locale.phrases.filter(
    (p) => p.target.trim().length > 0 && (!situation || p.situation === situation),
  );
}

export function situationsWithContent(locale: PhrasebookLocale): Situation[] {
  const present = new Set(usablePhrases(locale).map((p) => p.situation));
  return SITUATIONS.filter((s) => present.has(s.id));
}
