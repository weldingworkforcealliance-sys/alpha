import type {NextConfig} from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        // The grading Tower embeds a same-origin workspace.
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
  async redirects() {
    return [{
      source: '/resources/wld105/steel-dice-vr2-hires.png',
      destination: '/resources/wld105/steel-dice-vr2-final.png',
      permanent: true,
    }];
  },
  outputFileTracingIncludes: {
    '/tower/certificates/*/pdf': ['./node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'],
  },
};
export default config;
