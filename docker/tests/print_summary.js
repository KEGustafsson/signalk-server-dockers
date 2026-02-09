const fs = require('fs');

const files = ['test-results-rest.json', 'test-results-ui.json'];
const sections = [];

for (const file of files) {
  try {
    sections.push(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    sections.push({ section: file.replace('test-results-', '').replace('.json', ''), elapsed: '?', results: [{ area: 'Test did not complete', status: 'FAIL' }] });
  }
}

let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;

console.log('');
console.log('='.repeat(60));
console.log('  SIGNALK PRE-RELEASE TEST SUMMARY');
console.log('='.repeat(60));

for (const { section, elapsed, results } of sections) {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  totalPassed += passed;
  totalFailed += failed;
  totalTests += results.length;

  console.log('');
  console.log(`  ${section} (${elapsed}s)`);
  console.log('  ' + '-'.repeat(56));
  for (const { area, status, ms } of results) {
    const time = ms != null ? ` (${ms}ms)` : '';
    console.log(`    [${status}] ${area}${time}`);
  }
}

console.log('');
console.log('='.repeat(60));
const overall = totalFailed === 0 ? 'ALL TESTS PASSED' : `${totalFailed} TEST(S) FAILED`;
console.log(`  ${overall} | Total: ${totalTests} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
console.log('='.repeat(60));
console.log('');

if (totalFailed > 0) process.exit(1);
