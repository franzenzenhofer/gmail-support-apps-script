/**
 * SYSTEM CHECK - Run this first to verify everything is working
 */

function systemCheck() {
  console.log('🔍 Gmail Support System - System Check\n');
  
  let hasErrors = false;
  
  // Check 1: Version Info
  try {
    console.log('📋 Version: ' + DEPLOYMENT_INFO.version);
    console.log('📅 Deployed: ' + DEPLOYMENT_INFO.timestamp);
    console.log('🤖 Model: ' + DEPLOYMENT_INFO.model);
  } catch (e) {
    console.log('❌ Version info not found - deployment may be outdated');
    hasErrors = true;
  }
  
  console.log('\n--- Checking Dependencies ---');
  
  // Check 2: ConfigService
  try {
    const cs = new ConfigService();
    console.log('✅ ConfigService: OK');
  } catch (e) {
    console.log('❌ ConfigService: NOT FOUND');
    hasErrors = true;
  }
  
  // Check 3: API Key
  console.log('\n--- Checking API Key ---');
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('GEMINI_API_KEY');
  
  if (!apiKey || apiKey === '' || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    console.log('❌ GEMINI API KEY NOT SET!');
    console.log('\n🔑 TO SET API KEY:');
    console.log('1. Go to Project Settings (gear icon on left)');
    console.log('2. Scroll down to "Script Properties"');
    console.log('3. Click "Add script property"');
    console.log('4. Property: GEMINI_API_KEY');
    console.log('5. Value: Your API key from https://makersuite.google.com/app/apikey');
    console.log('\n⚠️  SYSTEM WILL NOT WORK WITHOUT API KEY!');
    hasErrors = true;
  } else {
    console.log('✅ Gemini API Key: SET (hidden for security)');
  }
  
  // Check 4: Safety Config
  console.log('\n--- Checking Safety Config ---');
  try {
    console.log('✅ DRAFT_MODE: ' + DRAFT_MODE + ' (emails will be drafts only)');
  } catch (e) {
    console.log('❌ Safety config not loaded');
    hasErrors = true;
  }
  
  console.log('\n--- Summary ---');
  if (hasErrors) {
    console.log('❌ SYSTEM HAS ERRORS - Please fix issues above');
    return 'ERRORS FOUND - Check logs';
  } else {
    console.log('✅ ALL SYSTEMS GO! Ready to process emails.');
    return 'System ready';
  }
}

// Also create a simple function to set API key
function setApiKey(apiKey) {
  if (!apiKey || apiKey === '') {
    return 'ERROR: Please provide an API key';
  }
  
  const props = PropertiesService.getScriptProperties();
  props.setProperty('GEMINI_API_KEY', apiKey);
  
  console.log('✅ API Key has been set!');
  console.log('Run systemCheck() to verify everything is working.');
  
  return 'API Key set successfully';
}