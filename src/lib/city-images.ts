/**
 * City cover photography.
 *
 * These images are generated for this project, so there is no third-party
 * licence attached to any of them — no Unsplash/Flickr attribution rules to
 * track and no risk of a stock agency claim. Files live in
 * src/assets/cities/<cityId>.jpg and are picked up automatically; a city with
 * no file falls back to the gradient cover in CityCard.
 */
const files = import.meta.glob<string>("../assets/cities/*.jpg", {
  eager: true,
  query: "?url",
  import: "default",
});

const byId: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const id = path.split("/").pop()!.replace(/\.jpg$/, "");
  byId[id] = url;
}

export function cityImage(cityId: string): string | undefined {
  return byId[cityId];
}
