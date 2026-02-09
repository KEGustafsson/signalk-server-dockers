const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3000';
const SK_SERVER = `${BASE_URL}/skServer`;
const API_BASE = `${BASE_URL}/signalk/v1/api`;
const AUTH_BASE = `${BASE_URL}/signalk/v1/auth`;
const WS_URL = 'ws://localhost:3000/signalk/v1/stream';

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'test123';

// NMEA 0183 style: position from GPS
const NMEA0183_DATA = [
  { path: 'navigation.position', value: { latitude: 48.1173, longitude: 11.5167 } },
  { path: 'navigation.courseOverGroundTrue', value: 1.4748 },   // ~84.5 deg
  { path: 'navigation.speedOverGround', value: 11.524 },       // ~22.4 knots in m/s
];

// NMEA 2000 style: engine, depth, wind from N2K bus
const NMEA2000_DATA = [
  { path: 'environment.depth.belowTransducer', value: 23.4 },  // PGN 128267
  { path: 'environment.wind.speedApparent', value: 7.7 },      // PGN 130306
  { path: 'environment.wind.angleApparent', value: 0.785 },    // ~45 deg in rad
  { path: 'propulsion.main.revolutions', value: 41.67 },       // ~2500 RPM in rev/s, PGN 127488
  { path: 'electrical.batteries.main.voltage', value: 12.8 },  // PGN 127508
];

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

function sendDeltas(token, sourceLabel, values) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?subscribe=none&token=${token}`);
    const timer = setTimeout(() => { ws.close(); reject(new Error('WebSocket timeout')); }, 10000);

    ws.on('message', (raw) => {
      const hello = JSON.parse(raw.toString());
      console.log(`  Connected (server: ${hello.name || 'unknown'})`);

      const delta = {
        context: 'vessels.self',
        updates: [{
          source: { label: sourceLabel },
          timestamp: new Date().toISOString(),
          values,
        }],
      };
      ws.send(JSON.stringify(delta));
      setTimeout(() => { clearTimeout(timer); ws.close(); resolve(true); }, 1000);
    });

    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

async function validatePath(path, timeout = 10000) {
  const url = `${API_BASE}/vessels/self/${path.replace(/\./g, '/')}/value`;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        const data = await r.json();
        if (data != null) return data;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

function checkValue(actual, expected, label) {
  if (typeof expected === 'object') {
    for (const [key, val] of Object.entries(expected)) {
      if (actual[key] == null || Math.abs(actual[key] - val) > 0.001) {
        console.log(`  FAIL: ${label}.${key} = ${actual[key]}, expected ${val}`);
        return false;
      }
    }
  } else {
    if (actual == null || Math.abs(actual - expected) > 0.01) {
      console.log(`  FAIL: ${label} = ${actual}, expected ${expected}`);
      return false;
    }
  }
  return true;
}

async function main() {
  console.log('SignalK Pre-Release REST Validation');
  console.log('='.repeat(40));

  // Step 1: Create admin
  console.log('\n1. Creating admin account...');
  if (!(await createAdmin())) {
    console.log('FAIL: Could not create admin account');
    process.exit(1);
  }
  console.log('   OK');

  // Step 2: Login
  console.log('\n2. Logging in...');
  const token = await login();
  if (!token) {
    console.log('FAIL: Could not login');
    process.exit(1);
  }
  console.log('   OK');

  // Step 3: Send NMEA 0183 data (GPS position, COG, SOG)
  console.log('\n3. Sending NMEA 0183 data via WebSocket...');
  try {
    await sendDeltas(token, 'nmea0183-test', NMEA0183_DATA);
  } catch (err) {
    console.log(`FAIL: Could not send NMEA 0183 delta: ${err.message}`);
    process.exit(1);
  }
  console.log('   OK');

  // Step 4: Send NMEA 2000 data (depth, wind, engine, battery)
  console.log('\n4. Sending NMEA 2000 data via WebSocket...');
  try {
    await sendDeltas(token, 'nmea2000-test', NMEA2000_DATA);
  } catch (err) {
    console.log(`FAIL: Could not send NMEA 2000 delta: ${err.message}`);
    process.exit(1);
  }
  console.log('   OK');

  // Step 5: Validate all data via REST API
  console.log('\n5. Validating all data via REST API...');
  const allData = [...NMEA0183_DATA, ...NMEA2000_DATA];
  let passed = 0;

  for (const { path, value } of allData) {
    const actual = await validatePath(path);
    if (actual == null) {
      console.log(`  FAIL: ${path} not available`);
      process.exit(1);
    }
    if (!checkValue(actual, value, path)) {
      process.exit(1);
    }
    console.log(`  OK: ${path}`);
    passed++;
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`REST validation PASSED (${passed}/${allData.length} paths verified)`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
