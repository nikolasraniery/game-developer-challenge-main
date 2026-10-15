import { expect, test } from '@playwright/test';

async function startGame(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Jogar' }).click();
  await expect(page.getByText('PixiJS ready')).toBeVisible({ timeout: 15_000 });
}

test.describe('Pirate Battle', () => {
  test('abre no menu sem inicializar uma arena escondida', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Menu principal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jogar' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas.arena-canvas')).toHaveCount(0);
  });

  test('abre e fecha as instruções dos controles', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Controles' }).click();

    await expect(page.getByRole('heading', { name: 'Controles' })).toBeVisible();
    await expect(page.getByText('Disparo frontal')).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao menu' }).click();
    await expect(page.getByRole('heading', { name: 'Menu principal' })).toBeVisible();
  });

  test('permite iniciar por teclado com foco visível no botão Jogar', async ({ page }) => {
    await page.goto('/');
    const playButton = page.getByRole('button', { name: 'Jogar' });
    await playButton.focus();
    await expect(playButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('PixiJS ready')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas.arena-canvas')).toBeVisible();
  });

  test('persiste a duração escolhida e a utiliza na partida seguinte', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.getByRole('button', { name: 'Configurações' }).click();

    const duration = page.getByLabel('Duração da partida');
    await duration.focus();
    await duration.press('End');
    const durationValue = page.locator('output[for="match-duration"]');
    await expect(durationValue).toHaveText('180 segundos');
    await page.reload();

    await page.getByRole('button', { name: 'Configurações' }).click();
    await expect(page.locator('output[for="match-duration"]')).toHaveText('180 segundos');
    await page.getByRole('button', { name: 'Voltar ao menu' }).click();
    await startGame(page);
    const displayedTime = await page.getByTestId('hud-time').innerText();
    const [minutes, seconds] = displayedTime.split(':').map(Number);
    const remainingSeconds = (minutes ?? 0) * 60 + (seconds ?? 0);
    expect(remainingSeconds).toBeGreaterThan(150);
    expect(remainingSeconds).toBeLessThanOrEqual(180);
  });

  test('abre a aplicação e renderiza a arena PixiJS', async ({ page }) => {
    const pageErrors: string[] = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto('/');
    await startGame(page);

    await expect(page.getByRole('heading', { name: /game arena/i })).toBeVisible();

    const canvas = page.locator('canvas.arena-canvas');

    await expect(canvas).toBeVisible();
    await expect(page.getByText('PixiJS ready')).toBeVisible();

    const dimensions = await canvas.evaluate((element) => ({
      width: element.clientWidth,
      height: element.clientHeight,
    }));

    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  test('aceita controles de teclado sem derrubar a arena', async ({ page }) => {
    const pageErrors: string[] = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto('/');
    await startGame(page);

    const canvas = page.locator('canvas.arena-canvas');

    await expect(canvas).toBeVisible();
    await expect(page.getByText('PixiJS ready')).toBeVisible();

    // Movimento e rotação.
    await page.keyboard.down('ArrowUp');
    await page.keyboard.up('ArrowUp');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');

    // Disparo frontal.
    await page.keyboard.press('Space');

    // Disparos laterais.
    await page.keyboard.down('q');
    await page.keyboard.up('q');

    await page.keyboard.down('e');
    await page.keyboard.up('e');

    // Pausa e retomada.
    await page.keyboard.press('p');
    await page.keyboard.press('p');

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await expect(canvas).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('pausa e resume o jogo utilizando o teclado', async ({ page }) => {
    await page.goto('/');
    await startGame(page);

    const canvas = page.locator('canvas.arena-canvas');
    const gameState = page.getByTestId('game-state');

    await expect(canvas).toBeVisible();
    await expect(gameState).toHaveText('playing');

    await page.keyboard.press('p');
    await expect(gameState).toHaveText('paused');

    await page.keyboard.press('p');
    await expect(gameState).toHaveText('playing');

    await page.keyboard.press('Escape');
    await expect(gameState).toHaveText('paused');

    await page.keyboard.press('Escape');
    await expect(gameState).toHaveText('playing');
  });

  test('mantém uma única arena utilizável ao redimensionar a janela', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await startGame(page);

    const canvas = page.locator('canvas.arena-canvas');
    await expect(canvas).toBeVisible();

    await page.setViewportSize({ width: 900, height: 700 });
    await expect(canvas).toBeVisible();

    const dimensions = await canvas.evaluate((element) => ({
      width: element.clientWidth,
      height: element.clientHeight,
    }));

    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
    await expect(page.locator('canvas.arena-canvas')).toHaveCount(1);
    expect(pageErrors).toEqual([]);
  });

  test('mantém menu e controles de toque utilizáveis em viewport móvel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Jogar' })).toBeVisible();
    await startGame(page);
    await expect(page.locator('canvas.arena-canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mover para frente' })).toBeVisible();
    await expect(page.locator('canvas.arena-canvas')).toHaveCount(1);
  });

  test('consulta ranking paginado, histórico e recupera erros das consultas', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ranking' }).click();
    await expect(page.getByRole('heading', { name: 'Ranking' })).toBeVisible();
    await expect(page.getByText('Ada', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByText('Mia', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao menu' }).click();
    await page.getByRole('button', { name: 'Histórico' }).click();
    await expect(page.getByText('Nenhuma partida registrada nesta página.')).toBeVisible();

    await page.getByLabel('Cenário de rede (MSW)').selectOption('history-error');
    await expect(page.getByRole('alert')).toContainText('O jogo continua disponível');
  });

  test('recupera um registro pendente após refresh sem duplicar o resultado', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'pirate-battle-match-records',
        JSON.stringify([
          {
            id: 'e2e-pending-match',
            playerId: 'local-captain',
            completedAt: '2026-10-15T12:00:00.000Z',
            score: 2,
            configuredDurationSeconds: 60,
            durationPlayedSeconds: 35,
            endReason: 'player-defeated',
            configuration: { durationSeconds: 60, spawnIntervalSeconds: 4 },
            submissionState: 'pending',
          },
        ]),
      );
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Histórico' }).click();
    await expect(page.getByText('2 pts', { exact: true })).toBeVisible();
    await expect
      .poll(async () => {
        const stored = await page.evaluate(() =>
          JSON.parse(localStorage.getItem('pirate-battle-match-records') ?? '[]'),
        );
        return stored[0].submissionState as string;
      })
      .toBe('confirmed');

    await page.reload();
    await page.getByRole('button', { name: 'Histórico' }).click();
    await expect(page.getByText('2 pts', { exact: true })).toHaveCount(1);
  });
});

test.describe('API failure handling', () => {
  test.use({ serviceWorkers: 'block' });

  test('keeps gameplay available when the optional demo-status endpoint fails', async ({
    page,
  }) => {
    let demoStatusRequested = false;
    await page.route('**/api/demo-status', (route) => {
      demoStatusRequested = true;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Service unavailable' }),
      });
    });

    await page.goto('/');
    await startGame(page);
    await expect(page.locator('canvas.arena-canvas')).toBeVisible();
    expect(demoStatusRequested).toBe(false);
  });
});
