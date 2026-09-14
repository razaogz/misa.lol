const apiOrigin = process.env.API_PROXY_TARGET
  || (process.env.NODE_ENV === "production" ? "https://misa.lol" : "http://127.0.0.1:8000");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: "/dashboard",
  experimental: {
    optimizePackageImports: ["lucide-react", "react-icons"],
    middlewareClientMaxBodySize: "64mb",
  },
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${apiOrigin}/api/:path*`,
          basePath: false,
        },
      ],
      fallback: [
        {
          source: "/:username([a-zA-Z][a-zA-Z0-9_]{2,23})",
          destination: `${apiOrigin}/:username`,
          basePath: false,
        },
      ],
    };
  },
};

export default nextConfig;
