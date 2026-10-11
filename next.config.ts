import type {NextConfig} from 'next';

const config: NextConfig = {
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
