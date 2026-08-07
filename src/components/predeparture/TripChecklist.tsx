import { Check, FileText, WifiOff } from "lucide-react";
import { getCity, CITIES } from "@/lib/cities";
import { CHECKLIST_ITEMS, useTripChecklist, visaDocumentList } from "@/lib/checklist";
import { useProfile } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Trip } from "@/lib/types";

/**
 * Pre-departure checklist for one upcoming trip.
 *
 * Everything here is readable with no connectivity: the ticks, the free-text
 * accommodation address, the onward-travel note and the visa document list
 * (derived from the cached seed row). Being asked for an onward ticket and an
 * address at a border with no data is the moment this pays for itself.
 */
export function TripChecklistCard({ trip }: { trip: Trip }) {
  const { checklist, patch, toggle } = useTripChecklist(trip.id);
  const { profile } = useProfile();
  const city =
    (trip.city_id ? getCity(trip.city_id) : undefined) ??
    CITIES.find((c) => c.country_code === trip.country_code);
  const docs = visaDocumentList(city, profile.nationality);
  const done = CHECKLIST_ITEMS.filter((i) => checklist.checked[i.key]).length;

  return (
    <section className="panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">
          Pre-departure checklist — {city?.country ?? trip.country_code}
        </h2>
        <span className="num text-xs text-muted-foreground">
          {done}/{CHECKLIST_ITEMS.length}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <WifiOff className="h-3 w-3" aria-hidden />
        Saved on this device. Works with no signal.
      </p>

      <ul className="mt-3 space-y-1.5">
        {CHECKLIST_ITEMS.map((item) => {
          const checked = Boolean(checklist.checked[item.key]);
          return (
            <li key={item.key}>
              <button type="button"
                onClick={() => toggle(item.key)}
                aria-pressed={checked}
                className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-start hover:bg-surface-2"
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border",
                    checked
                      ? "border-accent-positive bg-accent-positive text-background"
                      : "border-input",
                  )}
                >
                  {checked ? <Check className="h-3 w-3" aria-hidden /> : null}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm",
                      checked && "text-muted-foreground line-through",
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label-xs">Accommodation address</span>
          <textarea
            value={checklist.accommodationAddress}
            onChange={(e) => patch({ accommodationAddress: e.target.value })}
            rows={3}
            placeholder="The address you'll write on the arrival card"
            className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="label-xs">Onward travel</span>
          <textarea
            value={checklist.onwardTravelNote}
            onChange={(e) => patch({ onwardTravelNote: e.target.value })}
            rows={3}
            placeholder="Flight number, date, booking reference"
            className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
          />
        </label>
      </div>

      <details className="mt-3 rounded-md border border-border p-3" open>
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          Visa requirements, saved offline
        </summary>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {docs.map((d) => (
            <li key={d} className="flex gap-2">
              <span aria-hidden>·</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
        {city ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            From cached data verified {city.last_verified}. Always confirm with the official
            source before you travel.
          </p>
        ) : null}
      </details>
    </section>
  );
}
