/**
 * 🚀 ONE-CLICK INSTALLER FOR GMAIL SUPPORT SYSTEM
 * 
 * Just run installGmailSupport() and follow the prompts!
 * Everything will be set up automatically.
 */

/**
 * 🎯 MAIN INSTALLER - RUN THIS!
 */
function installGmailSupport() {
  const ui = SpreadsheetApp.getUi();
  
  ui.alert('🎉 Welcome to Gmail Support System!', 
    'This installer will set up everything automatically:\n\n' +
    '✅ Create all Gmail labels\n' +
    '✅ Set up your Gemini AI\n' +
    '✅ Create knowledge base\n' +
    '✅ Deploy web interface\n' +
    '✅ Schedule automatic processing\n\n' +
    'Ready to start?', 
    ui.ButtonSet.OK);
  
  try {
    console.log('🚀 Starting installation...\n');
    
    // Step 1: Create Gmail Labels
    showProgress('Creating Gmail labels...', 10);
    createAllLabels();
    
    // Step 2: Get Gemini API Key
    showProgress('Setting up AI...', 20);
    const apiKey = setupGeminiAI(ui);
    
    // Step 3: Create Knowledge Base
    showProgress('Creating knowledge base...', 40);
    const kbUrl = createKnowledgeBase();
    
    // Step 4: Configure System
    showProgress('Configuring system...', 60);
    configureSystem(apiKey, kbUrl);
    
    // Step 5: Deploy Web App
    showProgress('Deploying web interface...', 80);
    const webAppUrl = deployWebApp();
    
    // Step 6: Set up Triggers
    showProgress('Setting up automation...', 90);
    setupAutomation();
    
    // Step 7: Send Welcome Email
    showProgress('Finalizing...', 100);
    sendWelcomeEmail(webAppUrl);
    
    // Show success!
    ui.alert('✅ Installation Complete!', 
      `Your Gmail Support System is ready!\n\n` +
      `🌐 Web Interface: ${webAppUrl}\n` +
      `📚 Knowledge Base: ${kbUrl}\n\n` +
      `The system is now running on autopilot:\n` +
      `• Checking emails every 5 minutes\n` +
      `• Auto-responding with AI\n` +
      `• Creating tickets automatically\n\n` +
      `Check your email for the welcome guide!`,
      ui.ButtonSet.OK);
      
  } catch (error) {
    ui.alert('❌ Installation Error', 
      `Something went wrong: ${error.message}\n\n` +
      `Please try running the installer again.`,
      ui.ButtonSet.OK);
    throw error;
  }
}

/**
 * Create all Gmail labels automatically
 */
function createAllLabels() {
  console.log('📧 Creating Gmail labels...');
  
  const labels = [
    // Main labels
    'Support',
    'Support/New',
    'Support/In-Progress', 
    'Support/Resolved',
    'Support/Escalated',
    
    // Processing labels
    'AI-Processing',
    'AI-Processed',
    'AI-Failed',
    
    // Category labels
    'Support/Technical',
    'Support/Billing',
    'Support/General',
    'Support/Feedback',
    'Support/Sales',
    
    // Priority labels
    'Priority/Urgent',
    'Priority/High',
    'Priority/Medium',
    'Priority/Low',
    
    // Language labels
    'Language/English',
    'Language/Spanish',
    'Language/French',
    'Language/German',
    'Language/Other'
  ];
  
  labels.forEach(labelName => {
    try {
      GmailApp.createLabel(labelName);
      console.log(`   ✅ Created: ${labelName}`);
    } catch (e) {
      // Label might already exist
      console.log(`   ℹ️ Exists: ${labelName}`);
    }
  });
  
  console.log('✅ All labels created!\n');
}

/**
 * Set up Gemini AI
 */
function setupGeminiAI(ui) {
  console.log('🤖 Setting up Gemini AI...');
  
  // Check if API key already exists
  const props = PropertiesService.getScriptProperties();
  let apiKey = props.getProperty('GEMINI_API_KEY');
  
  if (!apiKey) {
    // Ask for API key
    const result = ui.prompt(
      '🔑 Gemini API Key Required',
      'Please enter your Gemini API key:\n\n' +
      'Get one free at: https://makersuite.google.com/app/apikey\n\n' +
      '(Your key will be stored securely)',
      ui.ButtonSet.OK_CANCEL
    );
    
    if (result.getSelectedButton() == ui.Button.OK) {
      apiKey = result.getResponseText().trim();
      props.setProperty('GEMINI_API_KEY', apiKey);
    } else {
      throw new Error('API key is required for AI features');
    }
  }
  
  console.log('✅ Gemini AI configured!\n');
  return apiKey;
}

