/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },

  /**
   * Externalize `canvas` (node-canvas) so konva builds cleanly.
   * `serverExternalPackages` is bundler-agnostic — it works under both
   * Turbopack (Next 16 default) and webpack (`--webpack` / Next 15).
   */
  serverExternalPackages: ['canvas'],

  /**
   * Present turbopack config silences:
   *   "This build is using Turbopack, with a webpack config and no
   *    turbopack config."
   * Empty object is enough — we don't need any custom Turbopack rules,
   * because `serverExternalPackages` handles the externalization.
   */
  turbopack: {},

  /**
   * Kept for legacy / `--webpack` builds (Next 15, or explicit opt-out
   * of Turbopack). Has no effect under Turbopack.
   */
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
};

export default nextConfig;