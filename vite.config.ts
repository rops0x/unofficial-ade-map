import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// In e2e mode the map loads fixed fixture data instead of the collected ADE data.
const E2E_FIXTURE = fileURLToPath(new URL('./e2e/fixtures/events.json', import.meta.url))

// Built pages may only load their own files plus OpenStreetMap tiles. Added at build
// time only, so the dev server's injected scripts keep working.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const contentSecurityPolicy: Plugin = {
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`),
}

export default defineConfig(({ mode }) => ({
  plugins: [contentSecurityPolicy],
  resolve: {
    alias: mode === 'e2e' ? [{ find: /^\.\/data\/events\.json$/, replacement: E2E_FIXTURE }] : [],
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'scripts/lib/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'src/main.ts', 'src/map/map.ts', 'scripts/lib/http.ts', 'scripts/lib/store.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
}))
