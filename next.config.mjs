/** @type {import('next').NextConfig} */
const nextConfig = {
  // geoip-lite reads its data files via fs.readFileSync relative to
  // __dirname at require time. Webpack-bundling it (Next's default for
  // server code) breaks that -- the bundled __dirname no longer points to
  // node_modules/geoip-lite, so the require throws and Next silently drops
  // the route. This excludes it from bundling so it loads as a normal
  // native require() at runtime instead.
  experimental: {
    serverComponentsExternalPackages: ["geoip-lite"],
  },
};

export default nextConfig;
