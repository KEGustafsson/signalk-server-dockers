const { test, expect } = require('@playwright/test');

test.describe('SignalK Admin UI', () => {

  test('Create admin account and login', async ({ page }) => {
    await page.goto('/admin');

    // Initial setup page (first boot)
    if (await page.locator('text=Create Admin User').isVisible()) {
      await page.fill('input[name=username]', 'admin');
      await page.fill('input[name=password]', 'test123');
      await page.fill('input[name=confirmPassword]', 'test123');
      await page.click('button:has-text("Create")');
    }

    await page.fill('input[name=username]', 'admin');
    await page.fill('input[name=password]', 'test123');
    await page.click('button:has-text("Login")');

    await expect(page.locator('text=Server')).toBeVisible();
  });

  test('Browse all Admin UI pages', async ({ page }) => {
    const pages = [
      'Server',
      'Data Browser',
      'Vessels',
      'Plugins',
      'Webapps',
      'Users',
      'Security',
      'Logs'
    ];

    for (const name of pages) {
      await page.click(`text=${name}`);
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('Verify live vessel data visible', async ({ page }) => {
    await page.click('text=Vessels');
    await expect(page.locator('text=Navigation')).toBeVisible();
  });

  test('Verify WebSocket deltas', async ({ page }) => {
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:3000/signalk/v1/stream?subscribe=all');
        ws.onmessage = msg => {
          const data = JSON.parse(msg.data);
          if (data.vessels && data.vessels.self) {
            ws.close();
            resolve(true);
          }
        };
        setTimeout(() => reject('No WS data'), 10000);
      });
    });
  });

});
