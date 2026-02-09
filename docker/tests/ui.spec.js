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
    // Wait for sidebar nav links to confirm dashboard has loaded
    await expect(page.locator('a.nav-link').first()).toBeVisible({ timeout: 15000 });
  });

  test('Login works', async ({ page }) => {
    await expect(page.locator('a.nav-link').first()).toBeVisible();
  });

  test('Browse all Admin UI pages', async ({ page }) => {
    // Dynamically discover and click all sidebar nav links.
    // Multiple passes handle dropdown toggles that reveal sub-items.
    const clicked = new Set();
    for (let pass = 0; pass < 3; pass++) {
      const links = page.locator('a.nav-link');
      const count = await links.count();
      let clickedNew = false;
      for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        if (!(await link.isVisible())) continue;
        const key = (await link.getAttribute('href')) || (await link.textContent());
        if (clicked.has(key)) continue;
        clicked.add(key);
        // Sidebar overflows viewport; use native DOM click to bypass
        // Playwright viewport and pointer-interception checks.
        await link.evaluate(el => el.click());
        await expect(page.locator('a.nav-link').first()).toBeVisible();
        clickedNew = true;
      }
      if (!clickedNew) break;
    }
    // Ensure we actually browsed multiple pages
    expect(clicked.size).toBeGreaterThanOrEqual(3);
  });

  test('Verify live vessel data visible', async ({ page }) => {
    await page.locator('a.nav-link:has-text("Data Browser")').first().click();
    await expect(page.locator('text=navigation').first()).toBeVisible({ timeout: 10000 });
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
