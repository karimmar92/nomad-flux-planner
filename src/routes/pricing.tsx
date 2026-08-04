import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "@/lib/app";
import { useProfile } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: `Pricing | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Free covers 8 cities and a single-country day counter. Pro at $9/mo unlocks every city, full arbitrage, compare and the Schengen engine.",
      },
      { property: "og:title", content: `Pricing | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Free for the basics. Pro at $9/mo for every city and the full Schengen engine.",
      },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const { t } = useTranslation("common");
  const { profile } = useProfile();

  // The Schengen 90/180 engine descriptions reference a specific legal rule
  // set (day-counting for the Schengen area) and are deliberately left in
  // English rather than run through t(), per the legally-consequential-string
  // rule: a mistranslated visa/day-count claim is a real risk to a traveller.
  const FREE = [
    { ok: true, text: t("pricing.free.cities8") },
    { ok: true, text: t("pricing.free.basicCostData") },
    { ok: true, text: t("pricing.free.singleCountryCounter") },
    { ok: false, text: t("pricing.free.personalisedArbitrage") },
    { ok: false, text: t("pricing.free.compare") },
    { ok: false, text: "Full Schengen 90/180 engine with alerts" },
    { ok: false, text: t("pricing.free.unlimitedTrips") },
    { ok: false, text: t("pricing.free.dataExport") },
  ];

  const PRO = [
    t("pricing.pro.everyCity"),
    t("pricing.pro.personalisedArbitrage"),
    t("pricing.pro.compare"),
    "Full rolling Schengen engine with 75% and 90% alerts",
    t("pricing.pro.unlimitedTrips"),
    t("pricing.pro.dataExport"),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("pricing.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("pricing.onPlan")}{" "}
          <span className="font-medium capitalize text-foreground">{profile.plan}</span>{" "}
          {t("pricing.planSuffix")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold">{t("pricing.free.title")}</h2>
          <div className="num mt-1 text-3xl font-semibold">{t("pricing.free.price")}</div>
          <ul className="mt-4 space-y-2 text-sm">
            {FREE.map((f) => (
              <li key={f.text} className="flex items-start gap-2">
                {f.ok ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className={cn(!f.ok && "text-muted-foreground")}>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel border-primary/50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("pricing.pro.title")}</h2>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              {t("pricing.pro.recommended")}
            </span>
          </div>
          <div className="num mt-1 text-3xl font-semibold">
            {t("pricing.pro.priceMonthly")}
            <span className="text-base font-normal text-muted-foreground">{t("pricing.pro.perMonth")}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("pricing.pro.yearlyNote")}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {PRO.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() =>
                toast(t("pricing.toast.checkoutSoonTitle"), {
                  description: t("pricing.toast.checkoutSoonDescription"),
                })
              }
              className="flex-1 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
            >
              {t("pricing.pro.goProMonthly")}
            </button>
            <button
              onClick={() =>
                toast(t("pricing.toast.checkoutSoonTitle"), {
                  description: t("pricing.toast.checkoutSoonDescription"),
                })
              }
              className="flex-1 rounded-md border border-border py-2.5 text-sm font-medium"
            >
              {t("pricing.pro.yearlyCta")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
