import { test, expect } from '@playwright/test';

test.describe('Transactions Page access control', () => {
  test('unauthenticated transactions visits redirect to sign-in', async ({ page }) => {
    await page.goto('/app/transactions');

    const currentURL = new URL(page.url());
    expect(currentURL.pathname).toBe('/auth/signin');
    expect(currentURL.searchParams.get('redirectedFrom')).toBe('/app/transactions');
  });
});
