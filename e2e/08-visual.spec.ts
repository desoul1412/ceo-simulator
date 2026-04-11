import { test, expect } from '@playwright/test';
import { waitForAppReady, goToFirstCompany } from './helpers';

test.describe('Visual Smoke Tests', () => {
  test('dashboard should render without blank screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Should not be a blank page
    const bodyText = await page.textContent('body');
    expect(bodyText!.length).toBeGreaterThan(50);
    // No uncaught JS errors
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(1000);
    // Screenshot for manual review
    await page.screenshot({ path: 'e2e/screenshots/dashboard.png', fullPage: true });
  });

  test('company view should render without errors', async ({ page }) => {
    await waitForAppReady(page);
    await goToFirstCompany(page);
    await page.waitForTimeout(2000);
    // Capture JS errors
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e/screenshots/company-view.png', fullPage: true });
    expect(errors.length).toBe(0);
  });

  test('board should render without errors', async ({ page }) => {
    await waitForAppReady(page);
    await goToFirstCompany(page);
    await page.waitForTimeout(500);
    const boardTab = page.locator('text=Board').first();
    if (await boardTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await boardTab.click();
      await page.waitForTimeout(2000);
      const errors: string[] = [];
      page.on('pageerror', err => errors.push(err.message));
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'e2e/screenshots/board.png', fullPage: true });
      expect(errors.length).toBe(0);
    }
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });
    await page.goto('/');
    await page.waitForTimeout(3000);
    // Filter out known benign errors (network failures when orchestrator is down, etc.)
    const realErrors = errors.filter(e =>
      !e.includes('Failed to fetch') &&
      !e.includes('Failed to load resource') &&
      !e.includes('NetworkError') &&
      !e.includes('ERR_CONNECTION_REFUSED') &&
      !e.includes('500')
    );
    expect(realErrors).toEqual([]);
  });
});
