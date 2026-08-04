import { Link } from "@tanstack/react-router";
import { X, PlaneTakeoff } from "lucide-react";
import { CITIES } from "@/lib/cities";
import { PartnerGroup } from "@/components/partners/PartnerCard";
import { useOnline } from "@/lib/offline/use-online";
import type { PreDeparture } from "@/lib/pre-departure";

function countryName(code: string) {
  return CITIES.find((c) => c.country_code === code)?.country ?? code;
}

/**
 * Pre-departure prompt. This replaces the arrival eSIM offer entirely: an
 * arrival offer is unsellable, because the user has no connectivity at the
 * exact moment it fires. Here the purchase is actually possible.
 *
 * One partner card, per the existing rule, and only while online.
 */
export function PreDepartureCard({
  trigger,
  showPartnerCard,
  esimAlreadyTicked,
  onDismiss,
}: {
  trigger: PreDeparture;
  showPartnerCard: boolean;
  esimAlreadyTicked: boolean;
  onDismiss: () => void;
}) {
  const online = useOnline();
  const country = countryName(trigger.countryCode);
  const city = CITIES.find((c) => c.country_code === trigger.countryCode);

  const headline =
    trigger.kind === "trip"
      ? `Your ${country} trip starts in ${trigger.daysUntil} ${trigger.daysUntil === 1 ? "day" : "days"}.`
      : `You must leave the Schengen Area in ${trigger.daysUntil} ${trigger.daysUntil === 1 ? "day" : "days"}.`;

  return (
    <section className="panel border-l-2 border-l-primary p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <PlaneTakeoff className="h-4 w-4 text-primary" aria-hidden />
            {headline}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sort your data before you fly — you won&apos;t be able to buy an eSIM after you land.
            No roaming, and airport WiFi wants an SMS code you can&apos;t receive.
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {showPartnerCard && online && !esimAlreadyTicked ? (
        <div className="mt-3">
          <PartnerGroup
            category="esim"
            placement="pre_departure"
            title="Data before you fly"
            countryCode={trigger.countryCode}
            cityId={city?.id ?? null}
          />
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-muted-foreground">
          <Link to="/kit" className="underline hover:text-foreground">
            Data, cover and accounts are all on the Nomad kit page
          </Link>
        </p>
      )}
    </section>
  );
}
