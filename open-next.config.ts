import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every page here is prerendered at build time (the boards are client-rendered
// shells) and nothing is ever revalidated. The static-assets cache serves that
// prerendered HTML straight from Workers static assets, and cache interception
// answers the request before the Next.js server is even loaded — so a page view
// no longer pays for a server render on each request.
//
// This cache is read-only by design: it cannot do ISR / on-demand revalidation.
// If a page ever needs that, switch to the R2 or KV incremental cache instead.
// See https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
