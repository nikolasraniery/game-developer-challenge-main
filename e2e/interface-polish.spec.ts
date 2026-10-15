import { expect, test } from '@playwright/test';

test('fullscreen can be enabled before play and Space does not activate its button', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let fullscreenElement: Element | null = null;
    let fullscreenRequests = 0;

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });

    HTMLElement.prototype.requestFullscreen = async () => {
      fullscreenElement =
        fullscreenRequests++ === 0
          ? document.querySelector('.page-shell')
          : document.querySelector('[data-testid="arena-container"]');
      document.dispatchEvent(new Event('fullscreenchange'));
    };

    document.exitFullscreen = async () => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
  });

  await page.goto('/');

  const menuFullscreenButton = page.getByRole('button', { name: 'Tela cheia' });
  await expect(menuFullscreenButton).toBeVisible();
  await menuFullscreenButton.click();
  await expect(page.getByRole('button', { name: 'Sair da tela cheia' })).toBeVisible();

  await page.getByRole('button', { name: 'Jogar' }).click();
  await expect(page.getByText('PixiJS ready')).toBeVisible({ timeout: 15_000 });
  const arenaFullscreenButton = page.getByRole('button', { name: 'Sair da tela cheia' });
  await expect(arenaFullscreenButton).toBeVisible();

  // Space is a gameplay control and must not activate a focused fullscreen button.
  await arenaFullscreenButton.focus();
  await page.keyboard.press('Space');
  await expect(arenaFullscreenButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Sair da tela cheia' })).toBeVisible();

  await arenaFullscreenButton.click();
  await expect(page.getByRole('button', { name: 'Tela cheia' })).toBeVisible();
  await page.getByRole('button', { name: 'Tela cheia' }).click();
  const inGameFullscreenButton = page.getByRole('button', { name: 'Sair da tela cheia' });
  await expect(inGameFullscreenButton).toBeVisible();
  await inGameFullscreenButton.focus();
  await page.keyboard.press('Space');
  await expect(inGameFullscreenButton).toHaveAttribute('aria-pressed', 'true');
});
