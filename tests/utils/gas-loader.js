/**
 * Gas Loader - Loads Google Apps Script files for testing
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGasFile(filename) {
  const filePath = path.join(__dirname, '../../', filename);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filename}`);
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  // Create a context with our mocked globals
  const context = vm.createContext({
    ...global,
    console,
    Logger: global.Logger,
    PropertiesService: global.PropertiesService,
    CacheService: global.CacheService,
    UrlFetchApp: global.UrlFetchApp,
    GmailApp: global.GmailApp,
    SpreadsheetApp: global.SpreadsheetApp,
    DriveApp: global.DriveApp,
    HtmlService: global.HtmlService,
    ScriptApp: global.ScriptApp,
    LockService: global.LockService,
    Utilities: global.Utilities
  });
  
  // Execute the file in the context
  vm.runInContext(fileContent, context);
  
  // Return the context so we can access the defined classes/functions
  return context;
}

module.exports = { loadGasFile };