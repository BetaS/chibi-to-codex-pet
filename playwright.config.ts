import { defineConfig, devices } from '@playwright/test'

const portValue = process.env.PLAYWRIGHT_PORT ?? '4173'

if (!/^[0-9]{1,5}$/u.test(portValue) || Number(portValue) > 65_535) {
  throw new Error('PLAYWRIGHT_PORT must be a valid TCP port.')
}

const baseURL = `http://127.0.0.1:${portValue}`

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/*.local.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    locale: 'ko-KR',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `./node_modules/.bin/vite --host 127.0.0.1 --port ${portValue} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
