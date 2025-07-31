/**
 * SafetyConfig.gs - Critical Safety Configuration
 * 
 * IMPORTANT: This file controls whether the system sends real emails or creates drafts
 * Always start with DRAFT_MODE = true for safety
 */

// ==================== SAFETY CONFIGURATION ====================

/**
 * DRAFT MODE - CRITICAL SAFETY SETTING
 * 
 * When TRUE: 
 * - All emails are created as DRAFTS only
 * - No emails are automatically sent
 * - Human review required before sending
 * - Dashboard shows warning banner
 * 
 * When FALSE:
 * - Emails are sent automatically
 * - Use only after thorough testing
 * - Ensure all configurations are correct
 * 
 * DEFAULT: true (SAFE MODE)
 */
const DRAFT_MODE = true;

/**
 * Additional safety settings
 */
const SAFETY_CONFIG = {
  // Draft mode setting
  draftMode: DRAFT_MODE,
  
  // Maximum emails to process per run (prevents runaway processing)
  maxEmailsPerRun: 10,
  
  // Maximum auto-replies per thread
  maxAutoRepliesPerThread: 3,
  
  // Require manual approval for first-time senders
  requireApprovalForNewSenders: true,
  
  // Test mode - only process emails from these addresses
  testMode: true, // START IN TEST MODE FOR SAFETY
  testEmailAddresses: [
    'team@fullstackoptimization.com', // Franz's team email
    'franzenzenhofer@gmail.com', // Add Franz's personal email if needed
    // Add your test email addresses here
  ],
  
  // Dry run mode - process but don't create drafts or send
  dryRun: false,
  
  // Warning message for dashboard
  draftModeWarning: '⚠️ DRAFT MODE ACTIVE - All emails will be created as drafts only. No emails will be sent automatically.',
  
  // Log all actions for audit trail
  verboseLogging: true,
  
  // Sandbox domains - only process emails from these domains
  sandboxMode: false,
  allowedDomains: [
    // 'yourdomain.com',
  ],
  
  // Emergency stop - set to true to halt all processing
  emergencyStop: false,
};

/**
 * Get current safety configuration
 */
function getSafetyConfig() {
  // Check if override exists in Script Properties
  const props = PropertiesService.getScriptProperties();
  const override = props.getProperty('SAFETY_CONFIG_OVERRIDE');
  
  if (override) {
    try {
      const overrideConfig = JSON.parse(override);
      return Object.assign({}, SAFETY_CONFIG, overrideConfig);
    } catch (e) {
      console.error('Invalid safety config override:', e);
    }
  }
  
  return SAFETY_CONFIG;
}

/**
 * Check if system is in draft mode
 */
function isDraftMode() {
  const config = getSafetyConfig();
  return config.draftMode === true;
}

/**
 * Check if system should process this email
 */
function shouldProcessEmail(fromAddress) {
  const config = getSafetyConfig();
  
  // Emergency stop check
  if (config.emergencyStop) {
    console.log('⛔ Emergency stop is active. No emails will be processed.');
    return false;
  }
  
  // Test mode check
  if (config.testMode && config.testEmailAddresses.length > 0) {
    const isTestEmail = config.testEmailAddresses.some(
      testEmail => fromAddress.toLowerCase().includes(testEmail.toLowerCase())
    );
    if (!isTestEmail) {
      console.log(`Test mode: Skipping email from ${fromAddress}`);
      return false;
    }
  }
  
  // Sandbox mode check
  if (config.sandboxMode && config.allowedDomains.length > 0) {
    const domain = fromAddress.split('@')[1]?.toLowerCase();
    const isAllowed = config.allowedDomains.some(
      allowedDomain => domain === allowedDomain.toLowerCase()
    );
    if (!isAllowed) {
      console.log(`Sandbox mode: Skipping email from ${fromAddress}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Log safety status on initialization
 */
function logSafetyStatus() {
  const config = getSafetyConfig();
  
  console.log('=== SAFETY CONFIGURATION STATUS ===');
  console.log(`DRAFT MODE: ${config.draftMode ? '✅ ACTIVE (Safe)' : '⚠️ INACTIVE (Live emails)'}`);
  console.log(`Test Mode: ${config.testMode ? 'Active' : 'Inactive'}`);
  console.log(`Sandbox Mode: ${config.sandboxMode ? 'Active' : 'Inactive'}`);
  console.log(`Dry Run: ${config.dryRun ? 'Active' : 'Inactive'}`);
  console.log(`Emergency Stop: ${config.emergencyStop ? '⛔ ACTIVE' : 'Inactive'}`);
  console.log(`Max Emails Per Run: ${config.maxEmailsPerRun}`);
  console.log('==================================');
  
  if (!config.draftMode) {
    console.warn('⚠️ WARNING: System is configured to send LIVE emails!');
  }
}

/**
 * Update safety configuration (admin only)
 */
function updateSafetyConfig(updates) {
  if (!updates || typeof updates !== 'object') {
    throw new Error('Invalid configuration updates');
  }
  
  // Get current config
  const currentConfig = getSafetyConfig();
  
  // Merge updates
  const newConfig = Object.assign({}, currentConfig, updates);
  
  // Save to Script Properties
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SAFETY_CONFIG_OVERRIDE', JSON.stringify(newConfig));
  
  // Log the change
  console.log('Safety configuration updated:', updates);
  logSafetyStatus();
  
  return newConfig;
}

/**
 * Reset to default safety configuration
 */
function resetSafetyConfig() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('SAFETY_CONFIG_OVERRIDE');
  
  console.log('Safety configuration reset to defaults');
  logSafetyStatus();
  
  return SAFETY_CONFIG;
}