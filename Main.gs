/**
 * Main.gs - Gmail Support System Entry Point
 * 
 * This is the main controller that orchestrates all services
 * Includes comprehensive error handling and production safety
 */

// ==================== INITIALIZATION ====================

/**
 * Initialize system on script load
 */
function onOpen() {
  try {
    // Initialize production fixes
    if (typeof initializeProductionFixes !== 'undefined') {
      initializeProductionFixes();
    }
    
    // Initialize services
    Config.init();
    
    logInfo('Gmail Support System initialized');
  } catch (error) {
    console.error('Failed to initialize system:', error);
  }
}

// ==================== MAIN ENTRY POINTS ====================

/**
 * Main entry point for email processing
 */
function processEmails() {
  logInfo('Starting email processing');
  
  try {
    // Check execution time
    if (!Safety.canContinue(120000)) {
      logWarn('Insufficient execution time for email processing');
      return;
    }
    
    // Check rate limits
    SafetyService.checkRateLimit('process_emails', 10, 100);
    
    // Get unread emails
    const emails = getUnreadEmails();
    logInfo(`Found ${emails.length} unread support emails`);
    
    // Process in batches for better performance
    const results = PerformanceUtils.batchProcess(emails, processEmail, 5);
    
    // Log results
    logInfo(`Processed ${results.results.length} emails successfully`);
    if (results.errors.length > 0) {
      logError(`Failed to process ${results.errors.length} emails`, { errors: results.errors });
    }
    
    // Update metrics
    Metrics.recordBatch('emails_processed', results.results.length);
    Metrics.recordBatch('emails_failed', results.errors.length);
    
  } catch (error) {
    logError('Email processing failed', { error: error.message });
    handleError(error, { operation: 'processEmails' });
  }
}

/**
 * Process a single email with comprehensive safety checks
 */
function processEmail(email) {
  profile('process_email');
  
  try {
    // Validate email data
    if (!email || !email.id || !SafetyService.isValidEmail(email.from)) {
      logError('Invalid email data', { email });
      return;
    }
    
    // Check for loops
    if (!shouldProcessEmail(email)) {
      logWarn('Email blocked by loop prevention', { email: email.id });
      markAsProcessed(email);
      return;
    }
    
    // Check execution time
    if (!Safety.canContinue(30000)) {
      logWarn('Insufficient time to process email', { email: email.id });
      return;
    }
    
    // Get or create ticket
    let ticket = getTicketByThreadId(email.threadId);
    
    if (!ticket) {
      // Analyze email first
      const analysis = AIService.analyzeEmail(email);
      
      // Create ticket with analysis
      ticket = createTicket(email, {
        priority: analysis.priority,
        category: analysis.category,
        analysis: analysis
      });
    }
    
    // Check if ticket needs response
    const knowledgeResults = KnowledgeBase.search(email.body);
    const shouldReply = AutoReply.shouldRespond(ticket, email);
    
    if (shouldReply) {
      const response = AutoReply.generateResponse(email, knowledgeResults, ticket);
      
      if (response.confidence >= Config.get('support.minConfidence')) {
        AutoReply.send(email, response, ticket);
        updateTicket(ticket.id, { 
          status: 'waiting_customer',
          lastReply: new Date().toISOString()
        });
      } else {
        // Escalate low confidence responses
        Escalation.escalate(ticket, 'Low confidence response');
      }
    }
    
    // Check escalation rules
    if (Escalation.shouldEscalate(ticket, email)) {
      Escalation.escalate(ticket, 'Escalation rules triggered');
    }
    
    // Mark as processed
    markAsProcessed(email);
    
    profileEnd('process_email');
    
    logInfo('Email processed successfully', {
      ticketId: ticket.id,
      category: ticket.category,
      priority: ticket.priority
    });
    
    return ticket;
    
  } catch (error) {
    profileEnd('process_email');
    logError('Failed to process email', { 
      emailId: email?.id,
      error: error.message 
    });
    throw error;
  }
}

/**
 * Get unread support emails with safety checks
 */
