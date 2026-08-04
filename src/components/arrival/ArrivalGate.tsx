import { useEffect, useState } from "react";
import { detectArrival, type ArrivalPrompt } from "@/lib/country-detect";
import { todayIso } from "@/lib/trip-dates";
import { ArrivalCard } from "./ArrivalCard";

/**
 * Runs on app open. Timezone-on-open needs no permission, no battery budget
 * and no app-store review, and catches most moves because people open the app
 * when they land. Native background geolocation is deliberately not built yet;
 * when it is, this flow stays as the permanent fallback for everyone who
 * denies the permission.
 */
export function ArrivalGate() {
  const [prompt, setPrompt] = useState<ArrivalPrompt | null>(null);

  useEffect(() => {
    setPrompt(detectArrival(todayIso()));
  }, []);

  if (!prompt) return null;
  return (
    <div className="mb-4">
      <ArrivalCard prompt={prompt} onResolved={() => setPrompt(null)} />
    </div>
  );
}
