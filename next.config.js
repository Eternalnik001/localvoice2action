/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server output for the Docker/Cloud Run runner stage.
  output: "standalone",
  images: {
    // Seed/demo photos come from remote sources and data URIs. Permissive on
    // purpose for the hackathon demo; tighten before any real deployment.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
}

module.exports = nextConfig
