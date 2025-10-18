import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
});

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.databuddy.cc/databuddy.js;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  connect-src 'self' https://demotiles.maplibre.org https://api.maptiler.com https://basket.databuddy.cc;
  media-src 'self';
  worker-src 'self' blob:;
  img-src 'self' data: https://demotiles.maplibre.org https://api.maptiler.com;
`;

const nextConfig: NextConfig = {
    output: 'standalone',
    devIndicators: false,
    reactStrictMode: true,
    compress: true,
    compiler: {
        removeConsole: {
            exclude: ['error', 'warn'],
        },
    },
    poweredByHeader: false,
    headers: async () => {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=()',
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: ContentSecurityPolicy.replace(
                            /\s{2,}/g,
                            ' '
                        ).trim(),
                    },
                ],
            },
        ];
    },
};

export default withBundleAnalyzer(nextConfig);
