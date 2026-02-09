const { test, expect } = require('@playwright/test');

test.describe('SignalK Admin UI', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // If first boot, create admin account
    const createVisible = await page.locator('text=Create Admin User')
      .isVisible()
      .catch(() => false);
    if (createVisible) {
      await page.fill('input[name=username]', 'admin');
      await page.fill('input[name=password]', 'test123');
      await page.fill('input[name=confirmPassword]', 'test123');
      await page.click('button:has-text("Create")');
      await page.waitForLoadState('networkidle');
    }

    // Login
    const loginVisible = await page.locator('button:has-text("Login")')
      .isVisible()
      .catch(() => false);
    if (loginVisible) {
      await page.fill('input[name=username]', 'admin');
      await page.fill('input[name=password]', 'test123');
      await page.click('button:has-text("Login")');
    }

    await expect(page.locator('text=Server')).toBeVisible({ timeout: 10000 });
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