function getUnreadEmails() {
  const supportLabel = Config.get('labels.support');
  const unreadLabel = Config.get('labels.unread');
  
  if (!supportLabel || !unreadLabel) {
    throw new Error('Support labels not configured');
  }
  
  const query = `label:${supportLabel} label:${unreadLabel} is:unread`;
  const threads = GmailApp.search(query, 0, 50);
  
  const emails = [];
  
  threads.forEach(thread => {
    if (!thread) return;
    
    const messages = thread.getMessages();
    
    messages.forEach(message => {
      if (!message || !message.isUnread()) return;
      
      try {
        const from = message.getFrom() || 'unknown@example.com';
        const subject = message.getSubject() || '(No Subject)';
        const body = message.getPlainBody() || '';
        const date = message.getDate() || new Date();
        
        // Parse email address safely
        const parsedFrom = SafetyService.parseEmailAddress(from);
        
        emails.push({
          id: message.getId(),
          threadId: thread.getId(),
          from: parsedFrom.email,
          fromDisplay: parsedFrom.display,
          subject: subject,
          body: body.substring(0, 10000), // Limit body size
          date: date,
          labels: thread.getLabels().map(l => l.getName()),
          isUnread: message.isUnread(),
          messageCount: thread.getMessageCount(),
          headers: SafetyService.extractHeaders(message)
        });
      } catch (error) {
        logError('Failed to parse message', { 
          messageId: message.getId(),
          error: error.message 
        });
      }
    });
  });
  
  return emails;
}

/**
 * Mark email as processed
 */
function markAsProcessed(email) {
  try {
    const thread = GmailApp.getThreadById(email.threadId);
    if (!thread) return;
    
    const processedLabel = Config.get('labels.processed');
    Email.addLabel(thread, processedLabel);
    
    // Mark as read
    thread.markRead();
    
  } catch (error) {
    logError('Failed to mark email as processed', {
      emailId: email.id,
      error: error.message
    });
  }
}

// ==================== SCHEDULED TASKS ====================

/**
 * Check for escalations
 */
function checkEscalations() {
  try {
    if (!Safety.canContinue(60000)) {
      logWarn('Insufficient time for escalation check');
      return;
    }
    
    SafetyService.checkRateLimit('check_escalations', 2, 20);
    
    Escalation.checkAll();
    
  } catch (error) {
    logError('Escalation check failed', { error: error.message });
  }
}

/**
 * Send notifications
 */
function sendNotifications() {
  try {
    if (!Safety.canContinue(60000)) {
      logWarn('Insufficient time for notifications');
      return;
    }
    
    SafetyService.checkRateLimit('send_notifications', 5, 50);
    
    Notifications.sendPending();
    
  } catch (error) {
    logError('Notification sending failed', { error: error.message });
  }
}

/**
 * Update metrics
 */
function updateMetrics() {
  try {
    if (!Safety.canContinue(30000)) {
      logWarn('Insufficient time for metrics update');
      return;
    }
    
    Metrics.calculateDailyStats();
    Metrics.cleanup();
    
  } catch (error) {
    logError('Metrics update failed', { error: error.message });
  }
}

/**
 * Daily maintenance
 */
function dailyMaintenance() {
  try {
    logInfo('Starting daily maintenance');
    
    // Clean up old data
    const cleaned = DataIntegrity.cleanupOldData(90);
    logInfo(`Cleaned up ${cleaned} old properties`);
    
    // Validate critical services
    const validation = validateCriticalServices();
    
    // Generate daily report
    const report = Metrics.generateDailyReport();
    
    // Send maintenance report
    if (Config.get('maintenance.reportEmail')) {
      Email.send({
        to: Config.get('maintenance.reportEmail'),
        subject: 'Daily Maintenance Report',
        body: report
      });
    }
    
    logInfo('Daily maintenance completed');
    
  } catch (error) {
    logError('Daily maintenance failed', { error: error.message });
  }
}

// ==================== WEB APP INTERFACE ====================

/**
 * Handle GET requests
 */
