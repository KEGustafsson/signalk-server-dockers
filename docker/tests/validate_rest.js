const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3000';
const SK_SERVER = `${BASE_URL}/skServer`;
const API_BASE = `${BASE_URL}/signalk/v1/api`;
const AUTH_BASE = `${BASE_URL}/signalk/v1/auth`;
const WS_URL = 'ws://localhost:3000/signalk/v1/stream';

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'test123';
const TEST_POSITION = { latitude: 48.1173, longitude: 11.5167 };

async function createAdmin() {
  const r = await fetch(`${SK_SERVER}/enableSecurity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: ADMIN_USER, password: ADMIN_PASS, type: 'admin' }),
  });
  if (r.ok) return true;
  console.log(`  enableSecurity HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return false;
}

async function login() {
  const r = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  });
  if (r.ok) {
    const data = await r.json();
    return data.token;
  }
  console.log(`  login HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return null;
}

function sendPositionDelta(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?subscribe=none&token=${token}`);
    const timer = setTimeout(() => { ws.close(); reject(new Error('WebSocket timeout')); }, 10000);

    ws.on('message', (raw) => {
      const hello = JSON.parse(raw.toString());
      console.log(`  Connected (server: ${hello.name || 'unknown'})`);

      const delta = {
        context: 'vessels.self',
        updates: [{
          source: { label: 'pre-release-test' },
          timestamp: new Date().toISOString(),
          values: [{ path: 'navigation.position', value: TEST_POSITION }],
        }],
      };
      ws.send(JSON.stringify(delta));
      setTimeout(() => { clearTimeout(timer); ws.close(); resolve(true); }, 1000);
    });

    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

async function validatePosition(timeout = 10000) {
  const url = `${API_BASE}/vessels/self/navigation/position/value`;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        const data = await r.json();
        if (data.latitude != null && data.longitude != null) return data;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function main() {
  console.log('SignalK Pre-Release REST Validation');
  console.log('='.repeat(40));

  console.log('\n1. Creating admin account...');
  if (!(await createAdmin())) {
    console.log('FAIL: Could not create admin account');
    process.exit(1);
  }
  console.log('   OK');

  console.log('\n2. Logging in...');
  const token = await login();
  if (!token) {
    console.log('FAIL: Could not login');
    process.exit(1);
  }
  console.log('   OK');

  console.log('\n3. Sending position delta via WebSocket...');
  try {
    await sendPositionDelta(token);
  } catch (err) {
    console.log(`FAIL: Could not send delta: ${err.message}`);
    process.exit(1);
  }
  console.log('   OK');

  console.log('\n4. Validating position via REST API...');
  const value = await validatePosition();
  if (!value) {
    console.log('FAIL: Position not available in REST API');
    try {
      const r = await fetch(`${API_BASE}/vessels/self`, { signal: AbortSignal.timeout(5000) });
      console.log(`  /vessels/self -> HTTP ${r.status}`);
      console.log(`  ${(await r.text()).slice(0, 500)}`);
    } catch (e) {
      console.log(`  /vessels/self -> ${e.message}`);
    }
    process.exit(1);
  }

  const { latitude: lat, longitude: lon } = value;
  console.log(`   Position: lat=${lat}, lon=${lon}`);

  if (Math.abs(lat - TEST_POSITION.latitude) > 0.001 || Math.abs(lon - TEST_POSITION.longitude) > 0.001) {
    console.log(`FAIL: Position mismatch (expected ${JSON.stringify(TEST_POSITION)})`);
    process.exit(1);
  }

  console.log('\nREST validation PASSED');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
