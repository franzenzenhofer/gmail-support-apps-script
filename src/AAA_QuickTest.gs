/**
 * QUICK TEST - Run this single function to verify deployment
 */

function quickTest() {
  console.log('🚀 Gmail Support System - Quick Test\n');
  console.log('Version: ' + (DEPLOYMENT_INFO ? DEPLOYMENT_INFO.version : 'UNKNOWN'));
  console.log('Timestamp: ' + (DEPLOYMENT_INFO ? DEPLOYMENT_INFO.timestamp : 'UNKNOWN'));
  console.log('Model: gemini-2.0-flash-exp\n');
  
  // Simple test that doesn't require dependencies
  console.log('✅ Basic script execution working');
  
  // Try to access Google services
  try {
    PropertiesService.getScriptProperties();
    console.log('✅ Google Services accessible');
  } catch (e) {
    console.log('❌ Google Services error: ' + e);
  }
  
  return 'Quick test complete - check logs';
}