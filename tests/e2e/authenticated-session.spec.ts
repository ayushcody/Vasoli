import { randomUUID } from 'node:crypto';
import { test, expect, request } from '@playwright/test';
import { anonKey, serviceRoleKey, supabaseURL } from './local-fixtures';

test('a real local Supabase session can open a protected page', async ({ page }) => {
  test.skip(!supabaseURL || !anonKey || !serviceRoleKey, 'requires local Supabase E2E credentials');

  const email = `vasoli-e2e-${randomUUID()}@example.test`;
  const password = `Vasoli-E2E-${randomUUID()}-Aa1!`;
  const admin = await request.newContext({
    baseURL: supabaseURL,
    extraHTTPHeaders: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  });

  let userId: string | undefined;
  try {
    const created = await admin.post('/auth/v1/admin/users', {
      data: { email, password, email_confirm: true },
    });
    expect(created.ok(), `local Supabase admin user creation failed (${created.status()})`).toBeTruthy();
    const user = await created.json();
    userId = user.id;
    expect(userId).toBeTruthy();

    await page.goto('/auth/signin?redirectedFrom=%2Fapp%2Fdashboard');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible({ timeout: 15_000 });

    await page.goto('/app/transactions');
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
    await page.getByRole('button', { name: 'Add transaction' }).click();
    const description = `E2E purchase ${randomUUID()}`;
    await page.getByLabel('Description').fill(description);
    await page.getByLabel('Amount (₹)').fill('12.50');
    await page.getByRole('button', { name: 'Save transaction' }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 15_000 });
  } finally {
    if (userId) {
      const deleted = await admin.delete(`/auth/v1/admin/users/${encodeURIComponent(userId)}`);
      expect([200, 204, 404]).toContain(deleted.status());
    }
    await admin.dispose();
  }
});
