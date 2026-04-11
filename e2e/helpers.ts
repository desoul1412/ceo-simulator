import { Page, expect } from '@playwright/test';

/** Base URLs */
export const APP_URL = 'http://localhost:5173';
export const API_URL = 'http://127.0.0.1:3001';

/** Wait for the app to load (nav bar visible) */
export async function waitForAppReady(page: Page) {
  await page.goto('/');
  await page.waitForSelector('nav', { timeout: 10_000 });
}

/** Navigate to a company by clicking its card on the dashboard */
export async function goToFirstCompany(page: Page) {
  await page.goto('/');
  // Wait for company cards to appear
  const card = page.locator('[style*="cursor: pointer"]').first();
  await card.waitFor({ timeout: 10_000 });
  await card.click();
  // Wait for company view to load (agent panel should appear)
  await page.waitForTimeout(1000);
}

/** Check orchestrator health */
export async function checkOrchestratorHealth(page: Page): Promise<boolean> {
  try {
    const res = await page.request.get(`${API_URL}/api/health`);
    return res.ok();
  } catch {
    return false;
  }
}

/** Get all companies from the API */
export async function getCompanies(page: Page) {
  const res = await page.request.get(`${API_URL}/api/companies`);
  return res.json();
}

/** Get tickets for a company */
export async function getTickets(page: Page, companyId: string) {
  const res = await page.request.get(`${API_URL}/api/companies/${companyId}/tickets`);
  return res.json();
}
