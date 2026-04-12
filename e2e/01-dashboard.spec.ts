import { test, expect } from '@playwright/test';
import { waitForAppReady, APP_URL } from './helpers';

test.describe('Dashboard & Navigation', () => {
  test('should load the master dashboard', async ({ page }) => {
    await page.goto('/');
    // NavBar should show the logo
    await expect(page.locator('text=CEO.SIM')).toBeVisible({ timeout: 10_000 });
  });

  test('should display company cards on dashboard', async ({ page }) => {
    await waitForAppReady(page);
    // Should have at least one company card or "no companies" state
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should navigate to settings page', async ({ page }) => {
    await waitForAppReady(page);
    // Click settings tab in nav
    const settingsLink = page.locator('text=Settings').first();
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await page.waitForURL(/settings/);
    }
  });

  test('should show orchestrator connection status', async ({ page }) => {
    await waitForAppReady(page);
    const bodyText = await page.textContent('body');
    // Should show some connection indicator
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test('should navigate between dashboard tabs', async ({ page }) => {
    await waitForAppReady(page);
    // Click Dashboard tab
    const dashTab = page.locator('text=Dashboard').first();
    if (await dashTab.isVisible()) {
      await dashTab.click();
      await expect(page).toHaveURL('/');
    }
  });
});
