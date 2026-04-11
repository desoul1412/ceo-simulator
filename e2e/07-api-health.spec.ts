import { test, expect } from '@playwright/test';
import { API_URL } from './helpers';

test.describe('Orchestrator API Health', () => {
  test('GET /api/health should return OK', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/health`);
    expect(res.ok()).toBeTruthy();
  });

  test('GET /api/daemon/status should return running state', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/daemon/status`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data).toHaveProperty('running');
  });

  test('GET /api/tickets/:companyId should work for valid company', async ({ request }) => {
    // Use a dummy UUID — should return empty array, not crash
    const res = await request.get(`${API_URL}/api/tickets/00000000-0000-0000-0000-000000000000`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('GET /api/ticket-status/:companyId should return counts', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/ticket-status/00000000-0000-0000-0000-000000000000`);
    expect(res.ok()).toBeTruthy();
  });

  test('PATCH /api/agents/:id with empty body should return 400', async ({ request }) => {
    const res = await request.patch(`${API_URL}/api/agents/fake-id`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('DELETE /api/agents/:id with invalid id should not crash', async ({ request }) => {
    const res = await request.delete(`${API_URL}/api/agents/nonexistent-uuid`);
    // Should return error gracefully, not 500
    expect(res.status()).toBeLessThan(500);
  });

  test('POST /api/process-queue without body should not crash', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/process-queue`, {
      data: {},
    });
    expect(res.status()).toBeLessThan(500);
  });

  test('GET /api/companies/:id/sprints should work', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/companies/00000000-0000-0000-0000-000000000000/sprints`);
    expect(res.status()).toBeLessThan(500);
  });
});
