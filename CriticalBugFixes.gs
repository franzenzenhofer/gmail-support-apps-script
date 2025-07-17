/**
 * 🚨 CRITICAL BUG FIXES
 * 
 * This file contains all critical bug fixes that should be applied immediately
 * Copy these fixes into the respective service files
 */

/**
 * 1. API Key Validation - Add to ConfigService.gs
 */
class ConfigServiceFixes {
  static validateApiKey() {
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty('GEMINI_API_KEY') || 
                  props.getProperty('config.ai.apiKey') ||
                  this.get('gemini.apiKey');
    
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE' || apiKey.length < 20) {
      throw new Error(
        '⚠️ Gemini API key not configured!\n\n' +
        'Please run the installer (installGmailSupport) or set GEMINI_API_KEY in Script Properties.\n' +
        'Get your key at: https://makersuite.google.com/app/apikey'
      );
    }
    
    return apiKey;
  }
}

/**
 * 2. Storage Size Validation - Add as utility
 */
class StorageValidator {
  static MAX_PROPERTY_SIZE = 450 * 1024; // 450KB (leaving buffer)
  static MAX_CACHE_SIZE = 100 * 1024;    // 100KB for cache
  
  static validatePropertySize(key, data) {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    const sizeBytes = new Blob([serialized]).size;
    
    if (sizeBytes > this.MAX_PROPERTY_SIZE) {
      throw new Error(
        `Storage limit exceeded for ${key}: ${(sizeBytes/1024).toFixed(1)}KB ` +
        `(max ${(this.MAX_PROPERTY_SIZE/1024).toFixed(0)}KB)`
      );
    }
    
    return serialized;
  }
  
  static validateCacheSize(key, data) {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    const sizeBytes = new Blob([serialized]).size;
    
    if (sizeBytes > this.MAX_CACHE_SIZE) {
      console.warn(`Cache data too large for ${key}: ${(sizeBytes/1024).toFixed(1)}KB`);
      return null; // Don't cache oversized data
    }
    
    return serialized;
  }
  
  static getStorageUsage() {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    
    let totalSize = 0;
    const usage = {};
    
    Object.entries(allProps).forEach(([key, value]) => {
      const size = new Blob([value]).size;
      totalSize += size;
      usage[key] = size;
    });
    
    return {
      totalBytes: totalSize,
      totalMB: (totalSize / 1024 / 1024).toFixed(2),
      perKey: usage,
      limit: '9MB',
      percentUsed: ((totalSize / (9 * 1024 * 1024)) * 100).toFixed(1)
    };
  }
}

/**
 * 3. Error Recovery in Main Loop - Replace processNewSupportEmails in Code.gs
 */
function processNewSupportEmailsWithRecovery() {
  console.log('🔄 Processing new support emails...');
  
  const startTime = new Date();
  const errors = [];
  let processed = 0;
  let skipped = 0;
  
  try {
    // Validate API key first
    ConfigServiceFixes.validateApiKey();
    
    // Get unprocessed emails
    const threads = EmailService.searchEmails({
      query: 'is:unread label:Support -label:AI-Processing -label:AI-Processed',
      limit: Config.get('email.maxBatchSize', 10)
    });
    
    if (threads.length === 0) {
      console.log('No new support emails to process');
      return;
    }
    
    console.log(`Found ${threads.length} new support emails`);
    
    // Process each thread with error recovery
    threads.forEach((thread, index) => {
      try {
        // Check execution time limit
        if (ExecutionTimer.shouldStop()) {
          console.log(`⏰ Approaching time limit. Processed ${processed} of ${threads.length}`);
          skipped = threads.length - index;
          return;
        }
        
        console.log(`Processing ${index + 1}/${threads.length}: ${thread.getFirstMessageSubject()}`);
        processSupportThread(thread);
        processed++;
        
      } catch (error) {
        console.error(`❌ Failed to process thread ${thread.getId()}:`, error);
        
        // Mark thread with error label
        try {
          thread.addLabel(GmailApp.getUserLabelByName('AI-Failed'));
          thread.addLabel(GmailApp.getUserLabelByName('Needs-Review'));
        } catch (labelError) {
          console.error('Failed to add error label:', labelError);
        }
        
        errors.push({
          threadId: thread.getId(),
          subject: thread.getFirstMessageSubject(),
          error: error.toString(),
          stack: error.stack
        });
      }
    });
    
  } catch (criticalError) {
    console.error('❌ Critical error in email processing:', criticalError);
    ErrorService.logError(criticalError, { 
      context: 'processNewSupportEmails',
      severity: 'critical' 
    });
    throw criticalError;
  } finally {
    // Always log summary
    const duration = (new Date() - startTime) / 1000;
    const summary = {
      processed: processed,
      errors: errors.length,
      skipped: skipped,
      duration: `${duration.toFixed(1)}s`,
      timestamp: new Date().toISOString()
    };
    
    console.log('📊 Processing Summary:', JSON.stringify(summary, null, 2));
    
    // Report errors if any
    if (errors.length > 0) {
      ErrorService.reportBatchErrors(errors);
      
      // Send admin notification if too many errors
      if (errors.length > threads.length * 0.5) {
        NotificationService.sendAdminAlert(
          'High Error Rate in Email Processing',
          `${errors.length} out of ${threads.length} emails failed to process.`
        );
      }
    }
  }
}

