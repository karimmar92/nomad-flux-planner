/**
 * Emergency playbooks.
 *
 * Written for someone panicking, possibly on a borrowed phone, possibly in
 * poor light. Rules that shaped every line below:
 *
 *   - Ordered steps, never paragraphs. Order matters: the police report comes
 *     before the embassy because the embassy will ask for it, and people
 *     routinely do it the other way round and lose half a day.
 *   - Imperative mood. "Get a police report", not "you should consider".
 *   - No hedging, no legal throat-clearing. The disclaimer lives once at the
 *     bottom of the screen, not inside the instructions.
 *   - Country-agnostic. Anything country-specific belongs in the seeded
 *     country block, which can be verified and dated. Guessing at local
 *     procedure here would be worse than saying nothing.
 *
 * Bundled with the app shell so it is available with no connectivity.
 */

export type Playbook = {
  id: string;
  title: string;
  /** One line shown on the card before it is opened. */
  summary: string;
  steps: string[];
  /** Shown after the steps, in a quieter style. */
  note?: string;
};

export const PLAYBOOKS: Playbook[] = [
  {
    id: "passport-lost",
    title: "Passport lost or stolen",
    summary: "Police report first — your embassy will ask for it.",
    steps: [
      "Get a police report before anything else. Your embassy will require the reference, and most insurers will too.",
      "Photograph the report, or write the reference number somewhere you will not lose it.",
      "Contact your embassy or nearest consulate. Outside office hours, use their emergency line — most publish one separately.",
      "If you need to travel within days, ask for an emergency travel document rather than a full replacement. It is faster and gets you home or to the next country.",
      "Tell your insurer. Many policies cover the replacement fee and some cover the delay costs.",
      "If you have a photo or scan of the passport, send it to the embassy — it speeds up identity checks considerably.",
    ],
    note:
      "Report it even if you think it was only lost. An unreported passport that is later used fraudulently becomes your problem.",
  },
  {
    id: "hospital",
    title: "Hospitalised or seriously ill",
    summary: "Call your insurer's 24h line before admission if you possibly can.",
    steps: [
      "If it is life-threatening, get treatment first. Everything else waits.",
      "Call your insurer's 24-hour emergency line — not customer service. Many policies require notification before or during admission, and skipping it can void the claim.",
      "Give the hospital your policy number. Some will bill the insurer directly; many will not, and will expect payment upfront.",
      "Keep every receipt, discharge note and prescription. Reimbursement without documentation is close to impossible.",
      "Ask for the diagnosis in writing, in English if available.",
      "If you cannot pay upfront and the insurer will not guarantee payment, contact your embassy — they cannot pay, but they can intervene.",
    ],
    note:
      "Check whether your policy covers motorbike or scooter accidents. Many exclude them entirely without a local licence, and this is the single most common gap for nomads.",
  },
  {
    id: "robbed",
    title: "Robbed or mugged",
    summary: "Cards first, then the police report.",
    steps: [
      "Freeze your cards. Most banking apps do this in one tap, faster than a phone call.",
      "Get a police report. No insurer will pay out without one, and you usually cannot file it later.",
      "Note exactly what was taken, with rough values, while it is fresh.",
      "If your phone was taken, sign out of it remotely and change your email password from another device — the email account is what unlocks everything else.",
      "Tell your insurer within the window in your policy. Many are 24 or 48 hours.",
    ],
  },
  {
    id: "arrested",
    title: "Arrested or detained",
    summary: "Ask for your embassy. Say nothing else until you have.",
    steps: [
      "Say that you want to contact your embassy. You have that right in most countries, and asking early makes it harder to refuse.",
      "Do not sign anything you cannot read. Ask for a translation, in writing.",
      "Do not admit to anything, discuss the case, or attempt to resolve it informally.",
      "Ask the embassy for their list of local English-speaking lawyers. They cannot represent you or pay your fees, but they can provide the list and check on your welfare.",
      "Tell someone at home where you are and what has happened.",
    ],
    note:
      "Your embassy cannot get you released, pay a fine, or give legal advice. What it can do is confirm you are being held, monitor your treatment, and contact your family.",
  },
  {
    id: "phone-lost",
    title: "Phone lost or stolen",
    summary: "Your email account is the real target — secure that first.",
    steps: [
      "From any other device, change your email password. Email resets everything else, so it is the account that matters most.",
      "Sign the phone out remotely and mark it lost — Find My iPhone, or Google Find My Device.",
      "Freeze your cards if payment apps were unlocked on it.",
      "Contact your carrier or eSIM provider to block the SIM, so nobody receives your SMS two-factor codes.",
      "Get a police report if you intend to claim.",
    ],
    note:
      "If your two-factor codes were on that phone, use your backup codes now. If you never saved backup codes, contact each account's recovery process before you lose access.",
  },
];

export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}
