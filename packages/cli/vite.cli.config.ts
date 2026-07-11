import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const cliRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: `${cliRoot}/dist`,
    rollupOptions: {
      external: ['playwright-core'],
      output: {
        banner: '#!/usr/bin/env node',
        entryFileNames: 'cli.js',
      },
    },
    ssr: `${cliRoot}/src/cli.ts`,
    target: 'node22',
  },
})
