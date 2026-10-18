import { test, expect } from '@playwright/test';

test.describe('Receipts Page access control', () => {
  test('unauthenticated receipt visits redirect to sign-in', async ({ page }) => {
    await page.goto('/app/receipts');

    const currentURL = new URL(page.url());
    expect(currentURL.pathname).toBe('/auth/signin');
    expect(currentURL.searchParams.get('redirectedFrom')).toBe('/app/receipts');
  });
});
