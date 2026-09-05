/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://challenges.cloudflare.com",
      "frame-src 'self' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://images.unsplash.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
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
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const sensitiveAuthHeaders = [
  {
    key: 'Cache-Control',
    value: 'no-store, private',
  },
  {
    key: 'CDN-Cache-Control',
    value: 'no-store',
  },
  {
    key: 'Surrogate-Control',
    value: 'no-store',
  },
  {
    key: 'Pragma',
    value: 'no-cache',
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer',
  },
  {
    key: 'X-Robots-Tag',
    value: 'noindex, nofollow, noarchive',
  },
  {
    key: 'Vary',
    value: 'Cookie',
  },
];

const sensitiveAuthRoutes = [
  '/:lang(ro|en|fa)/app/:path*',
  '/:lang(ro|en|fa)/platform/:path*',
  '/:lang(ro|en|fa)/mfa/:path*',
  '/:lang(ro|en|fa)/accept-invitation',
  '/:lang(ro|en|fa)/login',
  '/:lang(ro|en|fa)/forgot-password',
  '/:lang(ro|en|fa)/reset-password',
  '/:lang(ro|en|fa)/password-recovery-result',
  '/:lang(ro|en|fa)/auth/callback',
  '/:lang(ro|en|fa)/auth-result',
  '/:lang(ro|en|fa)/invitation-continuation',
  '/:lang(ro|en|fa)/set-password',
  '/:lang(ro|en|fa)/invitation-result',
  '/:lang(ro|en|fa)/prototype',
  '/:lang(ro|en|fa)/user-testing',
  '/:lang(ro|en|fa)/wireframes/:path*',
  '/:lang(ro|en|fa)/ui/:path*',
  '/:lang(ro|en|fa)/information-architecture',
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      ...sensitiveAuthRoutes.map((source) => ({
        source,
        headers: sensitiveAuthHeaders,
      })),
    ];
  },
};

export default nextConfig;
