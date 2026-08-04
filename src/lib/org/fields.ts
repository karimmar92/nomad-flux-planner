/**
 * THE EMPLOYER FIELD LIST.
 *
 * Country, dates, and the link to the employee. That is the whole contract.
 *
 * It is deliberately restrictive because the compliance data is only accurate
 * if employees willingly log their trips — no employer can detect where staff
 * actually are. A tool that feels like surveillance gets gamed: people stop
 * logging or log wrong, and the company ends up with authoritative-looking
 * data that is false, which is worse than no data at all.
 *
 * So the employer never sees: the radar or any social activity, income or
 * savings, arbitrage calculations, saved cities or browsing, the document
 * vault, personal notes on trips, or precise location of any kind.
 *
 * DO NOT WIDEN THIS LIST. Adding a column here is a product decision with
 * a trust cost, not a bug fix. The same list backs both the employer
 * dashboard and the employee's /settings/employer-sharing screen, so the
 * two can never drift apart.
 */
export const EMPLOYER_PRESENCE_FIELDS =
  "org_id,user_id,trip_id,country_code,entry_date,exit_date,logged_at";

/** Name/role/status only — enough to label a row, nothing more. */
export const EMPLOYER_DIRECTORY_FIELDS =
  "org_id,user_id,member_id,invite_email,role,status,joined_at,display_name";
