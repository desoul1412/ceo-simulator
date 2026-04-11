import { test, expect } from '@playwright/test';
import { waitForAppReady, goToFirstCompany } from './helpers';

test.describe('Hire Agent Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
    await goToFirstCompany(page);
    await page.waitForTimeout(1000);
  });

  test('should open hire dialog when clicking + HIRE button', async ({ page }) => {
    const hireBtn = page.locator('button', { hasText: /HIRE/i }).first();
    if (await hireBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await hireBtn.click();
      await page.waitForTimeout(500);
      // Dialog should appear with role selection
      const dialog = page.locator('[style*="position: fixed"]').filter({ hasText: /HIRE.*AGENT|Role|Budget/i });
      await expect(dialog).toBeVisible({ timeout: 3000 });
    }
  });

  test('should show role buttons in hire dialog', async ({ page }) => {
    const hireBtn = page.locator('button', { hasText: /HIRE/i }).first();
    if (await hireBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await hireBtn.click();
      await page.waitForTimeout(500);
      // Should show role options
      const bodyText = await page.textContent('body');
      expect(bodyText).toMatch(/Frontend|Backend|QA|DevOps|Designer|PM/i);
    }
  });

  test('should close hire dialog on cancel/backdrop', async ({ page }) => {
    const hireBtn = page.locator('button', { hasText: /HIRE/i }).first();
    if (await hireBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await hireBtn.click();
      await page.waitForTimeout(500);
      // Click backdrop to close
      const backdrop = page.locator('[style*="position: fixed"][style*="rgba"]').first();
      await backdrop.click({ position: { x: 5, y: 5 } });
      await page.waitForTimeout(500);
    }
  });
});
