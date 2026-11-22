/** @type {import('next').NextConfig} */
export default {
  serverExternalPackages: ["pg"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Frame-Options", value: "DENY" }, { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" }] }]
  },
}
