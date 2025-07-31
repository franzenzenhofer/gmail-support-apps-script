#!/usr/bin/env node
/**
 * Build script to bundle all .gs files into one big file
 * This creates a single bundled.gs file for easier deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔨 Building bundled GS file...\n');

const srcDir = path.join(__dirname, 'src');
const outputFile = path.join(__dirname, 'dist', 'bundled.gs');

// Ensure dist directory exists
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.mkdirSync(path.join(__dirname, 'dist'));
}

// Get all .gs files sorted alphabetically (important for load order!)
const gsFiles = fs.readdirSync(srcDir)
  .filter(file => file.endsWith('.gs'))
  .sort();

console.log(`Found ${gsFiles.length} .gs files to bundle:\n`);

// Start with header
let bundledContent = `/**
 * BUNDLED GMAIL SUPPORT SYSTEM
 * Generated: ${new Date().toISOString()}
 * Files: ${gsFiles.length}
 * 
 * This is a bundled version of all .gs files for easier deployment
 */

`;

// Process each file
gsFiles.forEach((file, index) => {
  console.log(`  ${index + 1}. ${file}`);
  
  const filePath = path.join(srcDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Add file separator
  bundledContent += `
// ============================================
// FILE: ${file}
// ============================================

${content}

`;
});

// Write bundled file
fs.writeFileSync(outputFile, bundledContent);

console.log(`\n✅ Bundle created: ${outputFile}`);
console.log(`📦 Total size: ${(bundledContent.length / 1024).toFixed(2)} KB`);

// Also create a minified version
const minifiedContent = bundledContent
  .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
  .replace(/\/\/.*$/gm, '') // Remove line comments
  .replace(/\n\s*\n/g, '\n') // Remove empty lines
  .replace(/\s+/g, ' ') // Collapse whitespace
  .trim();

const minifiedFile = path.join(__dirname, 'dist', 'bundled.min.gs');
fs.writeFileSync(minifiedFile, minifiedContent);

console.log(`🗜️  Minified version: ${minifiedFile}`);
console.log(`📦 Minified size: ${(minifiedContent.length / 1024).toFixed(2)} KB`);
console.log(`💾 Size reduction: ${((1 - minifiedContent.length / bundledContent.length) * 100).toFixed(1)}%`);

console.log('\n🚀 Bundle ready for deployment!');