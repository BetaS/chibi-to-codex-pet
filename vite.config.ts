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

function parseDeployBasePath(value: string | undefined): string {
  const basePath = value?.trim() || '/'

  if (
    !basePath.startsWith('/') ||
    basePath.includes('?') ||
    basePath.includes('#') ||
    basePath.includes('\\')
  ) {
    throw new Error(
      'DEPLOY_BASE_PATH must be an absolute URL path without query, fragment, or backslash.',
    )
  }

  return basePath.endsWith('/') ? basePath : `${basePath}/`
}

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, repositoryRoot, '')
  const allowedHosts = parseAllowedHosts(environment.DEV_ALLOWED_HOSTS)
  const base = parseDeployBasePath(environment.DEPLOY_BASE_PATH)

  return {
    base,
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
