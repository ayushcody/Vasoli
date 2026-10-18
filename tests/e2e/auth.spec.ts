import { test, expect } from '@playwright/test';

test('sign-in page should load for unauthenticated visitors', async ({ page }) => {
  await page.goto('/auth/signin');

  const emailInput = page.getByPlaceholder('you@example.com');
  await expect(emailInput).toBeVisible();

  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
