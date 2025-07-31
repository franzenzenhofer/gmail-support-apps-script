/**
 * Performance Tests - Check for optimization opportunities
 */

const fs = require('fs');
const path = require('path');

console.log('⚡ Performance Test Suite\n');

let issues = [];

// Read all .gs files
const gsFiles = fs.readdirSync('.').filter(f => f.endsWith('.gs'));

console.log('=== Performance Analysis ===\n');

// 1. Check for N+1 query patterns
console.log('1. Checking for N+1 patterns...');
let n1Patterns = 0;
gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Look for loops with API calls
  const forEachWithAPI = content.match(/forEach.*\{[\s\S]*?(Gmail|Drive|Spreadsheet)App[\s\S]*?\}/g) || [];
  const forLoopWithAPI = content.match(/for\s*\(.*\{[\s\S]*?(Gmail|Drive|Spreadsheet)App[\s\S]*?\}/g) || [];
  
  n1Patterns += forEachWithAPI.length + forLoopWithAPI.length;
});

if (n1Patterns > 0) {
  console.log(`   ❌ Found ${n1Patterns} potential N+1 query patterns`);
  issues.push(`N+1 query patterns: ${n1Patterns}`);
} else {
  console.log('   ✅ No N+1 patterns detected');
}

// 2. Check for batch operations
console.log('\n2. Checking batch operation usage...');
let batchOps = 0;
let nonBatchOps = 0;

gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Count batch operations
  batchOps += (content.match(/batchGet|batchUpdate|fetchAll/g) || []).length;
  
  // Count individual operations in loops
  const individualOps = content.match(/forEach.*\{[\s\S]*?(getRange|getValue|fetch)\(/g) || [];
  nonBatchOps += individualOps.length;
});

console.log(`   Batch operations: ${batchOps}`);
console.log(`   Individual operations in loops: ${nonBatchOps}`);
if (nonBatchOps > batchOps) {
  console.log('   ❌ Should use more batch operations');
  issues.push('Insufficient batch operation usage');
}

// 3. Check caching effectiveness
console.log('\n3. Analyzing cache usage...');
let cacheReads = 0;
let cacheWrites = 0;
let uncachedAPICalls = 0;

gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  cacheReads += (content.match(/cache\.get\(/g) || []).length;
  cacheWrites += (content.match(/cache\.put\(/g) || []).length;
  
  // Look for API calls without nearby cache checks
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('App.') && !lines.slice(Math.max(0, i-5), i+5).some(l => l.includes('cache.'))) {
      uncachedAPICalls++;
    }
  });
});

console.log(`   Cache reads: ${cacheReads}`);
console.log(`   Cache writes: ${cacheWrites}`);
console.log(`   Uncached API calls: ${uncachedAPICalls}`);
if (uncachedAPICalls > 20) {
  console.log('   ❌ Many API calls without caching');
  issues.push(`${uncachedAPICalls} API calls without caching`);
}

// 4. Check for synchronous operations that could be async
console.log('\n4. Checking for blocking operations...');
let blockingOps = 0;

gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Look for multiple sequential API calls
  const sequentialAPIs = content.match(/App\.[^;]+;\s*\n\s*\w+App\./g) || [];
  blockingOps += sequentialAPIs.length;
});

if (blockingOps > 5) {
  console.log(`   ❌ Found ${blockingOps} sequential API calls that could be parallelized`);
  issues.push('Sequential API calls could be parallelized');
}

// 5. Memory leak patterns
console.log('\n5. Checking for memory leaks...');
let memoryLeaks = 0;

gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Check for unbounded arrays/maps
  const unboundedArrays = content.match(/this\.\w+\.push\(/g) || [];
  const mapSets = content.match(/\.set\(/g) || [];
  const mapDeletes = content.match(/\.delete\(/g) || [];
  
  if (unboundedArrays.length > 5 && !content.includes('shift()') && !content.includes('splice(')) {
    memoryLeaks++;
  }
  
  if (mapSets.length > mapDeletes.length * 2) {
    memoryLeaks++;
  }
});

if (memoryLeaks > 0) {
  console.log(`   ❌ Found ${memoryLeaks} potential memory leak patterns`);
  issues.push('Potential memory leaks detected');
} else {
  console.log('   ✅ No obvious memory leaks');
}

// 6. Script execution time checks
console.log('\n6. Analyzing execution time safeguards...');
let timeoutChecks = 0;

gsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  timeoutChecks += (content.match(/canContinue|getRemainingTime|5\.5.*minute/gi) || []).length;
});

console.log(`   Timeout checks: ${timeoutChecks}`);
if (timeoutChecks < 10) {
  console.log('   ❌ Insufficient timeout protection');
  issues.push('Need more execution time checks');
}

// Summary
console.log('\n=== Performance Test Summary ===\n');
if (issues.length === 0) {
  console.log('✅ No major performance issues found');
} else {
  console.log(`❌ Found ${issues.length} performance issues:`);
  issues.forEach(issue => console.log(`   - ${issue}`));
  
  console.log('\n📈 Performance Recommendations:');
  console.log('1. Use batch operations for API calls');
  console.log('2. Implement aggressive caching');
  console.log('3. Parallelize independent operations');
  console.log('4. Add memory cleanup for long-running processes');
  console.log('5. Monitor execution time continuously');
}