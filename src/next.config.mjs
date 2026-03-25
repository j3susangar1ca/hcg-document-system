/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias.canvas = false;
      config.resolve.alias.encoding = false;
      
      // CRÍTICO: Excluir pdfjs-dist de optimizaciones agresivas
      config.optimization = {
        ...config.optimization,
        minimize: false,
      };
      
      // Forzar tratamiento como ESM
      config.module.rules.push({
        test: /pdfjs-dist/,
        type: 'javascript/auto',
        resolve: {
          fullySpecified: false,
        },
      });
    }
    return config;
  },
};

export default nextConfig;

