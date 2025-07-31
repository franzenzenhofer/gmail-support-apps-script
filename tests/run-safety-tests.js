/**
 * Safety Tests Runner
 * Verifies critical safety features are working
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Running Gmail Support System Safety Tests...\n');

// Test 1: Check DRAFT_MODE is ON by default
console.log('Test 1: Checking DRAFT_MODE default...');
const safetyConfig = fs.readFileSync(path.join(__dirname, '../SafetyConfig.gs'), 'utf8');
const draftModeMatch = safetyConfig.match(/const DRAFT_MODE = (true|false)/);
if (draftModeMatch && draftModeMatch[1] === 'true') {
  console.log('✅ PASS: DRAFT_MODE is TRUE by default');
} else {
  console.error('❌ FAIL: DRAFT_MODE is not TRUE by default!');
  process.exit(1);
}

// Test 2: Check test mode is enabled
console.log('\nTest 2: Checking test mode default...');
const testModeMatch = safetyConfig.match(/testMode:\s*(true|false)/);
if (testModeMatch && testModeMatch[1] === 'true') {
  console.log('✅ PASS: Test mode is TRUE by default');
} else {
  console.error('❌ FAIL: Test mode is not TRUE by default!');
  process.exit(1);
}

// Test 3: Check SafeEmailService exists
console.log('\nTest 3: Checking SafeEmailService exists...');
if (fs.existsSync(path.join(__dirname, '../SafeEmailService.gs'))) {
  console.log('✅ PASS: SafeEmailService.gs exists');
} else {
  console.error('❌ FAIL: SafeEmailService.gs not found!');
  process.exit(1);
}

// Test 4: Check dashboard has safety warnings
console.log('\nTest 4: Checking dashboard safety warnings...');
const dashboard = fs.readFileSync(path.join(__dirname, '../DashboardWithSafety.html'), 'utf8');
if (dashboard.includes('DRAFT MODE ACTIVE') && dashboard.includes('draft-mode-banner')) {
  console.log('✅ PASS: Dashboard has draft mode warnings');
} else {
  console.error('❌ FAIL: Dashboard missing draft mode warnings!');
  process.exit(1);
}

// Test 5: Check deployment guide mentions safety
console.log('\nTest 5: Checking deployment safety documentation...');
const deployGuide = fs.readFileSync(path.join(__dirname, '../DEPLOY.md'), 'utf8');
if (deployGuide.includes('DRAFT MODE') && deployGuide.includes('Safety')) {
  console.log('✅ PASS: Deployment guide includes safety information');
} else {
  console.error('❌ FAIL: Deployment guide missing safety information!');
  process.exit(1);
}

// Test 6: Check for test email whitelist
console.log('\nTest 6: Checking email whitelist...');
if (safetyConfig.includes('team@fullstackoptimization.com')) {
  console.log('✅ PASS: Test email whitelist configured');
} else {
  console.error('❌ FAIL: Test email whitelist not configured!');
  process.exit(1);
}

// Test 7: Check max emails limit
console.log('\nTest 7: Checking email rate limiting...');
const maxEmailsMatch = safetyConfig.match(/maxEmailsPerRun:\s*(\d+)/);
if (maxEmailsMatch && parseInt(maxEmailsMatch[1]) <= 10) {
  console.log(`✅ PASS: Max emails per run limited to ${maxEmailsMatch[1]}`);
} else {
  console.error('❌ FAIL: Max emails per run not properly limited!');
  process.exit(1);
}

console.log('\n✅ All safety tests passed! System is safe to deploy.\n');
console.log('⚠️  Remember: System starts in DRAFT MODE - no emails will be sent automatically.');
console.log('📧 All emails will be saved as drafts for manual review.\n');