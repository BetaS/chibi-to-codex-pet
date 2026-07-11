import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { localResourcePlugin } from './build/localResourcePlugin'
import { sitesStaticHostingPlugin } from './build/sitesStaticHostingPlugin'

const repositoryRoot = fileURLToPath(new URL('.', import.meta.url))

function parseAllowedHosts(value: string | undefined): string[] {
  if (!value?.trim()) {
    return []
  }

  return value
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
    .map((host) => {
      try {
        return new URL(host).hostname
      } catch {
        return host
      }
    })
}

export default defineConfig(({ command, mode }) => {
  const allowedHosts = parseAllowedHosts(
    loadEnv(mode, repositoryRoot, '').DEV_ALLOWED_HOSTS,
  )

  return {
    plugins: [
      react(),
      localResourcePlugin(repositoryRoot),
      sitesStaticHostingPlugin(repositoryRoot),
    ],
    publicDir: command === 'serve' ? 'public' : false,
    server: {
      allowedHosts,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  }
})
