/**
 * ProductionFixes.gs - Critical Production Bug Fixes
 * 
 * This file implements all critical bug fixes identified
 * in the deep bug analysis to ensure production stability
 */

/**
 * Fix for EmailService rate limiting
 */
function patchEmailService() {
  // Add thread-safe rate limiting to EmailService
  if (typeof EmailService !== 'undefined' && EmailService.prototype) {
    const originalSendEmail = EmailService.prototype.sendEmail;
    
    EmailService.prototype.sendEmail = function(options) {
      // Check rate limit before sending
      try {
        SafetyService.checkRateLimit('email_send', 20, 500);
      } catch (error) {
        if (error.message.includes('Rate limit exceeded')) {
          throw new Error('Email rate limit exceeded. Please try again later.');
        }
        throw error;
      }
      
      // Call original method
      return originalSendEmail.call(this, options);
    };
  }
}

/**
 * Fix for AIService cache key overflow
 */
function patchAIService() {
  if (typeof AIService !== 'undefined' && AIService.prototype) {
    const originalGenerateContent = AIService.prototype.generateContent;
    
    AIService.prototype.generateContent = function(prompt, options = {}) {
      // Validate API key first
      const props = PropertiesService.getScriptProperties();
      const apiKey = props.getProperty('GEMINI_API_KEY');
      
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        throw new Error('⚠️ Gemini API key not configured! Please set up your API key.');
      }
      
      // Fix cache key generation
      const cacheKey = SafetyService.safeCache.generateKey(
        'gemini',
        { prompt: prompt.substring(0, 500), options }
      );
      
      // Check cache with safe parsing
      const cached = SafetyService.safeCache.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Call original method
      const result = originalGenerateContent.call(this, prompt, options);
      
      // Cache result safely
      SafetyService.safeCache.put(cacheKey, result, 3600);
      
      return result;
    };
  }
}

/**
 * Fix for ConfigService cache corruption
 */
function patchConfigService() {
  if (typeof ConfigService !== 'undefined' && ConfigService.prototype) {
    const originalLoadConfig = ConfigService.prototype.loadConfig;
    
    ConfigService.prototype.loadConfig = function() {
      const cached = this.cache.get(this.configKey);
      if (cached) {
        // Safe parse with fallback
        const parsed = SafetyService.safeParse(cached, null);
        if (parsed) {
          this.config = parsed;
          return;
        }
        // Clear corrupted cache
        this.cache.remove(this.configKey);
      }
      
      // Call original method
      return originalLoadConfig.call(this);
    };
  }
}

/**
 * Fix for AutoReplyService frequency counting
 */
function patchAutoReplyService() {
  if (typeof AutoReplyService !== 'undefined' && AutoReplyService.prototype) {
    // Add atomic frequency counter
    AutoReplyService.prototype.updateFrequencyCount = function(email) {
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(1000);
        
        const key = `freq_${this.hashEmail(email)}`;
        const count = parseInt(this.cache.get(key) || '0');
        
        if (count >= this.config.maxSimilarEmails) {
          return false; // Limit exceeded
        }
        
        this.cache.put(key, (count + 1).toString(), 3600);
        return true;
      } finally {
        lock.releaseLock();
      }
    };
  }
}

/**
 * Fix missing null checks in email operations
 */
function addEmailNullChecks() {
  // Wrap Gmail operations with null checks
  const originalGetMessageById = GmailApp.getMessageById;
  GmailApp.getMessageById = function(id) {
    if (!id) {
      throw new Error('Message ID is required');
    }
    
    try {
      return originalGetMessageById.call(this, id);
    } catch (error) {
      console.error(`Failed to get message ${id}:`, error);
      return null;
    }
  };
  
  const originalGetThreadById = GmailApp.getThreadById;
  GmailApp.getThreadById = function(id) {
    if (!id) {
      throw new Error('Thread ID is required');
    }
    
    try {
      return originalGetThreadById.call(this, id);
    } catch (error) {
      console.error(`Failed to get thread ${id}:`, error);
      return null;
    }
  };
}

/**
 * Global error boundary
 */
function installGlobalErrorBoundary() {
  // Wrap all triggers with error handling
  const triggers = [
    'processEmails',
    'checkEscalations', 
    'sendNotifications',
    'updateMetrics'
  ];
  
  triggers.forEach(triggerName => {
    if (typeof global[triggerName] === 'function') {
      const original = global[triggerName];
      
      global[triggerName] = function() {
        try {
          // Check execution time before starting
          if (!Safety.canContinue(60000)) {
            console.warn(`Skipping ${triggerName} - insufficient execution time`);
            return;
          }
          
          return original.apply(this, arguments);
        } catch (error) {
          console.error(`Error in ${triggerName}:`, error);
          
          // Log to error tracking
          if (typeof ErrorHandler !== 'undefined') {
            ErrorHandler.handle(error, { trigger: triggerName });
          }
          
          // Re-throw critical errors
          if (error.message.includes('Script approaching') || 
              error.message.includes('Rate limit exceeded')) {
            throw error;
          }
        }
      };
    }
  });
}

