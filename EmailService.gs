/**
 * EmailService.gs - Gmail Operations Wrapper
 * 
 * Centralized email handling with DRY principles
 * KISS approach to Gmail API operations
 */

class EmailService {
  constructor() {
    this.config = Config.get('email');
    this.cache = CacheService.getScriptCache();
    this.rateLimiter = this.initRateLimiter();
  }

  /**
   * Initialize rate limiter
   */
  initRateLimiter() {
    return {
      maxPerMinute: 60,
      maxPerHour: 1000,
      checkLimit: (operation) => {
        const now = Date.now();
        const minute = Math.floor(now / 60000);
        const hour = Math.floor(now / 3600000);
        
        const minuteKey = `rate_${operation}_${minute}`;
        const hourKey = `rate_${operation}_${hour}`;
        
        const minuteCount = parseInt(this.cache.get(minuteKey) || '0');
        const hourCount = parseInt(this.cache.get(hourKey) || '0');
        
        if (minuteCount >= this.maxPerMinute || hourCount >= this.maxPerHour) {
          throw new Error('Rate limit exceeded');
        }
        
        this.cache.put(minuteKey, (minuteCount + 1).toString(), 60);
        this.cache.put(hourKey, (hourCount + 1).toString(), 3600);
      }
    };
  }

  /**
   * Search emails with filters
   */
  searchEmails(query, options = {}) {
    profile('email_search');
    
    try {
      this.rateLimiter.checkLimit('search');
      
      const maxResults = options.maxResults || this.config.maxEmailsPerBatch || 10;
      const threads = GmailApp.search(query, 0, maxResults);
      
      const emails = [];
      threads.forEach(thread => {
        const messages = thread.getMessages();
        messages.forEach(message => {
          emails.push(this.parseMessage(message, thread));
        });
      });
      
      profileEnd('email_search');
      
      logInfo(`Found ${emails.length} emails for query: ${query}`);
      return emails;
      
    } catch (error) {
      profileEnd('email_search');
      throw handleError(error, { operation: 'searchEmails', query });
    }
  }

  /**
   * Get email by ID
   */
  getEmailById(messageId) {
    try {
      const message = GmailApp.getMessageById(messageId);
      return this.parseMessage(message, message.getThread());
    } catch (error) {
      throw handleError(error, { operation: 'getEmailById', messageId });
    }
  }

  /**
   * Get thread by ID
   */
  getThreadById(threadId) {
    try {
      const thread = GmailApp.getThreadById(threadId);
      return this.parseThread(thread);
    } catch (error) {
      throw handleError(error, { operation: 'getThreadById', threadId });
    }
  }

  /**
   * Parse Gmail message
   */
  parseMessage(message, thread) {
    return {
      id: message.getId(),
      threadId: thread.getId(),
      from: message.getFrom(),
      to: message.getTo(),
      cc: message.getCc(),
      bcc: message.getBcc(),
      subject: message.getSubject(),
      date: message.getDate(),
      body: this.getMessageBody(message),
      plainBody: message.getPlainBody(),
      labels: thread.getLabels().map(l => l.getName()),
      isUnread: message.isUnread(),
      isStarred: message.isStarred(),
      isDraft: message.isDraft(),
      attachments: this.parseAttachments(message),
      headers: this.parseHeaders(message),
      messageCount: thread.getMessageCount(),
      replyTo: message.getReplyTo()
    };
  }

  /**
   * Parse thread
   */
  parseThread(thread) {
    const messages = thread.getMessages();
    return {
      id: thread.getId(),
      firstMessageSubject: thread.getFirstMessageSubject(),
      lastMessageDate: thread.getLastMessageDate(),
      messageCount: thread.getMessageCount(),
      labels: thread.getLabels().map(l => l.getName()),
      isImportant: thread.isImportant(),
      isUnread: thread.isUnread(),
      messages: messages.map(m => this.parseMessage(m, thread))
    };
  }

  /**
   * Get message body (prefer HTML)
   */
  getMessageBody(message) {
    const htmlBody = message.getBody();
    if (htmlBody) {
      return htmlBody;
    }
    
    // Convert plain text to HTML
    const plainBody = message.getPlainBody();
    return plainBody.replace(/\n/g, '<br>');
  }

  /**
   * Parse attachments
   */
  parseAttachments(message) {
    const attachments = message.getAttachments();
    return attachments.map(attachment => ({
      name: attachment.getName(),
      contentType: attachment.getContentType(),
      size: attachment.getSize(),
      hash: attachment.getHash()
    }));
  }

