import { test, expect } from '@playwright/test';

test.describe('Obligations Page access control', () => {
  test('unauthenticated obligations visits redirect to sign-in', async ({ page }) => {
    await page.goto('/app/obligations');

    const currentURL = new URL(page.url());
    expect(currentURL.pathname).toBe('/auth/signin');
    expect(currentURL.searchParams.get('redirectedFrom')).toBe('/app/obligations');
  });
});