/**
 * 4. Atomic Ticket Counter - Replace in TicketService.gs
 */
class AtomicTicketCounter {
  static generateTicketId() {
    const lock = LockService.getScriptLock();
    
    try {
      // Wait up to 10 seconds for lock
      lock.waitLock(10000);
      
      const props = PropertiesService.getScriptProperties();
      const counter = parseInt(props.getProperty('ticket_counter') || '1000');
      const nextCounter = counter + 1;
      
      // Validate counter hasn't been corrupted
      if (isNaN(nextCounter) || nextCounter < 1000) {
        throw new Error('Ticket counter corrupted');
      }
      
      // Atomic update
      props.setProperty('ticket_counter', nextCounter.toString());
      
      // Generate ticket ID
      const date = new Date();
      const dateStr = Utilities.formatDate(date, 'GMT', 'yyyyMMdd');
      const paddedCounter = nextCounter.toString().padStart(4, '0');
      
      return `TICKET-${dateStr}-${paddedCounter}`;
      
    } catch (error) {
      if (error.toString().includes('Could not obtain lock')) {
        // Fallback to timestamp-based ID
        const timestamp = new Date().getTime();
        return `TICKET-TEMP-${timestamp}`;
      }
      throw error;
    } finally {
      try {
        lock.releaseLock();
      } catch (e) {
        // Lock might have already been released
      }
    }
  }
}

/**
 * 5. Gmail Operation Safety - Add to EmailService.gs
 */
class SafeGmailOperations {
  static getThreadSafely(threadId) {
    if (!threadId) {
      throw new Error('Thread ID is required');
    }
    
    try {
      const thread = GmailApp.getThreadById(threadId);
      
      // Check if thread exists
      if (!thread || !thread.getId) {
        throw new Error(`Thread not found: ${threadId}`);
      }
      
      // Verify we can access it
      thread.getMessageCount();
      
      return thread;
    } catch (error) {
      if (error.toString().includes('Invalid thread id')) {
        throw new Error(`Invalid thread ID format: ${threadId}`);
      }
      if (error.toString().includes('Limit Exceeded')) {
        throw new Error('Gmail API quota exceeded. Please try again later.');
      }
      throw error;
    }
  }
  
  static getMessageSafely(messageId) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }
    
    try {
      const message = GmailApp.getMessageById(messageId);
      
      if (!message || !message.getId) {
        throw new Error(`Message not found: ${messageId}`);
      }
      
      return message;
    } catch (error) {
      if (error.toString().includes('Invalid message id')) {
        throw new Error(`Invalid message ID format: ${messageId}`);
      }
      throw error;
    }
  }
  
  static getLabelSafely(labelName) {
    if (!labelName) {
      throw new Error('Label name is required');
    }
    
    try {
      let label = GmailApp.getUserLabelByName(labelName);
      
      if (!label) {
        // Try to create the label
        console.log(`Creating missing label: ${labelName}`);
        label = GmailApp.createLabel(labelName);
      }
      
      return label;
    } catch (error) {
      if (error.toString().includes('Invalid label name')) {
        throw new Error(`Invalid label name: ${labelName}`);
      }
      throw error;
    }
  }
}

/**
 * 6. Execution Time Management - Add as utility
 */
class ExecutionTimer {
  static startTime = null;
  static maxRuntime = 5 * 60 * 1000; // 5 minutes (leave 1 min buffer)
  