  /**
   * Parse headers
   */
  parseHeaders(message) {
    const headers = {};
    
    try {
      // Common headers
      headers['Message-ID'] = message.getHeader('Message-ID');
      headers['In-Reply-To'] = message.getHeader('In-Reply-To');
      headers['References'] = message.getHeader('References');
      headers['X-Mailer'] = message.getHeader('X-Mailer');
      headers['Return-Path'] = message.getHeader('Return-Path');
    } catch (error) {
      // Some headers might not be available
      logDebug('Some headers not available', { error: error.message });
    }
    
    return headers;
  }

  /**
   * Send email
   */
  sendEmail(to, subject, body, options = {}) {
    profile('email_send');
    
    try {
      this.rateLimiter.checkLimit('send');
      
      // Validate inputs
      if (!to || !subject || !body) {
        throw new Error('Missing required fields: to, subject, body');
      }
      
      // Build options
      const emailOptions = {
        htmlBody: options.htmlBody || this.convertToHtml(body),
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo || Config.get('email.replyTo'),
        attachments: options.attachments,
        inlineImages: options.inlineImages
      };
      
      // Add signature
      if (this.config.replySignature && !options.noSignature) {
        emailOptions.htmlBody += `<br><br>${this.config.replySignature.replace(/\n/g, '<br>')}`;
      }
      
      // Send email
      GmailApp.sendEmail(to, subject, body, emailOptions);
      
      profileEnd('email_send');
      
      logInfo('Email sent', {
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        hasAttachments: !!options.attachments
      });
      
      return {
        success: true,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      profileEnd('email_send');
      throw handleError(error, { operation: 'sendEmail', to, subject });
    }
  }

  /**
   * Reply to thread
   */
  replyToThread(threadId, body, options = {}) {
    profile('email_reply');
    
    try {
      this.rateLimiter.checkLimit('send');
      
      const thread = GmailApp.getThreadById(threadId);
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }
      
      // Build reply options
      const replyOptions = {
        htmlBody: options.htmlBody || this.convertToHtml(body),
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments
      };
      
      // Add signature
      if (this.config.replySignature && !options.noSignature) {
        replyOptions.htmlBody += `<br><br>${this.config.replySignature.replace(/\n/g, '<br>')}`;
      }
      
      // Send reply
      thread.reply(body, replyOptions);
      
      profileEnd('email_reply');
      
      logInfo('Reply sent', {
        threadId: threadId,
        subject: thread.getFirstMessageSubject()
      });
      
      return {
        success: true,
        threadId: threadId,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      profileEnd('email_reply');
      throw handleError(error, { operation: 'replyToThread', threadId });
    }
  }

  /**
   * Add label to thread
   */
  addLabel(threadId, labelName) {
    try {
      const thread = GmailApp.getThreadById(threadId);
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }
      
      let label = GmailApp.getUserLabelByName(labelName);
      if (!label) {
        label = GmailApp.createLabel(labelName);
        logInfo(`Created new label: ${labelName}`);
      }
      
      thread.addLabel(label);
      
      return {
        success: true,
        threadId: threadId,
        label: labelName
      };
      
    } catch (error) {
      throw handleError(error, { operation: 'addLabel', threadId, labelName });
    }
  }

