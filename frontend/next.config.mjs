const basePath = process.env.MISA_NEXT_ROOT_BASE_PATH === "true" ? "" : "/dashboard";
const mediaHosts = (process.env.NEXT_PUBLIC_MEDIA_HOSTS || "r2.misa.lol")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath,
  experimental: {
    optimizePackageImports: ["lucide-react", "react-icons"],
    middlewareClientMaxBodySize: "128mb",
  },
  images: {
    remotePatterns: mediaHosts.map((hostname) => ({ protocol: "https", hostname, pathname: "/**" })),
  },
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return [{
      source: "/:username([a-zA-Z][a-zA-Z0-9_]{2,23})",
      destination: "/p/:username",
    }];
  },
};

export default nextConfig;
