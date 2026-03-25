/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⚠️ LA BALA DE PLATA: Apaga el minificador de SWC que corrompe pdfjs-dist
  swcMinify: false,
  
  webpack: (config) => {
    // Evita que Webpack intente empaquetar librerías exclusivas de Node.js
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default nextConfig;
