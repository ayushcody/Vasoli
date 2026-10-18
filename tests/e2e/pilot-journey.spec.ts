import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect, request } from '@playwright/test';
import { anonKey, serviceRoleKey, supabaseURL } from './local-fixtures';

function indiaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function indiaSlashDate() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
}

async function lowestProjectedForAccount(page: import('@playwright/test').Page) {
  const line = page.getByText(/Confirmed .*lowest projected/);
  await expect(line).toBeVisible();
  const text = await line.textContent();
  const match = text?.match(/lowest projected\s*₹([\d,]+)/i);
  expect(match, `could not read account forecast from: ${text}`).toBeTruthy();
  return Number(match![1].replaceAll(',', ''));
}

test('new user can import, reconcile, plan, export, and delete an account', async ({ page }) => {
  test.skip(!supabaseURL || !anonKey || !serviceRoleKey, 'requires local Supabase E2E credentials');
  test.setTimeout(120_000);

  const email = `vasoli-pilot-${randomUUID()}@example.test`;
  const password = `Vasoli-Pilot-${randomUUID()}-Aa1!`;
  const admin = await request.newContext({
    baseURL: supabaseURL,
    extraHTTPHeaders: {
      apikey: serviceRoleKey!,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  });
  let authUserId: string | undefined;

  try {
    const created = await admin.post('/auth/v1/admin/users', { data: { email, password, email_confirm: true } });
    expect(created.ok(), `local Supabase user creation failed (${created.status()})`).toBeTruthy();
    authUserId = (await created.json()).id;
    expect(authUserId).toBeTruthy();

    await page.goto('/auth/signin?redirectedFrom=%2Fapp%2Fdashboard');
    const emailInput = page.getByPlaceholder('you@example.com');
    const passwordInput = page.getByPlaceholder('••••••••');
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await expect(emailInput).toHaveValue(email);
    await expect(passwordInput).toHaveValue(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard(?:\?.*)?$/);

    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `test-results/pilot-dashboard-empty-${test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'desktop'}.png`, fullPage: true });

    const accountName = `Pilot account ${randomUUID().slice(0, 8)}`;
    await page.goto('/app/settings');
    await page.getByRole('button', { name: /Add Asset/ }).click();
    await page.getByPlaceholder('e.g. HDFC Bank').fill('Pilot Bank');
    await page.getByPlaceholder('e.g. Salary Account').fill(accountName);
    await page.getByPlaceholder('0.00').fill('1000.00');
    await page.getByRole('button', { name: 'Save Account' }).click();
    await expect(page.getByText(accountName)).toBeVisible();

    const duplicateDescription = `Pilot statement purchase ${randomUUID().slice(0, 8)}`;
    await page.goto('/app/transactions');
    await page.getByRole('button', { name: 'Add transaction' }).click();
    const transactionDialog = page.getByRole('dialog');
    await transactionDialog.getByLabel('Description').fill(duplicateDescription);
    await transactionDialog.getByLabel('Amount (₹)').fill('25.00');
    await transactionDialog.getByLabel('Date').fill(indiaDate());
    await transactionDialog.getByLabel('Account').selectOption({ label: accountName });
    await transactionDialog.getByRole('button', { name: 'Save transaction' }).click();
    await expect(page.getByText(duplicateDescription, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Import statement' }).click();
    const csv = [
      'Date,Narration,Reference,Withdrawal,Deposit,Closing Balance',
      `${indiaSlashDate()},${duplicateDescription},,25.00,,975.00`,
      `${indiaSlashDate()},Pilot statement income,,,100.00,1075.00`,
      `${indiaSlashDate()},Malformed statement row,,not-a-number,,1075.00`,
    ].join('\n');
    await page.locator('input[type="file"]').setInputFiles({ name: 'pilot-statement.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByLabel('Statement account').selectOption({ label: `${accountName} · Pilot Bank` });
    await page.getByLabel('Opening balance (optional)').fill('1000.00');
    await page.getByLabel('Closing balance (optional)').fill('1075.00');
    await page.getByRole('button', { name: 'Preview statement' }).click();
    await expect(page.getByRole('heading', { name: 'Server-checked preview' })).toBeVisible();
    await expect(page.getByText('Balance check matches')).toBeVisible();
    await expect(page.getByText('Possible duplicate', { exact: true })).toBeVisible();
    await expect(page.getByText('Review 1 rejected rows')).toBeVisible();
    const skipRejected = page.getByLabel('Skip 1 rejected rows');
    await expect(skipRejected).not.toBeChecked();
    const importButton = page.getByRole('button', { name: 'Import selected rows' });
    await expect(importButton).toBeDisabled();
    await skipRejected.check();
    await expect(page.getByLabel('Import row 2')).not.toBeChecked();
    await expect(page.getByLabel('Import row 2')).toBeEnabled();
    await page.getByLabel('Import row 2').check(); // Explicitly include a legitimate repeat after reviewing the warning.
    await importButton.click();
    await expect(page.getByRole('status').filter({ hasText: 'Import complete: 2 added, 0 duplicates detected, 1 skipped.' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(accountName, { exact: true })).toHaveCount(3);

    await page.goto('/app/settings');
    const accountCard = page.getByText(accountName, { exact: true }).locator('xpath=../../..');
    await accountCard.getByRole('button', { name: 'Confirm balance' }).click();
    await accountCard.getByLabel('Confirmed balance in rupees').fill('1075');
    await accountCard.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(accountCard.getByText(/Confirmed \d/)).toBeVisible({ timeout: 10_000 });

    const billName = `Pilot bill ${randomUUID().slice(0, 8)}`;
    await page.goto('/app/obligations');
    await page.getByRole('button', { name: 'Add obligation' }).click();
    const billDialog = page.getByRole('dialog');
    await billDialog.getByLabel('Name').fill(billName);
    await billDialog.getByLabel('Amount (INR)').fill('25');
    await billDialog.getByLabel('Next due date').fill(indiaDate());
    const billComboboxes = billDialog.getByRole('combobox');
    await billComboboxes.nth(0).click();
    await page.getByRole('option', { name: 'Monthly' }).click();
    await billComboboxes.nth(1).click();
    await page.getByRole('option', { name: accountName }).click();
    await billDialog.getByRole('button', { name: 'Create obligation' }).click();
    const billRow = page.getByRole('row').filter({ hasText: billName });
    await expect(billRow).toBeVisible();

    await page.goto('/app/transactions');
    const csvDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export filtered CSV' }).click();
    const csvDownload = await csvDownloadPromise;
    const csvExport = await readFile((await csvDownload.path())!, 'utf8');
    expect(csvExport).toContain(duplicateDescription);
    expect(csvExport).toContain('Pilot statement income');

    const goalName = `Pilot reserve ${randomUUID().slice(0, 8)}`;
    await page.goto('/app/goals');
    await page.getByRole('button', { name: 'New Goal' }).click();
    await page.getByPlaceholder('Goal name (e.g. Emergency Fund)').fill(goalName);
    await page.getByPlaceholder('Target amount').fill('500');
    await page.getByRole('button', { name: 'Create Goal' }).click();
    await expect(page.getByText(goalName, { exact: true })).toBeVisible();

    await page.goto('/app/cashflow');
    await expect(page.getByRole('heading', { name: 'Payday planning' })).toBeVisible();
    await page.getByLabel('Next payday').fill(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 14 * 86400000)));
    await page.getByLabel('Daily spending allowance (₹)').fill('50');
    await page.getByLabel('Minimum reserve (₹)').fill('100');
    await page.getByLabel('Goal to reserve for').selectOption({ label: goalName });
    await page.getByLabel('Goal amount reserved (₹)').fill('25');
    const payingAccount = page.getByRole('checkbox', { name: new RegExp(accountName) });
    await payingAccount.check();
    await expect(payingAccount).toBeChecked();
    await payingAccount.focus();
    await payingAccount.press('Space');
    await expect(payingAccount).not.toBeChecked();
    await payingAccount.press('Space');
    await expect(payingAccount).toBeChecked();
    await page.getByRole('button', { name: 'Save payday plan' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Payday plan saved.' })).toBeVisible();

    const lowestBeforePayment = await lowestProjectedForAccount(page);
    await page.goto('/app/obligations');
    const paymentRow = page.getByRole('row').filter({ hasText: billName });
    await paymentRow.getByRole('button', { name: 'Mark paid' }).click();
    const paymentDialog = page.getByRole('dialog');
    await expect(paymentDialog.getByRole('heading', { name: `Mark ${billName} paid` })).toBeVisible();
    await expect(paymentDialog.getByText('Loading posted expenses…')).toBeHidden();
    const matchingExpenses = paymentDialog.getByRole('radio', { name: new RegExp(duplicateDescription) });
    await expect(matchingExpenses).toHaveCount(2);
    await matchingExpenses.first().check();
    await paymentDialog.getByRole('button', { name: 'Link payment and mark paid' }).click();
    await expect(page.getByText('Bill marked paid')).toBeVisible();
    await expect(page.getByText('Linked to the existing Activity record; no expense was added.')).toBeVisible();

    await page.goto('/app/transactions');
    await expect(page.getByText(duplicateDescription, { exact: true })).toHaveCount(2);
    await page.goto('/app/dashboard');
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    const lowestAfterPayment = await lowestProjectedForAccount(page);
    expect(lowestAfterPayment - lowestBeforePayment).toBe(25);
    await page.screenshot({ path: `test-results/pilot-dashboard-configured-${test.info().project.name === 'Mobile Chrome' ? 'mobile' : 'desktop'}.png`, fullPage: true });

    await page.goto('/app/settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download my data' }).click();
    const download = await downloadPromise;
    const exportData = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(exportData.schemaVersion).toBe(1);
    expect(exportData.data.transactions.filter((row: { description?: string }) => row.description === duplicateDescription)).toHaveLength(2);
    expect(exportData.data.importBatches).toHaveLength(1);
    expect(exportData.data.goals).toHaveLength(1);
    expect(exportData.data.paydayPlan).toHaveLength(1);

    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Request deletion' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Deletion status: COMPLETED' })).toBeVisible({ timeout: 20_000 });
    authUserId = undefined; // The lifecycle endpoint already deleted the Auth user.
  } finally {
    if (authUserId) {
      const deleted = await admin.delete(`/auth/v1/admin/users/${encodeURIComponent(authUserId)}`);
      expect([200, 204, 404]).toContain(deleted.status());
    }
    await admin.dispose();
  }
});