/**
 * Initialize all production fixes
 */
function initializeProductionFixes() {
  console.log('🔧 Applying production fixes...');
  
  try {
    // Apply all patches
    patchEmailService();
    patchAIService();
    patchConfigService();
    patchAutoReplyService();
    addEmailNullChecks();
    installGlobalErrorBoundary();
    
    // Validate critical services
    validateCriticalServices();
    
    console.log('✅ Production fixes applied successfully');
  } catch (error) {
    console.error('❌ Failed to apply production fixes:', error);
    throw error;
  }
}

/**
 * Validate critical services are working
 */
function validateCriticalServices() {
  const validations = [
    {
      name: 'Properties Service',
      test: () => {
        const props = PropertiesService.getScriptProperties();
        props.setProperty('test_key', 'test_value');
        const value = props.getProperty('test_key');
        props.deleteProperty('test_key');
        return value === 'test_value';
      }
    },
    {
      name: 'Cache Service',
      test: () => {
        const cache = CacheService.getScriptCache();
        cache.put('test_key', 'test_value', 60);
        const value = cache.get('test_key');
        cache.remove('test_key');
        return value === 'test_value';
      }
    },
    {
      name: 'Lock Service',
      test: () => {
        const lock = LockService.getScriptLock();
        const hasLock = lock.tryLock(1000);
        if (hasLock) {
          lock.releaseLock();
        }
        return hasLock;
      }
    },
    {
      name: 'Gmail Service',
      test: () => {
        try {
          GmailApp.getInboxUnreadCount();
          return true;
        } catch (e) {
          console.error('Gmail service not authorized');
          return false;
        }
      }
    }
  ];
  
  const results = validations.map(validation => {
    try {
      const passed = validation.test();
      console.log(`${passed ? '✅' : '❌'} ${validation.name}`);
      return { name: validation.name, passed };
    } catch (error) {
      console.error(`❌ ${validation.name} failed:`, error.message);
      return { name: validation.name, passed: false, error: error.message };
    }
  });
  
  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    console.warn('⚠️ Some services failed validation:', failed);
  }
  
  return results;
}

/**
 * Performance optimization utilities
 */
const PerformanceUtils = {
  /**
   * Batch process with execution time awareness
   */
  batchProcess(items, processor, batchSize = 10) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      // Check execution time
      if (!Safety.canContinue(30000)) {
        console.warn(`Batch processing stopped at item ${i} due to time limit`);
        break;
      }
      
      const batch = items.slice(i, i + batchSize);
      
      batch.forEach((item, index) => {
        try {
          results.push(processor(item, i + index));
        } catch (error) {
          errors.push({ item, index: i + index, error });
        }
      });
      
      // Small delay to prevent rate limiting
      if (i + batchSize < items.length) {
        Utilities.sleep(100);
      }
    }
    
    return { results, errors };
  },
  
  /**
   * Retry with exponential backoff
   */
  retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return fn();
      } catch (error) {
        lastError = error;
        
        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i);
          console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
          Utilities.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
};

/**
 * Data integrity utilities
 */
const DataIntegrity = {
  /**
   * Validate and repair ticket data
   */
  validateTicket(ticket) {
    const required = ['id', 'status', 'customerEmail', 'createdAt'];
    const missing = required.filter(field => !ticket[field]);
    
    if (missing.length > 0) {
      throw new Error(`Invalid ticket: missing fields ${missing.join(', ')}`);
    }
    
    // Validate status
    const validStatuses = ['new', 'open', 'in_progress', 'waiting_customer', 
                          'escalated', 'resolved', 'closed', 'reopened'];
    if (!validStatuses.includes(ticket.status)) {
      ticket.status = 'new';
    }
    
    // Validate email
    if (!SafetyService.isValidEmail(ticket.customerEmail)) {
      throw new Error(`Invalid customer email: ${ticket.customerEmail}`);
    }
    
    // Ensure dates are ISO strings
    if (!(ticket.createdAt instanceof Date) && !ticket.createdAt.includes('T')) {
      ticket.createdAt = new Date(ticket.createdAt).toISOString();
    }
    
    return ticket;
  },
  
  /**
   * Clean up old data
   */
  cleanupOldData(daysToKeep = 90) {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    
    let cleaned = 0;
    
    Object.keys(allProps).forEach(key => {
      // Check if it's a dated key
      const dateMatch = key.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        const keyDate = new Date(dateMatch[0]);
        if (keyDate < cutoff) {
          props.deleteProperty(key);
          cleaned++;
        }
      }
    });
    
    console.log(`Cleaned up ${cleaned} old properties`);
    return cleaned;
  }
};

// Auto-initialize on load
(function() {
  try {
    initializeProductionFixes();
  } catch (error) {
    console.error('Failed to initialize production fixes:', error);
  }
})();