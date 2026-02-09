const { test, expect } = require('@playwright/test');

test.describe('SignalK Admin UI', () => {

  test.beforeEach(async ({ page, context }) => {
    // Login via API (admin created by validate_rest.js) and set JWT cookie
    const res = await fetch('http://localhost:3000/signalk/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'test123' }),
    });

    if (!res.ok) {
      throw new Error(`Login API failed: HTTP ${res.status}`);
    }

    const { token } = await res.json();

    await context.addCookies([{
      name: 'JAUTHENTICATION',
      value: token,
      url: 'http://localhost:3000',
    }]);

    // Navigate to admin UI already authenticated
    await page.goto('/admin/');
    await expect(page.locator('text=Server')).toBeVisible({ timeout: 15000 });
  });

  test('Login works', async ({ page }) => {
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
    await page.click('text=Data Browser');
    await expect(page.locator('text=navigation')).toBeVisible({ timeout: 10000 });
  });

  test('Verify WebSocket connection', async ({ page }) => {
    const result = await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://localhost:3000/signalk/v1/stream?subscribe=all');
        ws.onmessage = msg => {
          const data = JSON.parse(msg.data);
          // SignalK hello message contains self and roles
          if (data.self && data.roles) {
            ws.close();
            resolve({ type: 'hello', self: data.self });
            return;
          }
          // SignalK delta message contains context and updates
          if (data.context && data.updates) {
            ws.close();
            resolve({ type: 'delta', context: data.context });
            return;
          }
        };
        setTimeout(() => reject('No WS data within 10s'), 10000);
      });
    });
    expect(result).toBeTruthy();
    expect(result.type).toBeTruthy();
  });

});
