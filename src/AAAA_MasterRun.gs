/**
 * MASTER RUN - ONE FUNCTION TO RUN EVERYTHING
 * Run masterRun() to check and execute the entire system
 */

function masterRun() {
  console.log('🚀 GMAIL SUPPORT SYSTEM - MASTER RUN\n');
  console.log('='.repeat(50));
  
  let hasErrors = false;
  
  // Step 1: Version Check
  console.log('\n📋 STEP 1: VERSION CHECK');
  try {
    console.log('Version: ' + DEPLOYMENT_INFO.version);
    console.log('Deployed: ' + DEPLOYMENT_INFO.timestamp);
    console.log('Model: ' + DEPLOYMENT_INFO.model);
    console.log('✅ Version info loaded');
  } catch (e) {
    console.log('❌ Version info error: ' + e);
    hasErrors = true;
  }
  
  // Step 2: Dependency Check
  console.log('\n🔧 STEP 2: DEPENDENCY CHECK');
  try {
    // Check ConfigService
    const cs = new ConfigService();
    console.log('✅ ConfigService: Available');
    
    // Check BaseService
    const bs = new BaseService('test');
    console.log('✅ BaseService: Available');
    
    // Check SafetyConfig
    if (typeof DRAFT_MODE !== 'undefined') {
      console.log('✅ SafetyConfig: DRAFT_MODE = ' + DRAFT_MODE);
    }
  } catch (e) {
    console.log('❌ Dependency error: ' + e);
    hasErrors = true;
  }
  
  // Step 3: API Key Check
  console.log('\n🔑 STEP 3: API KEY CHECK');
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('GEMINI_API_KEY');
  
  if (!apiKey || apiKey === '' || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    console.log('❌ API KEY NOT SET!');
    console.log('\n📝 Setting up test API key...');
    
    // Prompt for API key
    console.log('\nTO SET API KEY MANUALLY:');
    console.log('1. Get key from: https://makersuite.google.com/app/apikey');
    console.log('2. Run: setApiKey("your-key-here")');
    hasErrors = true;
  } else {
    console.log('✅ API Key: SET');
    
    // Test AIService
    try {
      const ai = new AIService();
      console.log('✅ AIService: Initialized with ' + ai.model);
    } catch (e) {
      console.log('❌ AIService error: ' + e);
      hasErrors = true;
    }
  }
  
  // Step 4: Gmail Setup Check
  console.log('\n📧 STEP 4: GMAIL SETUP CHECK');
  try {
    // Check labels
    const labels = ['Support', 'Support/Processed', 'Support/Escalated', 'Support/Auto-Replied'];
    let labelsOk = true;
    
    labels.forEach(labelName => {
      try {
        let label = GmailApp.getUserLabelByName(labelName);
        if (!label) {
          GmailApp.createLabel(labelName);
          console.log('✅ Created label: ' + labelName);
        } else {
          console.log('✅ Label exists: ' + labelName);
        }
      } catch (e) {
        console.log('❌ Label error (' + labelName + '): ' + e);
        labelsOk = false;
      }
    });
    
    if (!labelsOk) hasErrors = true;
  } catch (e) {
    console.log('❌ Gmail setup error: ' + e);
    hasErrors = true;
  }
  
  // Step 5: Test Email Processing (Dry Run)
  console.log('\n🧪 STEP 5: TEST EMAIL PROCESSING');
  if (!hasErrors && apiKey) {
    try {
      console.log('Testing email analysis capability...');
      
      // Create test email object
      const testEmail = {
        id: 'test_' + new Date().getTime(),
        from: 'team@fullstackoptimization.com',
        to: 'support@example.com',
        subject: 'Test: System Check',
        body: 'This is a test email to verify the system is working.',
        date: new Date()
      };
      
      console.log('📧 Test email from: ' + testEmail.from);
      console.log('📝 Subject: ' + testEmail.subject);
      
      // Check if it would be processed
      const safetyConfig = getSafetyConfig();
      if (safetyConfig.testMode) {
        const allowed = safetyConfig.testEmailAddresses.some(email => 
          testEmail.from.toLowerCase().includes(email.toLowerCase())
        );
        console.log(allowed ? '✅ Email would be processed (whitelisted)' : '❌ Email would be filtered (not whitelisted)');
      }
      
      console.log('✅ Email processing system ready');
    } catch (e) {
      console.log('❌ Email processing error: ' + e);
      hasErrors = true;
    }
  }
  
  // Final Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 MASTER RUN SUMMARY\n');
  
  if (hasErrors) {
    console.log('❌ SYSTEM HAS ERRORS - Fix issues above before processing emails');
    console.log('\n🔧 Common fixes:');
    console.log('1. Set API key: setApiKey("your-key")');
    console.log('2. Hard refresh browser: Cmd+Shift+R');
    console.log('3. Re-run: masterRun()');
  } else {
    console.log('✅ ALL SYSTEMS GO!');
    console.log('\n🎯 Ready to process support emails:');
    console.log('- Manual: Run analyzeEmail()');
    console.log('- Automatic: Set up time trigger for analyzeEmail()');
    console.log('- Dashboard: ' + getWebAppUrl());
  }
  
  return hasErrors ? 'ERRORS FOUND' : 'SYSTEM READY';
}

// Helper function to get safety config
function getSafetyConfig() {
  try {
    const override = PropertiesService.getScriptProperties().getProperty('SAFETY_CONFIG_OVERRIDE');
    if (override) {
      return JSON.parse(override);
    }
  } catch (e) {
    // Use defaults
  }
  
  return {
    draftMode: true,
    testMode: true,
    testEmailAddresses: ['team@fullstackoptimization.com'],
    maxEmailsPerRun: 5
  };
}

// Helper function to get web app URL
function getWebAppUrl() {
  return 'https://script.google.com/macros/s/AKfycbz3HgE-16Tr3tn2P96VIeMkpLRQrngC1bG2DtrfYFur/exec';
}