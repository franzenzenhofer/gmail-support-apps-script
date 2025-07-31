/**
 * Comprehensive Test Suite - Tests ALL aspects
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🧪 Comprehensive Test Suite - Testing ALL Aspects\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, condition, errorMsg = '') {
  totalTests++;
  if (condition) {
    console.log(`✅ ${name}`);
    passedTests++;
  } else {
    console.log(`❌ ${name}: ${errorMsg}`);
    failedTests++;
  }
}

console.log('=== 1. SAFETY TESTS ===');
try {
  execSync('node tests/run-safety-tests.js', { stdio: 'inherit' });
  test('Safety tests', true);
} catch (error) {
  test('Safety tests', false, 'Safety tests failed');
}

console.log('\n=== 2. ARCHITECTURE TESTS ===');
try {
  const architectureOutput = execSync('node tests/architecture-tests.js', { encoding: 'utf8' });
  const violations = (architectureOutput.match(/❌/g) || []).length;
  test('Architecture DRY compliance', violations < 3, `${violations} violations found`);
} catch (error) {
  test('Architecture tests', false, 'Architecture tests failed');
}

console.log('\n=== 3. PERFORMANCE TESTS ===');
try {
  const perfOutput = execSync('node tests/performance-tests.js', { encoding: 'utf8' });
  const perfIssues = (perfOutput.match(/performance issues:/)[1] || '0').trim();
  test('Performance optimization', parseInt(perfIssues) < 3, `${perfIssues} performance issues`);
} catch (error) {
  test('Performance tests', false, 'Performance tests failed');
}

console.log('\n=== 4. SECURITY TESTS ===');
try {
  const secOutput = execSync('node tests/security-tests.js', { encoding: 'utf8' });
  const secIssues = (secOutput.match(/security issues:/)[1] || '0').trim();
  test('Security compliance', parseInt(secIssues) === 0, `${secIssues} security issues`);
} catch (error) {
  test('Security tests', false, 'Security tests failed');
}

console.log('\n=== 5. PROJECT STRUCTURE TESTS ===');
try {
  execSync('node tests/validate-project.js', { stdio: 'inherit' });
  test('Project structure', true);
} catch (error) {
  test('Project structure', false, 'Project validation failed');
}

console.log('\n=== 6. CODE QUALITY TESTS ===');

// File existence
test('BaseService exists', fs.existsSync('BaseService.gs'), 'Missing BaseService.gs');
test('SafetyConfig exists', fs.existsSync('SafetyConfig.gs'), 'Missing SafetyConfig.gs');
test('SafeEmailService exists', fs.existsSync('SafeEmailService.gs'), 'Missing SafeEmailService.gs');

// Configuration checks
if (fs.existsSync('SafetyConfig.gs')) {
  const safetyContent = fs.readFileSync('SafetyConfig.gs', 'utf8');
  test('DRAFT_MODE default true', safetyContent.includes('const DRAFT_MODE = true'));
  test('Test mode enabled', safetyContent.includes('testMode: true'));
  test('Email whitelist configured', safetyContent.includes('team@fullstackoptimization.com'));
}

// File count reasonable
const gsFiles = fs.readdirSync('.').filter(f => f.endsWith('.gs'));
test('Reasonable file count', gsFiles.length < 50, `${gsFiles.length} files is too many`);

console.log('\n=== 7. DEPLOYMENT READINESS ===');

// Package.json
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  test('NPM scripts defined', pkg.scripts && Object.keys(pkg.scripts).length >= 10);
  test('Dependencies defined', pkg.devDependencies && Object.keys(pkg.devDependencies).length >= 5);
}

// Documentation
test('Single deployment guide', fs.existsSync('DEPLOY.md'));
test('No duplicate deployment guides', 
  !fs.existsSync('DEPLOYMENT_GUIDE.md') || !fs.existsSync('deployment-guide.md'));

console.log('\n=== 8. BUSINESS LOGIC TESTS ===');

// Critical business files
const criticalFiles = [
  'ConfigService.gs',
  'EmailService.gs', 
  'AIService.gs',
  'TicketService.gs',
  'SafetyConfig.gs'
];

criticalFiles.forEach(file => {
  test(`${file} exists`, fs.existsSync(file));
});

// Safety mechanisms
test('Draft mode dashboard', fs.existsSync('DashboardWithSafety.html'));
test('Deploy script exists', fs.existsSync('deploy.js'));

console.log('\n=== 9. ERROR HANDLING TESTS ===');

// Check for proper error handling patterns
let errorHandlingCount = 0;
gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('try {') && content.includes('catch') && content.includes('handleError')) {
    errorHandlingCount++;
  }
});

test('Error handling implemented', errorHandlingCount >= 10, `Only ${errorHandlingCount} files have proper error handling`);

console.log('\n=== 10. INTEGRATION TESTS ===');

// Test the integration flow
try {
  execSync('node tests/integration-test.js', { stdio: 'pipe' });
  test('Integration flow', true);
} catch (error) {
  test('Integration flow', false, 'Integration test failed');
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('COMPREHENSIVE TEST SUMMARY');
console.log('='.repeat(50));
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests} ✅`);
console.log(`Failed: ${failedTests} ❌`);
console.log(`Success Rate: ${Math.round((passedTests/totalTests)*100)}%`);

if (failedTests === 0) {
  console.log('\n🎉 ALL TESTS PASSED! System is ready for deployment.');
  console.log('\n🚀 Next Steps:');
  console.log('1. Run: npm install');
  console.log('2. Run: npm run quickstart');
  console.log('3. System will deploy with DRAFT MODE enabled');
  console.log('4. Test with whitelisted email addresses');
  console.log('5. Monitor dashboard for safety indicators');
} else {
  console.log('\n❌ TESTS FAILED - Fix issues before deployment');
  console.log('\nCritical issues that must be fixed:');
  console.log('- Ensure DRAFT_MODE is enabled');
  console.log('- Fix all security vulnerabilities');
  console.log('- Implement proper error handling');
  console.log('- Add missing authentication checks');
  process.exit(1);
}

console.log('\n⚠️  SAFETY REMINDER: System always starts in DRAFT MODE!');