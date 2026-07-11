import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { localResourcePlugin } from '../../build/localResourcePlugin'

const cliRoot = fileURLToPath(new URL('.', import.meta.url))
const repositoryRoot = resolve(cliRoot, '../..')

export default defineConfig({
  root: resolve(cliRoot, 'renderer-src'),
  plugins: [localResourcePlugin(repositoryRoot)],
  publicDir: false,
  build: {
    emptyOutDir: true,
    outDir: resolve(cliRoot, 'renderer'),
    rollupOptions: {
      input: {
        index: resolve(cliRoot, 'renderer-src/index.html'),
      },
    },
  },
})
