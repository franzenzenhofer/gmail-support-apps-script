/**
 * Project Validation Script
 * Comprehensive checks for deployment readiness
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Gmail Support System - Project Validation\n');

let errors = 0;
let warnings = 0;

// Check function
function check(name, condition, errorMsg) {
  if (condition) {
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name}: ${errorMsg}`);
    errors++;
  }
}

function warn(name, condition, warnMsg) {
  if (!condition) {
    console.warn(`⚠️  ${name}: ${warnMsg}`);
    warnings++;
  }
}

// 1. Critical Safety Files
console.log('=== Safety Configuration ===');
check('SafetyConfig.gs exists', fs.existsSync('SafetyConfig.gs'), 'Missing safety configuration');
check('SafeEmailService.gs exists', fs.existsSync('SafeEmailService.gs'), 'Missing safe email wrapper');
check('DashboardWithSafety.html exists', fs.existsSync('DashboardWithSafety.html'), 'Missing safety dashboard');

// 2. Core Services
console.log('\n=== Core Services ===');
const coreServices = [
  'ConfigService.gs',
  'EmailService.gs',
  'AIService.gs',
  'TicketService.gs',
  'MetricsService.gs',
  'ErrorService.gs',
  'LoggingService.gs'
];

coreServices.forEach(service => {
  check(`${service} exists`, fs.existsSync(service), `Missing core service`);
});

// 3. Deployment Files
console.log('\n=== Deployment Configuration ===');
check('DEPLOY.md exists', fs.existsSync('DEPLOY.md'), 'Missing deployment guide');
check('deploy.js exists', fs.existsSync('deploy.js'), 'Missing deployment script');
check('package.json exists', fs.existsSync('package.json'), 'Missing package.json');
check('.claspignore exists', fs.existsSync('.claspignore'), 'Missing .claspignore');

// 4. Testing Infrastructure
console.log('\n=== Testing Setup ===');
check('jest.config.js exists', fs.existsSync('jest.config.js'), 'Missing Jest config');
check('tests directory exists', fs.existsSync('tests'), 'Missing tests directory');
check('GAS mocks exist', fs.existsSync('tests/setup/gas-mocks.js'), 'Missing GAS mocks');

// 5. Documentation
console.log('\n=== Documentation ===');
check('README.md exists', fs.existsSync('README.md'), 'Missing README');
check('CLAUDE.md exists', fs.existsSync('CLAUDE.md'), 'Missing CLAUDE.md');
warn('No duplicate deployment guides', 
  !fs.existsSync('DEPLOYMENT_GUIDE.md') && !fs.existsSync('deployment-guide.md'),
  'Found duplicate deployment guides - should be consolidated'
);

// 6. Configuration Validation
console.log('\n=== Configuration Checks ===');
if (fs.existsSync('SafetyConfig.gs')) {
  const safetyContent = fs.readFileSync('SafetyConfig.gs', 'utf8');
  check('DRAFT_MODE is true', safetyContent.includes('const DRAFT_MODE = true'), 'DRAFT_MODE not set to true');
  check('Test mode enabled', safetyContent.includes('testMode: true'), 'Test mode not enabled');
  check('Email whitelist configured', safetyContent.includes('team@fullstackoptimization.com'), 'Missing email whitelist');
}

// 7. Package.json Scripts
console.log('\n=== NPM Scripts ===');
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = ['push', 'test', 'deploy:prod', 'logs', 'open'];
  
  requiredScripts.forEach(script => {
    check(`Script '${script}' defined`, pkg.scripts && pkg.scripts[script], 'Missing npm script');
  });
}

// 8. File Count
console.log('\n=== Project Statistics ===');
const gsFiles = fs.readdirSync('.').filter(f => f.endsWith('.gs'));
const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));
console.log(`📁 Google Apps Script files: ${gsFiles.length}`);
console.log(`📄 HTML files: ${htmlFiles.length}`);
console.log(`📦 Total project files: ${gsFiles.length + htmlFiles.length}`);

// Summary
console.log('\n=== Validation Summary ===');
if (errors === 0 && warnings === 0) {
  console.log('✅ All checks passed! Project is ready for deployment.');
  console.log('\n🚀 Next steps:');
  console.log('1. Run: npm install');
  console.log('2. Run: npm run quickstart');
  console.log('3. Configure Gemini API key in Apps Script');
  console.log('4. Test with whitelisted email');
} else {
  console.log(`Found ${errors} errors and ${warnings} warnings.`);
  if (errors > 0) {
    console.error('\n❌ Please fix errors before deploying.');
    process.exit(1);
  }
}

console.log('\n⚠️  Remember: System starts in DRAFT MODE for safety!');