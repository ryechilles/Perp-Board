/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Both exchange pages are static, client-rendered shells: keep them in the
    // client router cache for 30 min (default 5) so switching exchanges stays
    // instant on a long-open tab instead of re-fetching from the worker.
    staleTimes: {
      static: 1800,
    },
  },
}

module.exports = nextConfig
