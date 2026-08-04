import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCitiesTool from "./tools/list-cities";
import getCityTool from "./tools/get-city";
import compareCitiesTool from "./tools/compare-cities";
import schengenCheckTool from "./tools/schengen-check";

// The OAuth issuer must be the direct Supabase auth host; the project ref is the
// only value that survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "driftly-nomad-navigator",
  title: "Driftly: Nomad Navigator",
  version: "0.1.0",
  instructions:
    "Geo-arbitrage and visa-compliance tools for freelancers and remote workers. Use `list_cities` to rank cities by what you'd keep each month on a given income, `get_city` for full cost/visa/tax detail, `compare_cities` for a side-by-side on one income, and `schengen_check` to run the rolling 90/180 engine over a set of trips. All visa and tax output is an estimate — users must confirm with official authorities.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCitiesTool, getCityTool, compareCitiesTool, schengenCheckTool],
});
