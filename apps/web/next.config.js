/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@genesis/engine', '@genesis/shared'],
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
};

module.exports = nextConfig;
