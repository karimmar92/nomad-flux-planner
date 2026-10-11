/**
 * Role lenses: one data model, four ways of reading it.
 *
 * HR, finance, mobility and a founder with no specialist all open the same
 * dashboard and want different things first. Building four dashboards would
 * mean four things to keep correct. A lens only reorders and trims the sections
 * of the one overview, so every number is the same wherever it is read.
 */

export type Lens = "hr" | "finance" | "mobility" | "founder";
export type SectionId = "actions" | "people" | "exposure" | "quality" | "exports";

export const LENSES: { id: Lens; label: string; blurb: string }[] = [
  { id: "hr", label: "People", blurb: "What needs a decision today" },
  { id: "finance", label: "Finance", blurb: "Exposure and the audit trail" },
  { id: "mobility", label: "Mobility", blurb: "Everyone at once" },
  { id: "founder", label: "Simple", blurb: "The verdict and the next three things" },
];

export const DEFAULT_LENS: Lens = "hr";

export function isLens(v: unknown): v is Lens {
  return v === "hr" || v === "finance" || v === "mobility" || v === "founder";
}

export function lensLayout(lens: Lens): { sections: SectionId[]; actionLimit: number | null } {
  switch (lens) {
    case "finance":
      return { sections: ["exposure", "exports", "quality", "actions"], actionLimit: 5 };
    case "mobility":
      return { sections: ["people", "actions", "exposure", "quality", "exports"], actionLimit: 5 };
    case "founder":
      return { sections: ["actions"], actionLimit: 3 };
    case "hr":
    default:
      return { sections: ["actions", "quality", "exposure", "exports"], actionLimit: 5 };
  }
}
