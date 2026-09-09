import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // PDF.js resolves its worker relative to the installed package. Bundling it
  // into .next/server/chunks breaks that path at runtime.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/pdf-parse/dist/pdf-parse/**/pdf.worker.mjs',
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    ],
  },
};

export default nextConfig;