/**
 * Create Knowledge Base spreadsheet
 */
function createKnowledgeBase() {
  console.log('📚 Creating Knowledge Base...');
  
  // Create new spreadsheet
  const kb = SpreadsheetApp.create('Gmail Support - Knowledge Base');
  const sheet = kb.getActiveSheet();
  
  // Set up headers
  sheet.getRange('A1:G1').setValues([[
    'ID', 'Title', 'Category', 'Question', 'Answer', 'Tags', 'Language'
  ]]);
  sheet.getRange('A1:G1').setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
  
  // Add sample articles
  const sampleArticles = [
    ['KB001', 'How to reset password', 'Account', 'I forgot my password', 'To reset your password:\n1. Go to login page\n2. Click "Forgot Password"\n3. Enter your email\n4. Check your email for reset link\n5. Create new password', 'password,reset,login', 'en'],
    ['KB002', 'Billing questions', 'Billing', 'How do I update my payment method?', 'To update payment:\n1. Go to Account Settings\n2. Click Billing\n3. Update payment method\n4. Save changes', 'billing,payment,credit card', 'en'],
    ['KB003', 'Technical support', 'Technical', 'The app is not working', 'Try these steps:\n1. Clear browser cache\n2. Try different browser\n3. Check internet connection\n4. Disable extensions\n5. Contact support if issue persists', 'technical,error,not working', 'en'],
    ['KB004', 'How to cancel subscription', 'Billing', 'I want to cancel', 'To cancel subscription:\n1. Go to Account Settings\n2. Click Subscription\n3. Click Cancel\n4. Confirm cancellation\nYou will have access until end of billing period', 'cancel,subscription,refund', 'en'],
    ['KB005', 'Feature request', 'Feature', 'Can you add this feature?', 'Thanks for the suggestion! Please submit feature requests to:\n1. feedback@company.com\n2. Or use in-app feedback\n3. We review all suggestions\n4. Popular requests get prioritized', 'feature,request,suggestion', 'en']
  ];
  
  sheet.getRange(2, 1, sampleArticles.length, 7).setValues(sampleArticles);
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, 7);
  
  // Make it pretty
  sheet.setFrozenRows(1);
  const range = sheet.getDataRange();
  range.setBorder(true, true, true, true, true, true);
  
  console.log(`✅ Knowledge Base created: ${kb.getUrl()}\n`);
  return kb.getUrl();
}

/**
 * Configure the system
 */
function configureSystem(apiKey, kbUrl) {
  console.log('⚙️ Configuring system...');
  
  const props = PropertiesService.getScriptProperties();
  
  // Extract KB sheet ID from URL
  const kbId = kbUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)[1];
  
  // Set all configuration
  const config = {
    // Email settings
    'config.email.supportLabel': 'Support',
    'config.email.processedLabel': 'AI-Processed',
    'config.email.errorLabel': 'AI-Failed',
    'config.email.maxAutoReplies': '3',
    'config.email.signatureName': 'Support Team',
    
    // AI settings
    'config.ai.provider': 'gemini',
    'config.ai.model': 'gemini-pro',
    'config.ai.temperature': '0.7',
    'config.ai.apiKey': apiKey,
    
    // Knowledge base
    'config.knowledgeBase.sheetId': kbId,
    'config.knowledgeBase.cacheEnabled': 'true',
    'config.knowledgeBase.cacheExpiry': '3600',
    
    // Support settings
    'config.support.autoReply': 'true',
    'config.support.businessHours': '9-17',
    'config.support.timezone': 'America/New_York',
    'config.support.categories': 'technical,billing,general,feedback',
    
    // Loop prevention
    'config.loopPrevention.enabled': 'true',
    'config.loopPrevention.maxEmails': '5',
    'config.loopPrevention.timeWindow': '3600',
    
    // SLA settings
    'config.sla.urgent.response': '60',
    'config.sla.urgent.resolution': '240',
    'config.sla.high.response': '240',
    'config.sla.high.resolution': '480',
    'config.sla.medium.response': '480',
    'config.sla.medium.resolution': '1440',
    'config.sla.low.response': '1440',
    'config.sla.low.resolution': '2880'
  };
  
  Object.entries(config).forEach(([key, value]) => {
    props.setProperty(key, value);
  });
  
  console.log('✅ System configured!\n');
}

