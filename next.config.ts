import type { NextConfig } from "next";
const path = require('path');

const nextConfig: NextConfig = {
  /* config options here */
  productionBrowserSourceMaps: true,
  reactStrictMode: true,
  sassOptions: {
    includePaths: [path.join(__dirname, 'src', 'styles')],
  },
  images: {
    domains: ['cdn.builder.io'], // Add your allowed image hostnames here
    dangerouslyAllowSVG: true,
  },
};

export default nextConfig;
