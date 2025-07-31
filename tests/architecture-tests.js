/**
 * Architecture Tests - Validate design patterns and DRY principles
 */

const fs = require('fs');
const path = require('path');

console.log('🏗️  Architecture Test Suite\n');

let violations = [];
let patterns = {
  constructors: [],
  rateLimiting: [],
  errorHandling: [],
  caching: [],
  profiling: []
};

// Read all .gs files
const gsFiles = fs.readdirSync('.').filter(f => f.endsWith('.gs'));

gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  // Check for duplicate patterns
  lines.forEach((line, index) => {
    // Constructor pattern
    if (line.includes('this.config = Config.get')) {
      patterns.constructors.push({ file, line: index + 1, code: line.trim() });
    }
    
    // Rate limiting
    if (line.includes('checkLimit') || line.includes('rateLimiter')) {
      patterns.rateLimiting.push({ file, line: index + 1, code: line.trim() });
    }
    
    // Error handling
    if (line.includes('handleError(error,')) {
      patterns.errorHandling.push({ file, line: index + 1, code: line.trim() });
    }
    
    // Cache patterns
    if (line.includes('this.cache = CacheService')) {
      patterns.caching.push({ file, line: index + 1, code: line.trim() });
    }
    
    // Profiling
    if (line.includes('profile(') || line.includes('profileEnd(')) {
      patterns.profiling.push({ file, line: index + 1, code: line.trim() });
    }
  });
});

// Report findings
console.log('=== DRY Principle Violations ===\n');

console.log(`1. Constructor Pattern Duplication: ${patterns.constructors.length} instances`);
if (patterns.constructors.length > 10) {
  console.log('   ❌ VIOLATION: Should use BaseService class');
  violations.push('Constructor pattern repeated in ' + patterns.constructors.length + ' files');
}

console.log(`\n2. Rate Limiting Duplication: ${patterns.rateLimiting.length} instances`);
if (patterns.rateLimiting.length > 3) {
  console.log('   ❌ VIOLATION: Should use centralized RateLimiter');
  violations.push('Rate limiting duplicated in multiple services');
}

console.log(`\n3. Error Handling Duplication: ${patterns.errorHandling.length} instances`);
if (patterns.errorHandling.length > 10) {
  console.log('   ❌ VIOLATION: Should use wrapper methods');
  violations.push('Error handling pattern repeated ' + patterns.errorHandling.length + ' times');
}

console.log(`\n4. Cache Initialization: ${patterns.caching.length} instances`);
if (patterns.caching.length > 10) {
  console.log('   ❌ VIOLATION: Should inherit from BaseService');
  violations.push('Cache initialization duplicated');
}

console.log(`\n5. Profiling Code: ${patterns.profiling.length} instances`);
if (patterns.profiling.length > 20) {
  console.log('   ❌ VIOLATION: Should use decorator pattern');
  violations.push('Profiling code scattered throughout');
}

// Test service dependencies
console.log('\n=== Service Dependency Analysis ===\n');

const serviceDeps = {};
gsFiles.forEach(file => {
  if (file.includes('Service.gs')) {
    const content = fs.readFileSync(file, 'utf8');
    const deps = [];
    
    // Check for service dependencies
    const serviceMatches = content.match(/new \w+Service\(\)/g) || [];
    serviceMatches.forEach(match => {
      const serviceName = match.match(/new (\w+Service)/)[1];
      if (serviceName !== file.replace('.gs', '')) {
        deps.push(serviceName);
      }
    });
    
    if (deps.length > 0) {
      serviceDeps[file] = deps;
    }
  }
});

Object.entries(serviceDeps).forEach(([file, deps]) => {
  console.log(`${file}: depends on ${deps.join(', ')}`);
});

// Test for circular dependencies
console.log('\n=== Circular Dependency Check ===\n');
let circularFound = false;
Object.entries(serviceDeps).forEach(([file, deps]) => {
  deps.forEach(dep => {
    const depFile = dep + '.gs';
    if (serviceDeps[depFile] && serviceDeps[depFile].includes(file.replace('.gs', ''))) {
      console.log(`❌ CIRCULAR: ${file} <-> ${depFile}`);
      circularFound = true;
    }
  });
});

if (!circularFound) {
  console.log('✅ No circular dependencies found');
}

// Configuration analysis
console.log('\n=== Configuration Analysis ===\n');

let configAccess = 0;
let hardcodedValues = 0;

gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Count Config.get calls
  const configMatches = content.match(/Config\.get\(/g) || [];
  configAccess += configMatches.length;
  
  // Check for hardcoded values
  const hardcodedPatterns = [
    /maxRetries:\s*\d+/g,
    /timeout:\s*\d+/g,
    /limit:\s*\d+/g,
    /ttl:\s*\d+/g
  ];
  
  hardcodedPatterns.forEach(pattern => {
    const matches = content.match(pattern) || [];
    hardcodedValues += matches.length;
  });
});

console.log(`Config.get() calls: ${configAccess}`);
console.log(`Hardcoded values: ${hardcodedValues}`);
if (hardcodedValues > 20) {
  console.log('❌ Too many hardcoded values - should use configuration');
}

// Summary
console.log('\n=== Architecture Test Summary ===\n');
if (violations.length === 0) {
  console.log('✅ Architecture follows DRY principles');
} else {
  console.log(`❌ Found ${violations.length} DRY violations:`);
  violations.forEach(v => console.log(`   - ${v}`));
  
  console.log('\n📋 Recommendations:');
  console.log('1. Create BaseService class for common initialization');
  console.log('2. Centralize rate limiting logic');
  console.log('3. Use wrapper methods for error handling');
  console.log('4. Extract constants to configuration');
  console.log('5. Implement decorator pattern for cross-cutting concerns');
}