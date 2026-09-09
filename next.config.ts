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
      // PDF.js loads canvas via createRequire at runtime. Next's tracer misses
      // both the JS entry and platform binding; DOMMatrix then fails on import.
      './node_modules/@napi-rs/canvas/**',
      './node_modules/@napi-rs/canvas-*/**',
    ],
  },
};

export default nextConfig;
