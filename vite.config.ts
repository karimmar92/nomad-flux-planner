// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * The Lovable MCP plugin crashes on Windows.
 *
 * Its assertContains() compares a POSIX-normalised root against a raw
 * platform path, so on Windows it sees
 *   "C:/Users/.../nomad-flux-planner"  vs  "C:\Users\...\nomad-flux-planner\src\routes"
 * decides the second is not inside the first, and refuses to start the dev
 * server. Lovable's own container is Linux, so the bug never surfaces there.
 *
 * The plugin only powers Lovable's in-editor MCP tooling — it contributes
 * nothing to the app itself — so skipping it on Windows costs nothing locally
 * and leaves the hosted build untouched.
 *
 * Remove this guard once the plugin handles win32 separators.
 */
const isWindows = process.platform === "win32";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    /**
     * MapLibre GL JS spawns its own tile-parsing worker via a relative
     * `new Worker(new URL(...), import.meta.url)` inside the package. Vite's
     * dependency pre-bundler rewrites that into a hashed `.vite/deps/...`
     * path that does not actually exist, so the worker 404s and the map
     * hangs forever with no thrown error — it just never fires "load".
     * Excluding the package from pre-bundling serves it as native ESM
     * instead, which resolves the worker URL correctly.
     */
    optimizeDeps: { exclude: ["maplibre-gl"] },
    plugins: [
      ...(isWindows ? [] : [mcpPlugin()]),
      /**
       * Offline-first. The app is most useful in an immigration hall with no
       * connectivity, so the shell and every already-visited page must be
       * servable from cache. Registration is done exclusively by
       * src/lib/pwa/register-sw.ts (injectRegister: null) so previews and dev
       * never get a service worker.
       */
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: false, // served statically from public/manifest.webmanifest
        workbox: {
          // Includes every locale bundle chunk: someone landing in a new
          // country with no connectivity must not lose their language.
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,json,webmanifest}"],
          navigateFallback: "/",
          // OAuth must always hit the network.
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/\.well-known/],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // HTML navigations: never cache-first, or a deploy strands users.
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "driftly-pages",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Hashed same-origin build assets are immutable.
              urlPattern: ({ url, request, sameOrigin }) =>
                sameOrigin &&
                (request.destination === "script" ||
                  request.destination === "style" ||
                  request.destination === "font" ||
                  request.destination === "image") &&
                !url.pathname.startsWith("/api/"),
              handler: "CacheFirst",
              options: {
                cacheName: "driftly-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              },
            },
          ],
        },
      }),
    ],
  },
});
