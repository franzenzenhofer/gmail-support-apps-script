/**
 * DEPENDENCY TEST - Run this to check all dependencies
 */

function testAllDependencies() {
  console.log('🔍 Testing All Dependencies...\n');
  
  const results = [];
  
  // Test 1: ConfigService
  try {
    const cs = new ConfigService();
    results.push('✅ ConfigService: FOUND');
  } catch (e) {
    results.push('❌ ConfigService: NOT FOUND - ' + e.toString());
  }
  
  // Test 2: BaseService
  try {
    const bs = new BaseService('test');
    results.push('✅ BaseService: FOUND');
  } catch (e) {
    results.push('❌ BaseService: NOT FOUND - ' + e.toString());
  }
  
  // Test 3: SafetyConfig
  try {
    if (typeof DRAFT_MODE !== 'undefined') {
      results.push('✅ SafetyConfig: FOUND (DRAFT_MODE = ' + DRAFT_MODE + ')');
    } else {
      results.push('❌ SafetyConfig: DRAFT_MODE not defined');
    }
  } catch (e) {
    results.push('❌ SafetyConfig: ERROR - ' + e.toString());
  }
  
  // Test 4: CacheService (Google built-in)
  try {
    const cache = CacheService.getScriptCache();
    results.push('✅ CacheService: WORKING');
  } catch (e) {
    results.push('❌ CacheService: ERROR - ' + e.toString());
  }
  
  // Test 5: PropertiesService (Google built-in)
  try {
    const props = PropertiesService.getScriptProperties();
    results.push('✅ PropertiesService: WORKING');
  } catch (e) {
    results.push('❌ PropertiesService: ERROR - ' + e.toString());
  }
  
  // Test 6: AIService
  try {
    const ai = new AIService();
    results.push('✅ AIService: FOUND (model: ' + ai.model + ')');
  } catch (e) {
    results.push('❌ AIService: ERROR - ' + e.toString());
  }
  
  // Test 7: Deployment Info
  try {
    results.push('✅ Deployment Version: ' + DEPLOYMENT_INFO.version);
    results.push('✅ Deployment Time: ' + DEPLOYMENT_INFO.timestamp);
  } catch (e) {
    results.push('❌ Deployment Info: NOT FOUND');
  }
  
  // Output results
  console.log('=== DEPENDENCY TEST RESULTS ===\n');
  results.forEach(r => console.log(r));
  
  console.log('\n=== SUMMARY ===');
  const errors = results.filter(r => r.startsWith('❌')).length;
  const success = results.filter(r => r.startsWith('✅')).length;
  console.log(`Success: ${success}/${results.length}`);
  console.log(`Errors: ${errors}/${results.length}`);
  
  if (errors > 0) {
    console.log('\n⚠️  DEPLOYMENT ISSUE: Some dependencies are missing!');
    console.log('Try: 1) Refresh browser, 2) Clear cache, 3) Re-run deployment');
  } else {
    console.log('\n🎉 ALL DEPENDENCIES LOADED SUCCESSFULLY!');
  }
  
  return results;
}