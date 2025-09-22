/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Don’t fail the build on type errors
  typescript: {
    ignoreBuildErrors: true,
  },

  // ✅ Don’t fail the build on ESLint errors
  eslint: {
    ignoreDuringBuilds: true,
  },

  experimental: {
    appDir: true, // keep if you’re using the App Router
  },
};

export default nextConfig;
