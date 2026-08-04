import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { isLocale } from "@/lib/i18n/locales";

/**
 * Locale-prefixed URLs (/es/city/lisbon-pt).
 *
 * The prefix exists for shareable links and so search engines can index each
 * language separately. The app itself runs on unprefixed paths, so a prefixed
 * URL is resolved on the server: the locale is carried across as ?lang= and
 * picked up (and persisted) by I18nProvider on the first render.
 */
export const Route = createFileRoute("/$lang/$")({
  beforeLoad: ({ params }) => {
    const { lang, _splat } = params as { lang: string; _splat?: string };
    if (!isLocale(lang)) throw notFound();
    const rest = _splat ? `/${_splat}` : "/";
    throw redirect({ href: `${rest}?lang=${lang}`, statusCode: 302 });
  },
});
