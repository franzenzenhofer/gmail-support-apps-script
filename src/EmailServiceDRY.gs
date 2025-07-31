/**
 * EmailServiceDRY.gs - DRY Refactored Email Service
 * Extends BaseService to eliminate code duplication
 */

class EmailServiceDRY extends BaseService {
  constructor() {
    super('email');
  }
  
  /**
   * Service-specific initialization
   */
  initializeService() {
    this.labelCache = new Map();
    this.threadCache = new Map();
  }
  
  /**
   * Search emails with caching and error handling
   */
  searchEmails(query, options = {}) {
    return this.withErrorHandling('search', () => {
      return this.getCached(`search_${query}`, () => {
        const threads = GmailApp.search(query, options.start || 0, options.max || 50);
        return threads.map(thread => this.parseThread(thread));
      }, CACHE_TTL.SHORT);
    });
  }
  
  /**
   * Send email through SafeEmailService
   */
  sendEmail(to, subject, body, options = {}) {
    return this.withErrorHandling('send', () => {
      // Validate inputs
      const validation = this.validateInput(to, { required: true, type: 'email' });
      if (!validation.valid) {
        throw new Error(`Invalid email: ${validation.errors.join(', ')}`);
      }
      
      // Use SafeEmailService for sending
      return sendSafeEmail(validation.sanitized, subject, body, options);
    });
  }
  
  /**
   * Reply to thread with safety checks
   */
  replyToThread(threadId, body, options = {}) {
    return this.withErrorHandling('reply', () => {
      const validation = this.validateInput(body, { required: true, maxLength: 10000 });
      if (!validation.valid) {
        throw new Error(`Invalid reply body: ${validation.errors.join(', ')}`);
      }
      
      return replySafeToThread(threadId, validation.sanitized, options);
    });
  }
  
  /**
   * Get threads with batch processing
   */
  getThreads(query, options = {}) {
    return this.withErrorHandling('getThreads', () => {
      const threads = GmailApp.search(query, 0, options.limit || 100);
      
      // Process in batches to avoid timeout
      return this.batchProcess(threads, (batch) => {
        return batch.map(thread => ({
          id: thread.getId(),
          subject: thread.getFirstMessageSubject(),
          messageCount: thread.getMessageCount(),
          lastDate: thread.getLastMessageDate(),
          isUnread: thread.isUnread()
        }));
      }, 10);
    });
  }
  
  /**
   * Parse thread with caching
   */
  parseThread(thread) {
    const threadId = thread.getId();
    
    return this.getCached(`thread_${threadId}`, () => {
      const messages = thread.getMessages();
      return {
        id: threadId,
        subject: thread.getFirstMessageSubject(),
        messageCount: messages.length,
        messages: messages.map(msg => this.parseMessage(msg)),
        labels: thread.getLabels().map(label => label.getName()),
        lastDate: thread.getLastMessageDate(),
        isUnread: thread.isUnread()
      };
    }, CACHE_TTL.MEDIUM);
  }
  
  /**
   * Parse message with input sanitization
   */
  parseMessage(message) {
    return {
      id: message.getId(),
      subject: this.validateInput(message.getSubject(), {}).sanitized,
      body: this.validateInput(message.getPlainBody(), { maxLength: 50000 }).sanitized,
      from: message.getFrom(),
      to: message.getTo(),
      date: message.getDate(),
      isUnread: message.isUnread()
    };
  }
  
  /**
   * Add label with caching
   */
  addLabel(threadOrMessage, labelName) {
    return this.withErrorHandling('addLabel', () => {
      const label = this.getOrCreateLabel(labelName);
      if (threadOrMessage.addLabel) {
        threadOrMessage.addLabel(label);
      } else {
        threadOrMessage.getThread().addLabel(label);
      }
    });
  }
  
  /**
   * Get or create label with caching
   */
  getOrCreateLabel(labelName) {
    if (this.labelCache.has(labelName)) {
      return this.labelCache.get(labelName);
    }
    
    let label = GmailApp.getUserLabelByName(labelName);
    if (!label) {
      label = GmailApp.createLabel(labelName);
    }
    
    this.labelCache.set(labelName, label);
    return label;
  }
  
  /**
   * Create draft with validation
   */
  createDraft(to, subject, body, options = {}) {
    return this.withErrorHandling('createDraft', () => {
      const validation = this.validateInput(to, { required: true, type: 'email' });
      if (!validation.valid) {
        throw new Error(`Invalid email: ${validation.errors.join(', ')}`);
      }
      
      const draft = GmailApp.createDraft(validation.sanitized, subject, body, {
        htmlBody: options.htmlBody,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments
      });
      
      return {
        id: draft.getId(),
        message: draft.getMessage()
      };
    });
  }
  
  /**
   * Cleanup method for memory management
   */
  cleanup() {
    super.cleanup();
    this.labelCache.clear();
    this.threadCache.clear();
  }
}

// Create singleton instance
const EmailDRY = new EmailServiceDRY();

// Export wrapper functions
function searchEmailsDRY(query, options) {
  return EmailDRY.searchEmails(query, options);
}

function sendEmailDRY(to, subject, body, options) {
  return EmailDRY.sendEmail(to, subject, body, options);
}

function replyToThreadDRY(threadId, body, options) {
  return EmailDRY.replyToThread(threadId, body, options);
}