/**
 * Deploy web app
 */
function deployWebApp() {
  console.log('🌐 Deploying web interface...');
  
  // Note: In Apps Script, we can't programmatically deploy
  // But we can prepare everything
  
  // Get the web app URL if already deployed
  const webAppUrl = ScriptApp.getService().getUrl();
  
  if (webAppUrl && webAppUrl !== '') {
    console.log(`✅ Web app URL: ${webAppUrl}\n`);
    return webAppUrl;
  } else {
    // Provide instructions
    console.log('📌 Please deploy manually:');
    console.log('   1. Click "Deploy" > "New Deployment"');
    console.log('   2. Choose "Web app"');
    console.log('   3. Set "Execute as: Me"');
    console.log('   4. Set "Who has access: Anyone"');
    console.log('   5. Click "Deploy"');
    console.log('   6. Copy the Web app URL\n');
    
    return 'Please deploy manually (see email for instructions)';
  }
}

/**
 * Set up automation triggers
 */
function setupAutomation() {
  console.log('⏰ Setting up automation...');
  
  // Remove existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Create new triggers
  
  // 1. Process emails every 5 minutes
  ScriptApp.newTrigger('processNewSupportEmails')
    .timeBased()
    .everyMinutes(5)
    .create();
  console.log('   ✅ Email processing: Every 5 minutes');
  
  // 2. Check SLAs every 30 minutes
  ScriptApp.newTrigger('checkSLACompliance')
    .timeBased()
    .everyMinutes(30)
    .create();
  console.log('   ✅ SLA monitoring: Every 30 minutes');
  
  // 3. Daily report at 9 AM
  ScriptApp.newTrigger('generateDailyReport')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
  console.log('   ✅ Daily reports: 9 AM every day');
  
  // 4. Knowledge base sync every hour
  ScriptApp.newTrigger('syncKnowledgeBase')
    .timeBased()
    .everyHours(1)
    .create();
  console.log('   ✅ KB sync: Every hour');
  
  console.log('✅ Automation configured!\n');
}

/**
 * Send welcome email
 */
