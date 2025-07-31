/**
 * TEST CONFIG SERVICE
 * Run testConfigServiceAvailability() to verify ConfigService is properly loaded
 */

function testConfigServiceAvailability() {
  console.log('=== Testing ConfigService Availability ===\n');
  
  const results = [];
  
  // Test 1: Check if ConfigService class exists
  if (typeof ConfigService === 'undefined') {
    results.push('❌ ConfigService class is NOT defined');
  } else {
    results.push('✅ ConfigService class is defined');
  }
  
  // Test 2: Check if Config singleton exists
  if (typeof Config === 'undefined') {
    results.push('❌ Config singleton is NOT defined');
  } else {
    results.push('✅ Config singleton is defined');
  }
  
  // Test 3: Try to instantiate ConfigService
  try {
    const cs = new ConfigService();
    results.push('✅ Can instantiate new ConfigService()');
  } catch (e) {
    results.push('❌ Cannot instantiate ConfigService: ' + e.toString());
  }
  
  // Test 4: Try to use Config singleton
  try {
    const config = Config.get();
    results.push('✅ Config.get() works');
    results.push('  - Has gemini config: ' + (config.gemini ? 'YES' : 'NO'));
    results.push('  - Has support config: ' + (config.support ? 'YES' : 'NO'));
  } catch (e) {
    results.push('❌ Config.get() failed: ' + e.toString());
  }
  
  // Test 5: Try utility functions
  try {
    const testValue = getConfig('support.enabled');
    results.push('✅ getConfig() utility function works');
    results.push('  - support.enabled = ' + testValue);
  } catch (e) {
    results.push('❌ getConfig() failed: ' + e.toString());
  }
  
  // Test 6: Check if Z_ConfigServiceVerifier ran
  if (typeof configServiceAvailable !== 'undefined') {
    results.push('✅ Z_ConfigServiceVerifier ran: ' + (configServiceAvailable ? 'SUCCESS' : 'FAILED'));
  } else {
    results.push('⚠️  Z_ConfigServiceVerifier may not have run');
  }
  
  // Output all results
  console.log('Test Results:');
  results.forEach(r => console.log(r));
  
  // Summary
  const errors = results.filter(r => r.startsWith('❌')).length;
  const warnings = results.filter(r => r.startsWith('⚠️')).length;
  const success = results.filter(r => r.startsWith('✅')).length;
  
  console.log('\n=== SUMMARY ===');
  console.log(`✅ Success: ${success}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`❌ Errors: ${errors}`);
  
  if (errors === 0) {
    console.log('\n🎉 ConfigService is working correctly!');
    return 'SUCCESS';
  } else {
    console.log('\n❌ ConfigService has issues. Check the errors above.');
    return 'FAILED';
  }
}