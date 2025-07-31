/**
 * CONFIG SERVICE VERIFIER
 * This file loads AFTER ConfigService.gs to verify it's properly initialized
 * File name starts with Z_ to ensure it loads after all other files
 */

// Verify ConfigService is available
function verifyConfigService() {
  try {
    // Check if ConfigService class is defined
    if (typeof ConfigService === 'undefined') {
      console.error('❌ ConfigService class not defined - check file loading order');
      return false;
    }
    
    // Check if Config singleton is defined
    if (typeof Config === 'undefined') {
      console.error('❌ Config singleton not defined');
      return false;
    }
    
    // Test instantiation
    const test = new ConfigService();
    console.log('✅ ConfigService class is available');
    
    // Test singleton
    const config = Config.get();
    console.log('✅ Config singleton is working');
    
    // Export to global scope if needed
    if (typeof globalThis === 'object') {
      globalThis.ConfigService = ConfigService;
      globalThis.Config = Config;
    }
    
    return true;
  } catch (e) {
    console.error('❌ ConfigService verification failed:', e);
    return false;
  }
}

// Ensure ConfigService is globally available for all files
function ensureConfigServiceAvailable() {
  if (typeof ConfigService === 'undefined') {
    throw new Error('ConfigService is not defined. Check that ConfigService.gs is included in the project.');
  }
  if (typeof Config === 'undefined') {
    throw new Error('Config singleton is not defined. Check that ConfigService.gs properly creates the singleton.');
  }
}

// Run verification on load
const configServiceAvailable = verifyConfigService();

// Log final status
if (configServiceAvailable) {
  console.log('✅ ConfigService initialization complete');
} else {
  console.error('❌ ConfigService initialization failed');
}