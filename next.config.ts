import type {NextConfig} from 'next';

const config: NextConfig = {
  outputFileTracingIncludes: {
    '/tower/certificates/*/pdf': ['./node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'],
  },
};
export default config;
