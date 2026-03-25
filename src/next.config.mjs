/** @type {import('next').NextConfig} */
const nextConfig = {
  // ELIMINADO: transpilePackages (Causaba la corruption del módulo)
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default nextConfig;

