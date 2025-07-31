/**
 * GLOBAL LOADER - Early initialization tasks
 * This file loads early (AA prefix) but does NOT reference classes that load later
 * ConfigService verification is handled by Z_ConfigServiceVerifier.gs
 */

// Global initialization function
function initializeGlobals() {
  // This function can be called later after all services are loaded
  console.log('Global initialization function ready');
  
  // Return a function that can check services after they're loaded
  return {
    checkServices: function() {
      const results = [];
      
      // Check ConfigService
      if (typeof ConfigService !== 'undefined') {
        try {
          const test = new ConfigService();
          results.push('✅ ConfigService: Available');
        } catch (e) {
          results.push('❌ ConfigService: Error - ' + e.toString());
        }
      } else {
        results.push('❌ ConfigService: Not defined');
      }
      
      return results;
    }
  };
}

// Store the initializer for later use
const GlobalInit = initializeGlobals();