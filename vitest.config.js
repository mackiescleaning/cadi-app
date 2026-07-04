// Vitest config — kept separate from vite.config.js so the production build never
// pulls in test tooling. Vitest picks this file up automatically.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure-logic units default to the Node environment. The few tests that touch
    // browser APIs (jsPDF) opt in per-file with `// @vitest-environment jsdom`.
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{js,jsx,mjs}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/hooks/usePlan.js',
        'src/lib/invoicePdf.js',
        'src/lib/migration/parsers.js',
        'src/test/**',
      ],
    },
  },
});
