import { Page, expect } from '@playwright/test';

/** Base URLs */
export const APP_URL = 'http://localhost:5173';
export const API_URL = 'http://127.0.0.1:3001';

/** Test credentials from .env */
const TEST_EMAIL = process.env.SUPABASE_EMAIL || 'nguyenbaole1412@gmail.com';
const TEST_PASSWORD = process.env.SUPABASE_PASSWORD || 'Aa123456';

const SUPABASE_URL = 'https://qdhengvarelfdtmycnti.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkaGVuZ3ZhcmVsZmR0bXljbnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MjgyOTAsImV4cCI6MjA5MTIwNDI5MH0.rTi7SUb510UHblajRm7QE4An2bneVJFn-QBmMe8-F8Q';

/** Inject auth token into localStorage before page loads */
async function ensureAuth(page: Page) {
  // Navigate first (needed for localStorage domain)
  await page.goto('/');
  await page.waitForTimeout(1000);

  // Login via fetch inside the page context (avoids CORS/proxy issues with page.request)
  const authResult = await page.evaluate(async ({ url, key, email, password }) => {
    try {
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      localStorage.setItem('ceo-sim-auth', JSON.stringify({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
      }));
      return 'ok';
    } catch (e: any) {
      return e.message;
    }
  }, { url: SUPABASE_URL, key: ANON_KEY, email: TEST_EMAIL, password: TEST_PASSWORD });

  if (authResult === 'ok') {
    await page.reload();
    await page.waitForTimeout(2000);
  } else {
    console.warn('[auth] Token injection failed:', authResult);
  }
}

/** Wait for the app to load (handle auth + wait for content) */
export async function waitForAppReady(page: Page) {
  await ensureAuth(page);
  // Wait for dashboard content (not login page)
  const bodyText = await page.textContent('body');
  if (bodyText?.includes('LOGIN')) {
    // Auth injection failed — wait and retry
    await page.waitForTimeout(3000);
  }
}

/** Navigate to a company by clicking its card on the dashboard */
export async function goToFirstCompany(page: Page) {
  await waitForAppReady(page);
  // Click the first company card
  const card = page.locator('text=CEO SIMULATOR').first();
  if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
    await card.click();
  } else {
    // Fallback: click any card with cursor: pointer
    const anyCard = page.locator('[style*="cursor: pointer"]').first();
    await anyCard.click();
  }
  await page.waitForURL(/company\//, { timeout: 10_000 }).catch(() => {});
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
