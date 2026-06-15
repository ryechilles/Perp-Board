import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config: no R2 incremental cache configured.
// This app is effectively client-rendered with a couple of proxy API routes,
// so the default (in-memory) caching is sufficient. To enable persistent
// ISR/data caching later, add an R2 bucket binding and an incremental cache
// override here. See https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({});
