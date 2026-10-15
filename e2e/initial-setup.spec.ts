import { expect, test } from '@playwright/test';

test('renders the menu art and loads ranking data from the production mock', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Pirate Battle' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Menu principal' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Jungle Gaming' })).toBeVisible();
  await expect(page.locator('.api-card')).toHaveCount(0);

  await page.getByRole('button', { name: 'Ranking' }).click();
  await expect(page.getByText('Ada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar ao menu' }).click();

  await page.getByRole('button', { name: 'Jogar' }).click();
  await expect(page.getByRole('heading', { name: 'Game arena' })).toBeVisible();
  await expect(page.locator('canvas[aria-label="Pirate Battle game arena"]')).toBeVisible();
  await expect(page.getByText('PixiJS ready')).toBeVisible();
  await expect(page.getByTestId('hud-health')).toHaveText('5');
  await expect(page.getByTestId('hud-score')).toHaveText('0');
  await expect(page.getByTestId('hud-time')).toHaveText('01:00');
});