function doGet() {
  try {
    return HtmlService.createTemplateFromFile('Dashboard')
      .evaluate()
      .setTitle('Gmail Support System')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    return HtmlService.createHtmlOutput('<h1>Error loading dashboard</h1><p>' + error.message + '</p>');
  }
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    switch (data.action) {
      case 'webhook':
        return handleWebhook(data);
      case 'api':
        return handleApiCall(data);
      default:
        return ContentService.createTextOutput(JSON.stringify({
          error: 'Unknown action'
        })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle webhook
 */
function handleWebhook(data) {
  // Process webhook data
  logInfo('Webhook received', { type: data.type });
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle API call
 */
function handleApiCall(data) {
  // Validate API key
  if (data.apiKey !== Config.get('api.key')) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Invalid API key'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Process API call
  const result = processApiRequest(data);
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get dashboard data
 */
function getDashboardData() {
  try {
    const stats = getTicketStatistics();
    const recentTickets = searchTickets('', { limit: 20 });
    const metrics = Metrics.getRealtimeMetrics();
    
    return {
      stats: stats,
      tickets: recentTickets.tickets,
      metrics: metrics,
      health: getSystemHealth()
    };
  } catch (error) {
    logError('Failed to get dashboard data', { error: error.message });
    return {
      error: error.message,
      stats: {},
      tickets: [],
      metrics: {}
    };
  }
}

/**
 * Get system health
 */
function getSystemHealth() {
  const health = {
    status: 'healthy',
    services: {},
    warnings: []
  };
  
  // Check service health
  const services = ['Gmail', 'AI', 'Cache', 'Properties'];
  
  services.forEach(service => {
    try {
      switch (service) {
        case 'Gmail':
          GmailApp.getInboxUnreadCount();
          health.services[service] = 'operational';
          break;
        case 'AI':
          health.services[service] = Config.get('ai.apiKey') ? 'operational' : 'not configured';
          break;
        case 'Cache':
          CacheService.getScriptCache().get('test');
          health.services[service] = 'operational';
          break;
        case 'Properties':
          PropertiesService.getScriptProperties().getProperty('test');
          health.services[service] = 'operational';
          break;
      }
    } catch (error) {
      health.services[service] = 'error';
      health.warnings.push(`${service}: ${error.message}`);
      health.status = 'degraded';
    }
  });
  
  // Check execution time
  const remainingTime = Safety.getRemainingTime();
  if (remainingTime < 60000) {
    health.warnings.push('Low execution time remaining');
  }
  
  return health;
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Include HTML file
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Get script URL
 */
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Get user email
 */
function getUserEmail() {
  return Session.getActiveUser().getEmail();
}

// ==================== ERROR RECOVERY ====================

/**
 * Global error handler
 */
function handleGlobalError(error, context = {}) {
  console.error('Global error:', error);
  
  try {
    // Log to error tracking
    if (typeof ErrorHandler !== 'undefined') {
      ErrorHandler.handle(error, context);
    }
    
    // Send critical error notification
    if (error.message && error.message.includes('Script approaching')) {
      // Script timeout - schedule continuation
      scheduleContinuation(context);
    }
    
  } catch (e) {
    console.error('Error handler failed:', e);
  }
}

/**
 * Schedule continuation after timeout
 */
function scheduleContinuation(context) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('continuation_context', JSON.stringify({
      ...context,
      scheduledAt: new Date().toISOString()
    }));
    
    // Create one-time trigger
    ScriptApp.newTrigger('continuePreviousExecution')
      .timeBased()
      .after(1000) // 1 second later
      .create();
      
  } catch (error) {
    console.error('Failed to schedule continuation:', error);
  }
}

/**
 * Continue previous execution
 */
function continuePreviousExecution() {
  try {
    const props = PropertiesService.getScriptProperties();
    const contextStr = props.getProperty('continuation_context');
    
    if (!contextStr) return;
    
    const context = JSON.parse(contextStr);
    props.deleteProperty('continuation_context');
    
    logInfo('Continuing previous execution', context);
    
    // Resume based on context
    if (context.operation === 'processEmails') {
      processEmails();
    }
    
  } catch (error) {
    logError('Failed to continue execution', { error: error.message });
  }
}

// ==================== INITIALIZATION ====================

// Initialize on load
onOpen();