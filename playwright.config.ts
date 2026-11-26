import { defineConfig, devices } from '@playwright/test'

const chromiumPath = process.env.PW_CHROMIUM
const launchOptions = chromiumPath ? { executablePath: chromiumPath, args: ['--no-sandbox'] } : {}
const base = 'http://localhost:4173/ShopSmart/'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: base, trace: 'off', launchOptions, serviceWorkers: 'allow' },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'], browserName: 'chromium', launchOptions } },
    { name: 'android', use: { ...devices['Pixel 7'], launchOptions } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium', launchOptions } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, launchOptions } },
  ],
  webServer: {
    command: 'npm run preview',
    url: base,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
