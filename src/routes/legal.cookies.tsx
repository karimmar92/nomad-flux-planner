/**
 * Cookies & local storage — TTDSG §25.
 *
 * §25 covers *any* storing of or access to information on a terminal device,
 * not only cookies. localStorage and IndexedDB are squarely in scope, which
 * catches out most SaaS cookie banners.
 *
 * §25(2)(2) exempts storage that is strictly necessary for a service the user
 * has expressly requested. Everything this app stores falls inside that
 * exemption — which is the only reason there is no consent banner. That claim
 * has to stay true: adding any analytics, ad pixel or A/B tool means a real
 * consent banner, blocking by default, before the script loads.
 *
 * NOT DRAFTED BY A LAWYER. Have it reviewed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app";
import { PROVIDER } from "@/config/legal";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: `Cookies | ${APP_NAME}` },
      { name: "description", content: "What is stored on your device, and why." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: Cookies,
});

const ITEMS = [
  {
    name: "Sign-in session",
    what: "A token proving you are signed in.",
    why: "Without it you would be signed out on every page.",
    life: "Until you sign out or it expires.",
  },
  {
    name: "Your trips and profile",
    what: "Stored in your browser so the app works with no connection.",
    why: "Day counting must work at a border, on a plane, with no signal.",
    life: "Until you delete them or clear your browser.",
  },
  {
    name: "Cached city and visa data",
    what: "A copy of pages you have opened.",
    why: "Offline access and faster loading.",
    life: "Refreshed automatically; cleared with your browser data.",
  },
  {
    name: "Interface preferences",
    what: "Theme, home currency, dismissed prompts.",
    why: "So the app does not forget your choices.",
    life: "Until you clear your browser data.",
  },
  {
    name: "Referral attribution",
    what: "The referral code from a link you arrived through.",
    why: "So the person who recommended the app is credited.",
    life: "Cleared when you close the tab. It is not a persistent tracking cookie.",
  },
] as const;

function Cookies() {
  return (
    <LegalPage
      title="Cookies & local storage"
      subtitle="Short version: nothing here tracks you, which is why there is no banner."
    >
      <LegalSection title="Why there is no cookie banner">
        <p>
          Consent is required for storage that is not strictly necessary for a service you have
          asked for. {APP_NAME} sets no advertising cookies, no analytics cookies and no third-party
          trackers, so there is nothing to consent to.
        </p>
        <p>
          There is no Google Analytics, no advertising pixel, and no session-recording tool. Nothing
          follows you to other websites.
        </p>
      </LegalSection>

      <LegalSection title="What is actually stored on your device">
        <div className="space-y-4">
          {ITEMS.map((i) => (
            <div key={i.name} className="space-y-0.5">
              <p className="font-medium text-foreground">{i.name}</p>
              <p>{i.what}</p>
              <p>{i.why}</p>
              <p className="text-xs">Kept: {i.life}</p>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection title="Third parties">
        <p>
          Stripe sets its own cookies when you reach the payment page, for fraud prevention and to
          complete the transaction. This happens on Stripe&apos;s checkout page, not before, and is
          governed by Stripe&apos;s privacy policy.
        </p>
      </LegalSection>

      <LegalSection title="Clearing it">
        <p>
          Clearing site data in your browser removes everything above. If you have an account, your
          trips are restored on next sign-in. If you do not, they are gone — an account is the only
          backup.
        </p>
      </LegalSection>

      <LegalSection title="If this ever changes">
        <p>
          Should any non-essential tracking be introduced, a real consent banner will appear first
          and nothing will load until you choose. Questions: {PROVIDER.email}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
