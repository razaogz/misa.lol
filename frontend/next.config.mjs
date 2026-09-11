/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "react-icons"],
  },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
