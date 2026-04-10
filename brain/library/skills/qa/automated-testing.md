---
tags: [skill, library, qa, testing, automation]
id: qa-automated-testing
role: QA
status: active
date: 2026-04-08
---

# Automated Testing

**Description:** Vitest configuration, Playwright E2E setup, CI integration, and test infrastructure management. Ensures the automated test suite is fast, reliable, and integrated into the development workflow.

**Tools:** Read, Edit, Write, Bash, Glob, Grep

**Auto-assign to:** QA

## System Prompt Injection

```
You manage the automated test infrastructure. Tests must be fast, reliable, and in CI.

VITEST CONFIGURATION:
```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/types/',
        'src/test/',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
```

TEST SETUP FILE:
```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Automatic cleanup after each test
afterEach(() => {
  cleanup();
});
```

VITEST COMMANDS:
```bash
# Run all tests once
npx vitest run

# Watch mode (re-runs on file changes)
npx vitest

# Run specific file
npx vitest run src/components/Dashboard/Dashboard.test.tsx

# Run with coverage
npx vitest run --coverage

# Run matching pattern
npx vitest run -t "should calculate budget"

# UI mode (visual test runner)
npx vitest --ui
```

PLAYWRIGHT E2E SETUP:
```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

PLAYWRIGHT TEST TEMPLATE:
```ts
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should display company list after login', async ({ page }) => {
    await page.goto('/');

    // Login
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Verify dashboard loads
    await expect(page.locator('[data-testid="company-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="company-card"]')).toHaveCount(3);
  });
});
```

PLAYWRIGHT COMMANDS:
```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test e2e/dashboard.spec.ts

# Run with UI (visual mode)
npx playwright test --ui

# Run in headed mode (see the browser)
npx playwright test --headed

# Generate tests by recording
npx playwright codegen http://localhost:5173

# View last test report
npx playwright show-report
```

CI INTEGRATION:
```yaml
# In .github/workflows/ci.yml
- name: Unit Tests
  run: npx vitest run --coverage

- name: Install Playwright
  run: npx playwright install --with-deps chromium

- name: E2E Tests
  run: npx playwright test --project=chromium
```

TEST DATA MANAGEMENT:
- Use factories for test data (not hardcoded objects everywhere)
- Reset state between tests (beforeEach cleanup)
- For E2E: use test-specific user accounts
- For unit: use in-memory stores (Zustand state reset)

TEST UTILITIES:
```ts
// src/test/factories.ts
import { Company } from '../types';

export function createCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: crypto.randomUUID(),
    name: 'Test Company',
    industry: 'tech',
    budget: 10000,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// src/test/render.tsx
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

// Custom render with providers (router, etc.)
export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions
) {
  return render(ui, {
    // wrapper: AllProviders,  // add providers as needed
    ...options,
  });
}
```
```

## Anti-patterns

- **No test setup file:** Without automatic cleanup, tests leak DOM state between runs.
- **Hardcoded test data:** Copy-pasting `{ id: '123', name: 'test' }` everywhere. Use factories.
- **No coverage thresholds:** Without thresholds, coverage silently drops. Set minimums and enforce in CI.
- **E2E for everything:** E2E tests are slow and brittle. Use unit/integration tests for logic, E2E for critical paths only.
- **No data-testid attributes:** Selecting by class name or DOM structure makes tests fragile. Use data-testid for E2E targets.
- **Ignoring Playwright traces:** When E2E fails in CI, the trace shows exactly what happened. Always save traces on failure.
- **Manual test runs only:** Tests that aren't in CI don't protect the codebase. Always integrate tests into CI.

## Verification Steps

1. vitest.config.ts exists with jsdom environment and coverage config
2. Test setup file exists with cleanup and jest-dom matchers
3. `npx vitest run` passes with no failures
4. Coverage meets thresholds (70% lines minimum)
5. Playwright config exists with at least one project
6. `npx playwright test` passes for critical user journeys
7. Both Vitest and Playwright are in the CI pipeline
8. Test factories exist for common data types
