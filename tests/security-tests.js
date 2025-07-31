/**
 * Security Tests - Validate security best practices
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Security Test Suite\n');

let securityIssues = [];

// Read all files
const gsFiles = fs.readdirSync('.').filter(f => f.endsWith('.gs'));
const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));

console.log('=== Security Analysis ===\n');

// 1. Check for hardcoded credentials
console.log('1. Checking for hardcoded credentials...');
let hardcodedCreds = 0;

const credentialPatterns = [
  /apiKey\s*[:=]\s*['"][^'"]+['"]/gi,
  /password\s*[:=]\s*['"][^'"]+['"]/gi,
  /secret\s*[:=]\s*['"][^'"]+['"]/gi,
  /token\s*[:=]\s*['"][^'"]+['"]/gi,
  /YOUR_.*_HERE/g
];

[...gsFiles, ...htmlFiles].forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  credentialPatterns.forEach(pattern => {
    const matches = content.match(pattern) || [];
    if (matches.length > 0 && !file.includes('test') && !file.includes('mock')) {
      hardcodedCreds += matches.length;
      console.log(`   ❌ Found in ${file}: ${matches[0].substring(0, 30)}...`);
    }
  });
});

if (hardcodedCreds > 0) {
  securityIssues.push(`${hardcodedCreds} hardcoded credentials found`);
}

// 2. Input validation
console.log('\n2. Checking input validation...');
let unvalidatedInputs = 0;

gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, i) => {
    // Check for direct use of user input without validation
    if ((line.includes('e.parameter') || line.includes('e.postData')) && 
        !lines.slice(Math.max(0, i-5), i).some(l => l.includes('validate') || l.includes('sanitize'))) {
      unvalidatedInputs++;
    }
  });
});

if (unvalidatedInputs > 0) {
  console.log(`   ❌ Found ${unvalidatedInputs} unvalidated inputs`);
  securityIssues.push('Unvalidated user inputs');
}

// 3. XSS Prevention
console.log('\n3. Checking XSS prevention...');
let xssVulnerabilities = 0;

htmlFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Check for unsafe innerHTML usage
  const unsafePatterns = [
    /innerHTML\s*=\s*[^'"][^;]+/g,
    /innerHTML\s*\+=\s*/g,
    /document\.write\(/g
  ];
  
  unsafePatterns.forEach(pattern => {
    const matches = content.match(pattern) || [];
    xssVulnerabilities += matches.length;
  });
});

if (xssVulnerabilities > 0) {
  console.log(`   ❌ Found ${xssVulnerabilities} potential XSS vulnerabilities`);
  securityIssues.push('XSS vulnerabilities in HTML files');
}

// 4. Access control
console.log('\n4. Checking access control...');
let missingAuth = 0;

gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Check for functions that should have auth
  if (content.includes('function doGet') || content.includes('function doPost')) {
    if (!content.includes('checkAuth') && !content.includes('requireAuth') && !content.includes('Session.getActiveUser')) {
      missingAuth++;
      console.log(`   ❌ Missing auth check in ${file}`);
    }
  }
});

if (missingAuth > 0) {
  securityIssues.push('Missing authentication checks');
}

// 5. Error information leakage
console.log('\n5. Checking error handling...');
let errorLeaks = 0;

gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Check for stack traces in responses
  const errorPatterns = [
    /catch.*\{[\s\S]*?return.*error\.stack/g,
    /catch.*\{[\s\S]*?\.send.*error\)/g
  ];
  
  errorPatterns.forEach(pattern => {
    if (content.match(pattern)) {
      errorLeaks++;
    }
  });
});

if (errorLeaks > 0) {
  console.log(`   ❌ Found ${errorLeaks} error information leaks`);
  securityIssues.push('Error stack traces exposed');
}

// 6. HTTPS usage
console.log('\n6. Checking HTTPS usage...');
let httpUrls = 0;

[...gsFiles, ...htmlFiles].forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  const httpMatches = content.match(/http:\/\/(?!localhost|127\.0\.0\.1)/g) || [];
  httpUrls += httpMatches.length;
});

if (httpUrls > 0) {
  console.log(`   ❌ Found ${httpUrls} non-HTTPS URLs`);
  securityIssues.push('Non-HTTPS URLs detected');
}

// 7. Script Properties usage
console.log('\n7. Checking secure storage...');
let properConfig = 0;
let improperConfig = 0;

gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  properConfig += (content.match(/PropertiesService\.getScriptProperties/g) || []).length;
  improperConfig += (content.match(/const.*apiKey.*=.*['"]/g) || []).length;
});

console.log(`   Script Properties usage: ${properConfig}`);
console.log(`   Hardcoded sensitive data: ${improperConfig}`);

// Summary
console.log('\n=== Security Test Summary ===\n');
if (securityIssues.length === 0) {
  console.log('✅ No security issues found');
} else {
  console.log(`❌ Found ${securityIssues.length} security issues:`);
  securityIssues.forEach(issue => console.log(`   - ${issue}`));
  
  console.log('\n🔐 Security Recommendations:');
  console.log('1. Store all credentials in Script Properties');
  console.log('2. Validate and sanitize all user inputs');
  console.log('3. Use textContent instead of innerHTML');
  console.log('4. Implement proper authentication checks');
  console.log('5. Sanitize error messages before displaying');
  console.log('6. Always use HTTPS for external resources');
}