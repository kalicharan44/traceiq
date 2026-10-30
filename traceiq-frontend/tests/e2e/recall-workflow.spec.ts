import { expect, test } from '@playwright/test';

test('theme switcher toggles and remembers both appearances', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('document intake follows bulk and single upload modes with a reviewable file queue', async ({ page }) => {
  await page.goto('/documents');
  await expect(page.getByRole('heading', { name: 'Document intake & review' })).toBeVisible();
  await expect(page.getByText('Nothing matches this filter', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Bulk upload' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Upload workflow' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({ name: 'supplier-invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sample') });
  await expect(page.getByText('supplier-invoice.pdf', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload 1 document' })).toBeEnabled();

  await page.getByRole('tab', { name: 'Single document' }).click();
  await expect(page.getByRole('tab', { name: 'Single document' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('supplier-invoice.pdf', { exact: true })).toBeVisible();
});

test('executive dashboard previews demo data and switches to API data for operational use', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Supply Chain Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Overview' })).toHaveClass(/bg-teal-600/);
  const appBarHeights = await page.evaluate(() => ({
    main: document.querySelector('header.sticky')?.getBoundingClientRect().height,
    sidebar: document.querySelector('aside > div')?.getBoundingClientRect().height,
  }));
  expect(appBarHeights.main).toBe(appBarHeights.sidebar);
  await expect(page.getByRole('heading', { name: 'Supply Chain Overview', exact: true })).toHaveCount(1);
  await expect(page.locator('header.sticky').getByText('Supply Chain Overview', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Switch to Live data', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Demo preview · illustrative sample data, not live operational records.')).toBeVisible();
  await expect(page.getByText('472 active supplier records')).toBeVisible();
  await expect(page.getByText('10,000')).toBeVisible();
  await page.getByRole('button', { name: 'Live data', exact: true }).click();
  await expect(page.getByText('3 active supplier records')).toBeVisible();
  const kpiRegion = page.getByRole('region', { name: 'Executive key performance indicators' });
  await expect(kpiRegion.getByRole('button')).toHaveCount(3);
  await expect(kpiRegion.getByText('Tracked lots')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operational throughput' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Document pipeline' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inventory posture' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recall response' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Dashboard date range' }).selectOption('7d');
  await expect(page.getByRole('combobox', { name: 'Dashboard date range' })).toHaveValue('7d');
  await expect(page.getByRole('heading', { name: 'Operational activity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Risk & exceptions' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(kpiRegion).toBeVisible();
  const mobileHasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(mobileHasHorizontalOverflow).toBe(false);
  await page.getByRole('button', { name: /Critical validation failures/ }).click();
  await expect(page).toHaveURL(/\/validation$/);
  await expect(page.getByRole('heading', { name: 'Validation center' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('recall scope is reviewed and requires a named human approval before activation', async ({ page }) => {
  await page.goto('/recalls');
  await expect(page.getByRole('heading', { name: 'Recall command center', exact: true })).toBeVisible();
  await expect(page.getByText('Affected finished units', { exact: true })).toBeVisible();
  await expect(page.getByText(/is active/)).toHaveCount(0);

  const target = page.getByLabel('Target lot ID');
  await expect(target).toHaveValue('RAW-1042');
  await expect(page.getByRole('button', { name: 'Approve & activate recall' })).toBeEnabled();

  await page.getByLabel('Approving person').fill('E2E Quality Director');
  await page.getByRole('button', { name: 'Approve & activate recall' }).click();

  await expect(page.getByText(/^RCL-[A-F0-9]+ is active$/)).toBeVisible();
  await expect(page.getByText(/Approved by E2E Quality Director/)).toBeVisible();
  await expect(page.getByText('QUARANTINE INVENTORY').first()).toBeVisible();
  await expect(page.getByText('HOLD SHIPMENT').first()).toBeVisible();
});
