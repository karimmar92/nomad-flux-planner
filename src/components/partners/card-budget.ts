/**
 * One-card-per-screen budget (see ONE CARD PER SCREEN in src/config/partners.ts).
 *
 * The group components already render a single card outside the catalogue
 * placement, so this is a regression net rather than the primary defence: if
 * two independent components ever both decide to show a card on the same
 * screen, this shouts about it in development. It never blocks a click and
 * never runs in production.
 */
import { MAX_PARTNER_CARDS_PER_SCREEN, isCataloguePlacement } from "@/config/partners";
import type { PartnerPlacement } from "@/config/partners";

let path = "";
let seen: { partnerId: string; placement: PartnerPlacement }[] = [];
let scheduled = false;

export function registerPartnerCard(partnerId: string, placement: PartnerPlacement) {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  if (isCataloguePlacement(placement)) return; // the Nomad kit page is the catalogue

  const here = window.location.pathname;
  if (here !== path) {
    path = here;
    seen = [];
  }
  seen.push({ partnerId, placement });

  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    if (seen.length > MAX_PARTNER_CARDS_PER_SCREEN) {
      // eslint-disable-next-line no-console
      console.error(
        `[partners] ${seen.length} partner cards on ${path} — the limit is ${MAX_PARTNER_CARDS_PER_SCREEN}. ` +
          `Move the extras to the Nomad kit page. Rendered: ${seen
            .map((s) => `${s.partnerId}@${s.placement}`)
            .join(", ")}`,
      );
    }
    seen = [];
  });
}
