const { test, expect } = require('@playwright/test');

// Track results for summary
const results = [];
const suiteStart = Date.now();

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
    const start = Date.now();
    await expect(page.locator('a.nav-link').first()).toBeVisible();
    results.push({ area: 'Login (JWT cookie auth)', status: 'PASS', ms: Date.now() - start });
  });

  test('Browse all Admin UI pages', async ({ page }) => {
    // Navigate to each admin UI route directly via hash routing.
    // Routes sourced from signalk-server packages/server-admin-ui/src.
    const routes = [
      { path: '/dashboard', title: 'Dashboard' },
      { path: '/webapps', title: 'Webapps' },
      { path: '/databrowser', title: 'Data Browser' },
      { path: '/appstore', title: 'Appstore' },
      { path: '/serverConfiguration/settings', title: 'Settings' },
      { path: '/serverConfiguration/connections/-', title: 'Data Connections' },
      { path: '/serverConfiguration/plugins/-', title: 'Plugin Config' },
      { path: '/serverConfiguration/log', title: 'Server Logs' },
      { path: '/security/settings', title: 'Security Settings' },
      { path: '/security/users', title: 'Users' },
      { path: '/documentation', title: 'Documentation' },
    ];

    for (const { path, title } of routes) {
      const start = Date.now();
      await page.goto(`/admin/#${path}`);
      // Verify the page rendered without crashing (sidebar still present)
      await expect(page.locator('.sidebar-nav').first()).toBeVisible({ timeout: 5000 });
      const ms = Date.now() - start;
      results.push({ area: `Page: ${title} (${path})`, status: 'PASS', ms });
      console.log(`  ${title} (${path}) - OK (${ms}ms)`);
    }
  });

  test('Verify live vessel data visible', async ({ page }) => {
    const start = Date.now();
    await page.locator('a.nav-link:has-text("Data Browser")').first().click();
    await expect(page.locator('text=navigation').first()).toBeVisible({ timeout: 10000 });
    results.push({ area: 'Live vessel data in Data Browser', status: 'PASS', ms: Date.now() - start });
  });

  test('Verify WebSocket connection', async ({ page }) => {
    const start = Date.now();
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
    results.push({ area: `WebSocket stream (${result.type} message)`, status: 'PASS', ms: Date.now() - start });
  });

  test.afterAll(() => {
    const elapsed = ((Date.now() - suiteStart) / 1000).toFixed(1);
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    console.log('\n' + '='.repeat(50));
    console.log('  UI TEST SUMMARY');
    console.log('='.repeat(50));
    for (const { area, status, ms } of results) {
      const time = ms != null ? ` (${ms}ms)` : '';
      console.log(`  [${status}] ${area}${time}`);
    }
    console.log('-'.repeat(50));
    console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Time: ${elapsed}s`);
    console.log('='.repeat(50));
  });

});
