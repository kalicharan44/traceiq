import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import { existsSync } from 'node:fs';

const backendPath = path.resolve(process.cwd(), '..', 'traceiq-backend');
const isolatedDatabase = path.join(os.tmpdir(), `traceiq-playwright-${process.pid}.db`).replace(/\\/g, '/');
const localPython = path.join(backendPath, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
const pythonExecutable = process.env.PYTHON_EXECUTABLE ?? (existsSync(localPython) ? localPython : 'python');
const apiPort = Number(process.env.TRACEIQ_E2E_API_PORT ?? 8000);
const webPort = Number(process.env.TRACEIQ_E2E_WEB_PORT ?? 3000);
const baseURL = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: `"${pythonExecutable}" -m uvicorn app.main:app --host 127.0.0.1 --port ${apiPort}`,
      cwd: backendPath,
      url: `http://127.0.0.1:${apiPort}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { DATABASE_URL: `sqlite:///${isolatedDatabase}`, LOAD_FULL_DATASET: 'false', AUTO_CREATE_SCHEMA: 'true', CORS_ORIGINS: baseURL },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
      cwd: process.cwd(),
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { VITE_API_BASE_URL: '/api/v1', VITE_BACKEND_URL: `http://127.0.0.1:${apiPort}` },
    },
  ],
});
