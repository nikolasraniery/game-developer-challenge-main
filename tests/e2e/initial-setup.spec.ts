import { expect, test } from '@playwright/test';

test('renders the supplied arena art and receives the mocked API response', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Arena preview' })).toBeVisible();
  await expect(
    page.locator('canvas[aria-label="Static Pirate Battle arena preview"]'),
  ).toBeVisible();
  await expect(page.getByText('PixiJS ready')).toBeVisible();
  await expect(
    page.getByText('The sample API is responding through the browser mock.'),
  ).toBeVisible();
});