function sendWelcomeEmail(webAppUrl) {
  console.log('📬 Sending welcome email...');
  
  const email = Session.getActiveUser().getEmail();
  const kbUrl = getKnowledgeBaseUrl();
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #4285f4; }
    h2 { color: #34a853; margin-top: 30px; }
    .box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #4285f4; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    code { background: #f1f3f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
    .step { margin: 15px 0; padding-left: 30px; position: relative; }
    .step:before { content: "✓"; position: absolute; left: 0; color: #34a853; font-weight: bold; }
    .feature { margin: 10px 0; padding-left: 25px; position: relative; }
    .feature:before { content: "•"; position: absolute; left: 0; color: #4285f4; font-size: 20px; }
  </style>
</head>
<body>
  <h1>🎉 Your Gmail Support System is Ready!</h1>
  
  <p>Congratulations! Your AI-powered support system is now running on autopilot.</p>
  
  <div class="box">
    <h2>🚀 Quick Start</h2>
    <p><strong>Your system is already processing emails!</strong></p>
    <div class="feature">Checking for new support emails every 5 minutes</div>
    <div class="feature">Auto-responding with AI-powered answers</div>
    <div class="feature">Creating tickets for follow-up</div>
    <div class="feature">Tracking SLAs and escalations</div>
  </div>
  
  <div class="box">
    <h2>📧 How It Works</h2>
    <div class="step">Customers email your regular Gmail address</div>
    <div class="step">System automatically adds them to "Support" label</div>
    <div class="step">AI analyzes the email and searches knowledge base</div>
    <div class="step">Sends intelligent response within minutes</div>
    <div class="step">Creates ticket for tracking</div>
    <div class="step">Escalates if needed</div>
  </div>
  
  <div class="box">
    <h2>🔗 Your Resources</h2>
    <p><strong>Web Dashboard:</strong><br>
    <a href="${webAppUrl}" class="button">Open Dashboard</a></p>
    
    <p><strong>Knowledge Base:</strong><br>
    <a href="${kbUrl}">Edit Knowledge Base</a><br>
    <em>Add your own Q&As here to improve AI responses!</em></p>
    
    <p><strong>Gmail Labels:</strong><br>
    Check your Gmail - all labels have been created automatically!</p>
  </div>
  
  <div class="box">
    <h2>🎯 What's Next?</h2>
    <ol>
      <li><strong>Test it!</strong> Send a test email to yourself with a support question</li>
      <li><strong>Customize:</strong> Add your company's FAQs to the Knowledge Base</li>
      <li><strong>Monitor:</strong> Check the dashboard to see tickets and metrics</li>
      <li><strong>Relax:</strong> Let the AI handle your support emails!</li>
    </ol>
  </div>
  
  <div class="box">
    <h2>⚙️ Settings</h2>
    <p>Your system is configured with smart defaults:</p>
    <div class="feature">Business hours: 9 AM - 5 PM (Your timezone)</div>
    <div class="feature">Auto-reply: Enabled</div>
    <div class="feature">Max auto-replies: 3 per conversation</div>
    <div class="feature">SLA monitoring: Active</div>
    <p><em>To change settings, edit the script properties.</em></p>
  </div>
  
  <div class="box" style="background: #e8f5e9;">
    <h2>💡 Pro Tips</h2>
    <div class="feature">The more KB articles you add, the smarter the AI becomes</div>
    <div class="feature">Use specific categories (Technical, Billing, etc.) for better routing</div>
    <div class="feature">Check "AI-Failed" label for emails that need manual review</div>
    <div class="feature">The system learns from resolved tickets</div>
  </div>
  
  <p style="text-align: center; color: #666; margin-top: 40px;">
    <strong>Need help?</strong> Just reply to this email!<br>
    Your Gmail Support System v1.0
  </p>
</body>
</html>
  `;
  
  GmailApp.sendEmail(
    email,
    '🎉 Your Gmail Support System is Ready!',
    'Your AI-powered support system is now live! View this email in HTML for the complete guide.',
    {
      htmlBody: htmlBody,
      name: 'Gmail Support System'
    }
  );
  
  console.log('✅ Welcome email sent!\n');
}

/**
 * Helper function to show progress
 */
function showProgress(message, percentage) {
  console.log(`[${percentage}%] ${message}`);
  Utilities.sleep(500); // Brief pause for visual effect
}

/**
 * Get knowledge base URL
 */
function getKnowledgeBaseUrl() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('config.knowledgeBase.sheetId');
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

/**
 * Quick test function
 */
function testSystem() {
  const ui = SpreadsheetApp.getUi();
  
  ui.alert('🧪 System Test',
    'This will send a test support email to yourself.\n\n' +
    'The AI should respond within 5 minutes.',
    ui.ButtonSet.OK);
  
  const email = Session.getActiveUser().getEmail();
  
  GmailApp.sendEmail(
    email,
    'Test Support Request - Password Reset',
    'Hi, I forgot my password and need help resetting it. My username is testuser123. Thanks!',
    {
      name: 'Test Customer'
    }
  );
  
  ui.alert('✅ Test Email Sent!',
    'Check your inbox in a few minutes.\n\n' +
    'You should see:\n' +
    '1. The email labeled as "Support"\n' +
    '2. An AI response within 5 minutes\n' +
    '3. The email moved to "AI-Processed"',
    ui.ButtonSet.OK);
}

/**
 * Uninstall function
 */
function uninstallSystem() {
  const ui = SpreadsheetApp.getUi();
  
  const result = ui.alert('⚠️ Uninstall System?',
    'This will:\n' +
    '• Remove all triggers\n' +
    '• Clear configuration\n' +
    '• Keep your emails and labels\n\n' +
    'Are you sure?',
    ui.ButtonSet.YES_NO);
  
  if (result == ui.Button.YES) {
    // Remove triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
    
    // Clear properties
    const props = PropertiesService.getScriptProperties();
    props.deleteAllProperties();
    
    ui.alert('✅ System Uninstalled',
      'The automation has been stopped.\n' +
      'Your emails and labels remain intact.',
      ui.ButtonSet.OK);
  }
}