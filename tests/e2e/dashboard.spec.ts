import { test, expect } from '@playwright/test';

test('unauthenticated dashboard visits redirect to sign-in', async ({ page }) => {
  await page.goto('/app/dashboard');

  const currentURL = new URL(page.url());
  expect(currentURL.pathname).toBe('/auth/signin');
  expect(currentURL.searchParams.get('redirectedFrom')).toBe('/app/dashboard');
});
