#!/usr/bin/env node
/**
 * Guard for the marked translation path.
 *
 * A mistranslated button label is an annoyance. A mistranslated visa rule can
 * get someone barred from a country for three years. So every legally
 * consequential city string — arbitrage_note, visa.nomadVisa.notes, tax.notes,
 * connectivity_warning — must render through <TranslatedField> (via
 * useCityContent), which shows the translation, marks it as one, and keeps the
 * authoritative English one tap away.
 *
 * This check fails if any component renders one of those fields directly.
 * Run: `node scripts/check-translated-fields.mjs` (also part of `bun run lint:i18n`).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["src/routes", "src/components"];
const ALLOWLIST = new Set([
  "src/lib/i18n/city-content.ts",
  "src/components/i18n/TranslatedField.tsx",
]);

/** Direct JSX interpolation of a legally consequential field. */
const FORBIDDEN = [
  { re: /\{\s*[\w.]*\barbitrage_note\b\s*\}/, field: "arbitrage_note" },
  { re: /\{\s*[\w.]*\bconnectivity_warning\b\s*\}/, field: "connectivity_warning" },
  { re: /\{\s*[\w.?]*\btax\.notes\b\s*\}/, field: "tax.notes" },
  { re: /\{\s*[\w.?]*nomadVisa\.notes\s*\}/, field: "visa.nomadVisa.notes" },
  { re: /\{\s*nomad\??\.notes\s*\}/, field: "visa.nomadVisa.notes" },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
  }
  return out;
}

const violations = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (ALLOWLIST.has(file)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const { re, field } of FORBIDDEN) {
        if (re.test(line)) violations.push({ file, line: i + 1, field, text: line.trim() });
      }
    });
  }
}

if (violations.length > 0) {
  console.error(
    "\nLegally consequential strings rendered without the translation marker:\n",
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.field}\n    ${v.text}`);
  }
  console.error(
    "\nUse useCityContent() + <TranslatedField> so the translation is marked and\n" +
      "the authoritative English stays reachable. See src/lib/i18n/city-content.ts.\n",
  );
  process.exit(1);
}

console.log("i18n: all legally consequential city strings use the marked path.");
