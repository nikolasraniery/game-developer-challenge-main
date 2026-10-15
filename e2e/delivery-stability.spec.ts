import { expect, test } from '@playwright/test';

async function startGame(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Jogar' }).click();
  await expect(page.getByText('PixiJS ready')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hud-time')).toHaveText('01:00');
}

test.describe('delivery stability', () => {
  test('keeps the menu visual baseline stable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Menu principal' })).toBeVisible();
    await page.mouse.move(0, 0);
    await page.getByRole('button', { name: 'Jogar' }).focus();
    await expect(page).toHaveScreenshot('main-menu.png', {
      animations: 'disabled',
      fullPage: true,
      timeout: 15_000,
    });
  });

  test('keeps the initial arena visual baseline stable', async ({ page }) => {
    await page.goto('/');
    await startGame(page);
    await page.keyboard.press('p');
    await expect(page.getByTestId('game-state')).toHaveText('paused');
    await expect(page).toHaveScreenshot('initial-arena.png', {
      animations: 'disabled',
      fullPage: true,
      timeout: 15_000,
      maxDiffPixels: 20,
    });
  });

  test('freezes the visible timer during pause and resumes from that time', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-15T12:00:00.000Z') });
    await page.goto('/');
    await startGame(page);

    await page.keyboard.press('p');
    await expect(page.getByTestId('game-state')).toHaveText('paused');
    const pausedTime = await page.getByTestId('hud-time').innerText();
    await page.clock.runFor(5_000);
    await expect(page.getByTestId('hud-time')).toHaveText(pausedTime);

    await page.keyboard.press('p');
    await expect(page.getByTestId('game-state')).toHaveText('playing');
    await page.clock.runFor(2_000);
    await expect(page.getByTestId('hud-time')).not.toHaveText(pausedTime);
  });

  test('records a defeated match once and can restart cleanly', async ({ page }) => {
    test.setTimeout(90_000);
    await page.clock.install({ time: new Date('2026-10-15T12:00:00.000Z') });
    await page.goto('/');
    await startGame(page);

    await page.clock.runFor(61_000);
    await expect(page.getByText('Fim de jogo!')).toBeVisible();
    await expect(page.getByTestId('game-state')).toHaveText('gameOver');
    await expect(page.getByTestId('match-submission-status')).toHaveText('Resultado registrado');
    await expect(page.getByTestId('hud-score')).toHaveText('0');
    const endedTime = await page.getByTestId('hud-time').innerText();
    await page.clock.runFor(2_000);
    await expect(page.getByTestId('hud-time')).toHaveText(endedTime);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const records = JSON.parse(localStorage.getItem('pirate-battle-match-records') ?? '[]');
          return records.length;
        }),
      )
      .toBe(1);
    await page.addStyleTag({
      content: '.game-result-copy > span:nth-of-type(2) { visibility: hidden; }',
    });
    await page.mouse.move(0, 0);
    await expect(page.locator('.game-result-actions')).toHaveScreenshot('match-result.png', {
      animations: 'disabled',
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Jogar novamente' }).click();
    await expect(page.getByText('PixiJS ready')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('game-state')).toHaveText('playing');
    await expect(page.getByTestId('hud-health')).toHaveText('5');
    await expect(page.getByTestId('hud-score')).toHaveText('0');
    await expect(page.getByTestId('hud-time')).toHaveText('01:00');
    await expect(page.locator('canvas.arena-canvas')).toHaveCount(1);
  });
});
