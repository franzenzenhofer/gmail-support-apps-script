/**
 * SafeEmailService.gs - Email Service with Safety Controls
 * 
 * Wraps EmailService to respect DRAFT_MODE and other safety settings
 * This ensures no accidental email sending in test/development
 */

class SafeEmailService {
  constructor() {
    this.emailService = new EmailService();
    this.loadSafetyConfig();
  }
  
  /**
   * Load current safety configuration
   */
  loadSafetyConfig() {
    if (typeof getSafetyConfig === 'function') {
      this.safetyConfig = getSafetyConfig();
    } else {
      // Fallback if SafetyConfig.gs not loaded yet
      this.safetyConfig = {
        draftMode: true,
        testMode: true,
        dryRun: false,
        verboseLogging: true
      };
    }
  }
  
  /**
   * Safe send email - respects DRAFT_MODE
   */
  sendEmail(to, subject, body, options = {}) {
    this.loadSafetyConfig(); // Reload config each time
    
    // Check if we should process this email
    if (typeof shouldProcessEmail === 'function' && !shouldProcessEmail(to)) {
      console.log(`[SAFETY] Skipping email to ${to} due to safety rules`);
      return null;
    }
    
    // Dry run mode - just log
    if (this.safetyConfig.dryRun) {
      console.log('[DRY RUN] Would send email:', { to, subject });
      return { id: 'dry-run-' + Date.now(), status: 'dry-run' };
    }
    
    // DRAFT MODE - create draft instead of sending
    if (this.safetyConfig.draftMode) {
      console.log('[DRAFT MODE] Creating draft instead of sending email');
      
      // Add draft mode indicator to subject
      const draftSubject = '[DRAFT] ' + subject;
      
      // Add safety notice to body
      const draftBody = 
        '⚠️ THIS IS A DRAFT - Created by Gmail Support System in DRAFT MODE\n' +
        '📧 To: ' + to + '\n' +
        '📝 Original Subject: ' + subject + '\n' +
        '⏰ Created: ' + new Date().toLocaleString() + '\n' +
        '✅ Review and send manually if appropriate\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        body;
      
      try {
        const draft = this.emailService.createDraft(to, draftSubject, draftBody, options);
        
        // Log draft creation
        if (this.safetyConfig.verboseLogging) {
          console.log('[DRAFT CREATED]', {
            to: to,
            subject: subject,
            draftId: draft.id,
            timestamp: new Date().toISOString()
          });
        }
        
        return { id: draft.id, status: 'draft', draftMode: true };
        
      } catch (error) {
        console.error('[DRAFT ERROR] Failed to create draft:', error);
        throw error;
      }
    }
    
    // LIVE MODE - actually send email (with extra logging)
    console.warn('⚠️ [LIVE MODE] Sending actual email to:', to);
    
    try {
      const result = this.emailService.sendEmail(to, subject, body, options);
      
      if (this.safetyConfig.verboseLogging) {
        console.log('[EMAIL SENT]', {
          to: to,
          subject: subject,
          timestamp: new Date().toISOString(),
          liveMode: true
        });
      }
      
      return { ...result, status: 'sent', liveMode: true };
      
    } catch (error) {
      console.error('[SEND ERROR] Failed to send email:', error);
      throw error;
    }
  }
  
  /**
   * Safe reply to thread - respects DRAFT_MODE
   */
  replyToThread(threadId, body, options = {}) {
    this.loadSafetyConfig();
    
    // Get thread details for logging
    const thread = this.emailService.getThread(threadId);
    const lastMessage = thread.getMessages().pop();
    const to = lastMessage.getFrom();
    
    // Check if we should process this
    if (typeof shouldProcessEmail === 'function' && !shouldProcessEmail(to)) {
      console.log(`[SAFETY] Skipping reply to ${to} due to safety rules`);
      return null;
    }
    
    // Dry run mode
    if (this.safetyConfig.dryRun) {
      console.log('[DRY RUN] Would reply to thread:', threadId);
      return { id: 'dry-run-reply-' + Date.now(), status: 'dry-run' };
    }
    
    // DRAFT MODE - create draft reply
    if (this.safetyConfig.draftMode) {
      console.log('[DRAFT MODE] Creating draft reply instead of sending');
      
      const draftBody = 
        '⚠️ THIS IS A DRAFT REPLY - Created by Gmail Support System in DRAFT MODE\n' +
        '📧 Reply to: ' + to + '\n' +
        '🔗 Thread: ' + thread.getFirstMessageSubject() + '\n' +
        '⏰ Created: ' + new Date().toLocaleString() + '\n' +
        '✅ Review and send manually if appropriate\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        body;
      
      try {
        // Create a draft in the thread
        const draft = thread.createDraftReply(draftBody, {
          htmlBody: options.htmlBody || this.emailService.convertToHtml(draftBody),
          cc: options.cc,
          bcc: options.bcc,
          attachments: options.attachments
        });
        
        if (this.safetyConfig.verboseLogging) {
          console.log('[DRAFT REPLY CREATED]', {
            threadId: threadId,
            to: to,
            timestamp: new Date().toISOString()
          });
        }
        
        return { id: draft.getId(), status: 'draft-reply', draftMode: true };
        
      } catch (error) {
        console.error('[DRAFT REPLY ERROR]:', error);
        throw error;
      }
    }
    
    // LIVE MODE - actually send reply
    console.warn('⚠️ [LIVE MODE] Sending actual reply in thread:', threadId);
    
    try {
      const result = this.emailService.replyToThread(threadId, body, options);
      
      if (this.safetyConfig.verboseLogging) {
        console.log('[REPLY SENT]', {
          threadId: threadId,
          to: to,
          timestamp: new Date().toISOString(),
          liveMode: true
        });
      }
      
      return { ...result, status: 'sent-reply', liveMode: true };
      
    } catch (error) {
      console.error('[REPLY ERROR]:', error);
      throw error;
    }
  }
  
  /**
   * Get safety status for dashboard
   */
  getSafetyStatus() {
    this.loadSafetyConfig();
    
    return {
      mode: this.safetyConfig.draftMode ? 'DRAFT' : 'LIVE',
      testMode: this.safetyConfig.testMode,
      dryRun: this.safetyConfig.dryRun,
      emergencyStop: this.safetyConfig.emergencyStop,
      testEmails: this.safetyConfig.testEmailAddresses || [],
      sandboxDomains: this.safetyConfig.allowedDomains || [],
      maxEmailsPerRun: this.safetyConfig.maxEmailsPerRun
    };
  }
  
  // Delegate other methods to EmailService
  searchEmails(...args) { return this.emailService.searchEmails(...args); }
  getThread(...args) { return this.emailService.getThread(...args); }
  getThreads(...args) { return this.emailService.getThreads(...args); }
  parseEmail(...args) { return this.emailService.parseEmail(...args); }
  addLabel(...args) { return this.emailService.addLabel(...args); }
  removeLabel(...args) { return this.emailService.removeLabel(...args); }
  markAsRead(...args) { return this.emailService.markAsRead(...args); }
  createDraft(...args) { 
    console.log('[INFO] Creating draft directly (bypassing safety checks)');
    return this.emailService.createDraft(...args); 
  }
}

// Create singleton instance
const SafeEmail = new SafeEmailService();

// Export convenience functions
function sendSafeEmail(to, subject, body, options) {
  return SafeEmail.sendEmail(to, subject, body, options);
}

function replySafeToThread(threadId, body, options) {
  return SafeEmail.replyToThread(threadId, body, options);
}

function getEmailSafetyStatus() {
  return SafeEmail.getSafetyStatus();
}