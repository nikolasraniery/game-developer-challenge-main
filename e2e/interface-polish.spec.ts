import { expect, test } from '@playwright/test';

test('fullscreen targets only the arena and Space does not toggle its button', async ({ page }) => {
  await page.addInitScript(() => {
    let fullscreenElement: Element | null = null;

    const changeFullscreenElement = (element: Element | null) => {
      fullscreenElement = element;
      document.dispatchEvent(new Event('fullscreenchange'));
    };

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });

    HTMLElement.prototype.requestFullscreen = async function requestFullscreen(this: HTMLElement) {
      changeFullscreenElement(this);
    };

    document.exitFullscreen = async () => changeFullscreenElement(null);
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Menu principal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tela cheia' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Jogar' }).click();
  await expect(page.getByText('PixiJS ready')).toBeVisible({ timeout: 15_000 });

  const fullscreenButton = page.getByRole('button', { name: 'Tela cheia' });
  const arena = page.getByTestId('arena-container');
  await expect(fullscreenButton).toBeVisible();
  await fullscreenButton.click();

  await expect(page.getByRole('button', { name: 'Sair da tela cheia' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(() => arena.evaluate((element) => document.fullscreenElement === element))
    .toBe(true);

  const exitFullscreenButton = page.getByRole('button', { name: 'Sair da tela cheia' });
  await exitFullscreenButton.focus();
  await page.keyboard.press('Space');
  await expect(exitFullscreenButton).toHaveAttribute('aria-pressed', 'true');

  await exitFullscreenButton.click();
  await expect(page.getByRole('button', { name: 'Tela cheia' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
});