  static start() {
    this.startTime = new Date();
  }
  
  static shouldStop() {
    if (!this.startTime) {
      this.start();
    }
    return (new Date() - this.startTime) > this.maxRuntime;
  }
  
  static getRemainingTime() {
    if (!this.startTime) {
      return this.maxRuntime;
    }
    return Math.max(0, this.maxRuntime - (new Date() - this.startTime));
  }
  
  static getRemainingSeconds() {
    return Math.floor(this.getRemainingTime() / 1000);
  }
  
  static getElapsedTime() {
    if (!this.startTime) {
      return 0;
    }
    return new Date() - this.startTime;
  }
  
  static getElapsedSeconds() {
    return Math.floor(this.getElapsedTime() / 1000);
  }
}

/**
 * 7. Concurrent Execution Prevention - Add to main processing function
 */
function preventConcurrentExecution(functionName) {
  const lock = LockService.getScriptLock();
  
  try {
    // Try to get lock immediately
    const hasLock = lock.tryLock(1000);
    
    if (!hasLock) {
      console.log(`🔒 ${functionName} is already running. Skipping this execution.`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to acquire lock:', error);
    return false;
  }
}

/**
 * 8. Email Body Truncation - Add to utilities
 */
class EmailTruncator {
  static truncateBody(body, maxLength = 10000) {
    if (!body) return '';
    
    if (body.length <= maxLength) return body;
    
    // Try to break at paragraph
    const truncated = body.substring(0, maxLength);
    const lastNewline = truncated.lastIndexOf('\n\n');
    
    if (lastNewline > maxLength * 0.7) {
      return truncated.substring(0, lastNewline) + '\n\n[Content truncated for processing...]';
    }
    
    // Try to break at sentence
    const lastPeriod = truncated.lastIndexOf('. ');
    if (lastPeriod > maxLength * 0.7) {
      return truncated.substring(0, lastPeriod + 1) + '\n\n[Content truncated for processing...]';
    }
    
    // Fallback to word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...\n\n[Content truncated for processing...]';
    }
    
    return truncated + '...\n\n[Content truncated for processing...]';
  }
  
  static summarizeLongEmail(body, maxLength = 5000) {
    if (body.length <= maxLength) return body;
    
    // Keep first part
    const firstPart = body.substring(0, maxLength / 2);
    
    // Keep last part
    const lastPart = body.substring(body.length - maxLength / 4);
    
    return firstPart + 
           '\n\n[... middle content omitted for brevity ...]\n\n' + 
           lastPart;
  }
}

/**
 * 9. Spreadsheet Access Validation - Add to KnowledgeBaseService
 */
class SpreadsheetValidator {
  static validateAccess(spreadsheetId) {
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required');
    }
    
    try {
      const ss = SpreadsheetApp.openById(spreadsheetId);
      
      // Try to read to ensure we have permission
      const name = ss.getName();
      const sheets = ss.getSheets();
      
      if (sheets.length === 0) {
        throw new Error('Spreadsheet has no sheets');
      }
      
      return {
        id: spreadsheetId,
        name: name,
        sheets: sheets.length,
        url: ss.getUrl()
      };
      
    } catch (error) {
      if (error.toString().includes('is missing (perhaps it was deleted')) {
        throw new Error(`Spreadsheet not found: ${spreadsheetId}. It may have been deleted.`);
      }
      if (error.toString().includes('does not have permission')) {
        throw new Error(
          `No permission to access spreadsheet: ${spreadsheetId}.\n` +
          `Please share it with: ${Session.getActiveUser().getEmail()}`
        );
      }
      throw error;
    }
  }
}

/**
 * 10. Initialize all fixes when script loads
 */
function initializeCriticalFixes() {
  // Set up execution timer at start
  ExecutionTimer.start();
  
  // Validate critical configuration
  try {
    ConfigServiceFixes.validateApiKey();
  } catch (error) {
    console.error('⚠️ API Key validation failed:', error);
    // Don't throw - let installer handle it
  }
  
  // Check storage usage
  const usage = StorageValidator.getStorageUsage();
  if (parseFloat(usage.percentUsed) > 80) {
    console.warn(`⚠️ Storage usage high: ${usage.percentUsed}% of ${usage.limit}`);
  }
  
  console.log('✅ Critical fixes initialized');
}

// Run initialization
initializeCriticalFixes();