  /**
   * Remove label from thread
   */
  removeLabel(threadId, labelName) {
    try {
      const thread = GmailApp.getThreadById(threadId);
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }
      
      const label = GmailApp.getUserLabelByName(labelName);
      if (label) {
        thread.removeLabel(label);
      }
      
      return {
        success: true,
        threadId: threadId,
        label: labelName
      };
      
    } catch (error) {
      throw handleError(error, { operation: 'removeLabel', threadId, labelName });
    }
  }

  /**
   * Mark thread as read
   */
  markAsRead(threadId) {
    try {
      const thread = GmailApp.getThreadById(threadId);
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }
      
      thread.markRead();
      
      return {
        success: true,
        threadId: threadId
      };
      
    } catch (error) {
      throw handleError(error, { operation: 'markAsRead', threadId });
    }
  }

  /**
   * Mark thread as unread
   */
  markAsUnread(threadId) {
    try {
      const thread = GmailApp.getThreadById(threadId);
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }
      
      thread.markUnread();
      
      return {
        success: true,
        threadId: threadId
      };
      
    } catch (error) {
      throw handleError(error, { operation: 'markAsUnread', threadId });
    }
  }

  /**
   * Star thread
   */
  starThread(threadId) {
    try {
      const message = GmailApp.getMessageById(threadId);
      if (!message) {
        throw new Error(`Message ${threadId} not found`);
      }
      
      message.star();
      
      return {
        success: true,
        messageId: threadId
      };
      
    } catch (error) {
      throw handleError(error, { operation: 'starThread', threadId });
    }
  }

  /**
   * Unstar thread
   */
  unstarThread(threadId) {
    try {
      const message = GmailApp.getMessageById(threadId);
      if (!message) {
        throw new Error(`Message ${threadId} not found`);
      }
      
      message.unstar();
      
      return {
        success: true,
        messageId: threadId
      };
      
    } catch (error) {
      throw handleError(error, { operation: 'unstarThread', threadId });
    }
  }

  /**
   * Archive thread
   */
  archiveThread(threadId) {
    try {
      const thread = GmailApp.getThreadById(threadId);
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }
      
      thread.moveToArchive();
      
      return {
        success: true,
        threadId: threadId
      };
      
    } catch (error) {
      throw handleError(error, { operation: 'archiveThread', threadId });
    }
  }

  /**
   * Move thread to trash
   */
  trashThread(threadId) {
    try {
      const thread = GmailApp.getThreadById(threadId);
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }
      
      thread.moveToTrash();
      
      return {
        success: true,
        threadId: threadId
      };
      
    } catch (error) {
      throw handleError(error, { operation: 'trashThread', threadId });
    }
  }

  /**
   * Get all labels
   */
  getAllLabels() {
    try {
      const labels = GmailApp.getUserLabels();
      return labels.map(label => ({
        name: label.getName(),
        threadCount: label.getThreads(0, 1).length > 0 ? '1+' : '0'
      }));
    } catch (error) {
      throw handleError(error, { operation: 'getAllLabels' });
    }
  }

  /**
   * Create draft
   */
  createDraft(to, subject, body, options = {}) {
    try {
      const draft = GmailApp.createDraft(to, subject, body, {
        htmlBody: options.htmlBody || this.convertToHtml(body),
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments
      });
      
      return {
        success: true,
        draftId: draft.getId(),
        messageId: draft.getMessage().getId()
      };
      
    } catch (error) {
      throw handleError(error, { operation: 'createDraft', to, subject });
    }
  }

  /**
   * Convert plain text to HTML
   */
  convertToHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  }

  /**
   * Extract email addresses from string
   */
  extractEmailAddresses(text) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return text.match(emailRegex) || [];
  }

  /**
   * Validate email address
   */
  isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Get email statistics
   */
  getEmailStats(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const query = `after:${startDate.toISOString().split('T')[0]}`;
    const threads = GmailApp.search(query, 0, 500);
    
    const stats = {
      totalThreads: threads.length,
      totalMessages: 0,
      byLabel: {},
      byDay: {},
      topSenders: {}
    };
    
    threads.forEach(thread => {
      const messages = thread.getMessages();
      stats.totalMessages += messages.length;
      
      // By label
      thread.getLabels().forEach(label => {
        const name = label.getName();
        stats.byLabel[name] = (stats.byLabel[name] || 0) + 1;
      });
      
      // By day
      const date = thread.getLastMessageDate().toISOString().split('T')[0];
      stats.byDay[date] = (stats.byDay[date] || 0) + 1;
      
      // Top senders
      messages.forEach(message => {
        const from = this.extractEmailAddresses(message.getFrom())[0];
        if (from) {
          stats.topSenders[from] = (stats.topSenders[from] || 0) + 1;
        }
      });
    });
    
    // Sort top senders
    stats.topSenders = Object.entries(stats.topSenders)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((obj, [email, count]) => {
        obj[email] = count;
        return obj;
      }, {});
    
    return stats;
  }
}

// Create singleton instance
const Email = new EmailService();

// Convenience functions
function searchEmails(query, options) {
  return Email.searchEmails(query, options);
}

function getEmail(messageId) {
  return Email.getEmailById(messageId);
}

function getThread(threadId) {
  return Email.getThreadById(threadId);
}

function sendEmail(to, subject, body, options) {
  return Email.sendEmail(to, subject, body, options);
}

function replyToThread(threadId, body, options) {
  return Email.replyToThread(threadId, body, options);
}

function addEmailLabel(threadId, labelName) {
  return Email.addLabel(threadId, labelName);
}

function removeEmailLabel(threadId, labelName) {
  return Email.removeLabel(threadId, labelName);
}

function getAllEmailLabels() {
  return Email.getAllLabels();
}

function getEmailStats(days) {
  return Email.getEmailStats(days);
}