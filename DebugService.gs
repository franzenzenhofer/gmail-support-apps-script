/**
 * DebugService.gs - Comprehensive Debugging Tools
 * 
 * DRY & KISS principles applied to debugging
 * Provides robust debugging, profiling, and troubleshooting capabilities
 */

class DebugService {
  constructor() {
    this.enabled = this.isDebugEnabled();
    this.logLevel = this.getLogLevel();
    this.performanceMarks = new Map();
    this.executionStack = [];
    this.errorHistory = [];
    this.maxErrorHistory = 100;
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled() {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('DEBUG_MODE') === 'true';
  }

  /**
   * Get current log level
   */
  getLogLevel() {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('LOG_LEVEL') || 'INFO';
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('DEBUG_MODE', enabled.toString());
    this.enabled = enabled;
  }

  /**
   * Enhanced logging with context
   */
  log(level, message, context = {}) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    if (messageLevelIndex < currentLevelIndex) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      context: context,
      stack: this.executionStack.slice(),
      user: Session.getActiveUser().getEmail(),
      executionId: this.getExecutionId()
    };
    
    // Console logging with formatting
    const formattedMessage = this.formatLogMessage(logEntry);
    
    switch (level) {
      case 'ERROR':
      case 'FATAL':
        console.error(formattedMessage);
        this.addToErrorHistory(logEntry);
        break;
      case 'WARN':
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
    
    // Send to Cloud Logging if enabled
    if (this.shouldSendToCloudLogging(level)) {
      this.sendToCloudLogging(logEntry);
    }
    
    return logEntry;
  }

  /**
   * Format log message for console
   */
  formatLogMessage(logEntry) {
    const { timestamp, level, message, context, stack } = logEntry;
    let formatted = `[${timestamp}] [${level}] ${message}`;
    
    if (Object.keys(context).length > 0) {
      formatted += `\nContext: ${JSON.stringify(context, null, 2)}`;
    }
    
    if (stack.length > 0 && (level === 'ERROR' || level === 'FATAL')) {
      formatted += `\nStack: ${stack.join(' > ')}`;
    }
    
    return formatted;
  }

  /**
   * Debug wrapper for functions
   */
  wrap(functionName, fn) {
    const self = this;
    
    return function(...args) {
      const startTime = Date.now();
      self.executionStack.push(functionName);
      
      try {
        self.log('DEBUG', `Entering ${functionName}`, { args: self.sanitizeArgs(args) });
        
        const result = fn.apply(this, args);
        
        // Handle promises
        if (result && typeof result.then === 'function') {
          return result
            .then(value => {
              self.logExit(functionName, startTime, { success: true });
              return value;
            })
            .catch(error => {
              self.logExit(functionName, startTime, { success: false, error: error.message });
              throw error;
            });
        }
        
        self.logExit(functionName, startTime, { success: true });
        return result;
        
      } catch (error) {
        self.logExit(functionName, startTime, { success: false, error: error.message });
        self.log('ERROR', `Error in ${functionName}: ${error.message}`, {
          stack: error.stack,
          args: self.sanitizeArgs(args)
        });
        throw error;
      }
    };
  }

  /**
   * Log function exit
   */
  logExit(functionName, startTime, result) {
    const duration = Date.now() - startTime;
    this.executionStack.pop();
    
    this.log('DEBUG', `Exiting ${functionName}`, {
      duration: `${duration}ms`,
      ...result
    });
    
    // Log performance warning if slow
    if (duration > 1000) {
      this.log('WARN', `Slow function: ${functionName} took ${duration}ms`);
    }
  }

  /**
   * Sanitize arguments for logging
   */
  sanitizeArgs(args) {
    return args.map(arg => {
      if (typeof arg === 'string' && arg.length > 100) {
        return arg.substring(0, 100) + '...';
      }
      if (typeof arg === 'object' && arg !== null) {
        // Remove sensitive data
        const sanitized = { ...arg };
        ['password', 'token', 'apiKey', 'secret'].forEach(key => {
          if (sanitized[key]) {
            sanitized[key] = '***REDACTED***';
          }
        });
        return sanitized;
      }
      return arg;
    });
  }

  /**
   * Performance profiling
   */
  startProfile(label) {
    this.performanceMarks.set(label, {
      start: Date.now(),
      memory: this.getMemoryUsage()
    });
    console.time(label);
  }

  /**
   * End performance profile
   */
  endProfile(label) {
    console.timeEnd(label);
    
    const mark = this.performanceMarks.get(label);
    if (!mark) {
      this.log('WARN', `No profile found for label: ${label}`);
      return;
    }
    
    const duration = Date.now() - mark.start;
    const endMemory = this.getMemoryUsage();
    
    const profile = {
      label: label,
      duration: duration,
      memoryDelta: endMemory - mark.memory,
      timestamp: new Date().toISOString()
    };
    
    this.log('INFO', `Profile: ${label}`, profile);
    this.performanceMarks.delete(label);
    
    return profile;
  }

  /**
   * Get memory usage (simulated for Apps Script)
   */
  getMemoryUsage() {
    // Apps Script doesn't provide real memory metrics
    // This is a placeholder for tracking object counts
    return {
      properties: PropertiesService.getScriptProperties().getKeys().length,
      cache: CacheService.getScriptCache().get('cache_size') || 0,
      timestamp: Date.now()
    };
  }

  /**
   * Trace function execution
   */
  trace(message, data = {}) {
    if (this.enabled) {
      this.log('DEBUG', `TRACE: ${message}`, data);
    }
  }

  /**
   * Assert condition
   */
  assert(condition, message) {
    if (!condition) {
      const error = new Error(`Assertion failed: ${message}`);
      this.log('ERROR', error.message, { stack: error.stack });
      throw error;
    }
  }

  /**
   * Dump variable for inspection
   */
  dump(variable, label = 'Variable Dump') {
    this.log('DEBUG', label, {
      type: typeof variable,
      value: variable,
      stringified: JSON.stringify(variable, null, 2)
    });
  }

  /**
   * Create execution checkpoint
   */
  checkpoint(label) {
    const checkpoint = {
      label: label,
      timestamp: Date.now(),
      stack: this.executionStack.slice(),
      memory: this.getMemoryUsage()
    };
    
    this.log('DEBUG', `Checkpoint: ${label}`, checkpoint);
    return checkpoint;
  }

  /**
   * Get execution ID
   */
  getExecutionId() {
    // Create a unique execution ID for this run
    if (!this._executionId) {
      this._executionId = Utilities.getUuid();
    }
    return this._executionId;
  }

  /**
   * Error history management
   */
  addToErrorHistory(error) {
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift();
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(limit = 10) {
    return this.errorHistory.slice(-limit);
  }

  /**
   * Clear error history
   */
  clearErrorHistory() {
    this.errorHistory = [];
  }

  /**
   * Test email sending (dry run)
   */
  testEmailSend(to, subject, body) {
    this.log('INFO', 'Test email send (dry run)', {
      to: to,
      subject: subject,
      bodyLength: body.length,
      bodyPreview: body.substring(0, 100) + '...'
    });
    
    if (!this.enabled) {
      throw new Error('Debug mode must be enabled for test sends');
    }
    
    return {
      success: true,
      message: 'Test email logged (not sent)',
      details: { to, subject, bodyLength: body.length }
    };
  }

  /**
   * Should send to Cloud Logging
   */
  shouldSendToCloudLogging(level) {
    // Only send errors and above to Cloud Logging
    return ['ERROR', 'FATAL'].includes(level) && !this.enabled;
  }

  /**
   * Send to Cloud Logging
   */
  sendToCloudLogging(logEntry) {
    // Cloud Logging integration
    try {
      // In production, errors are automatically sent to Cloud Logging
      // This is a placeholder for custom logging
      if (logEntry.level === 'FATAL') {
        // Could integrate with external logging service
        const webhook = Config.get('notifications.errorWebhook');
        if (webhook) {
          UrlFetchApp.fetch(webhook, {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(logEntry)
          });
        }
      }
    } catch (error) {
      console.error('Failed to send to Cloud Logging:', error);
    }
  }

  /**
   * Create debug report
   */
  generateDebugReport() {
    return {
      executionId: this.getExecutionId(),
      timestamp: new Date().toISOString(),
      user: Session.getActiveUser().getEmail(),
      debugMode: this.enabled,
      logLevel: this.logLevel,
      executionStack: this.executionStack,
      recentErrors: this.getErrorHistory(),
      performance: Array.from(this.performanceMarks.entries()),
      environment: {
        timezone: Session.getScriptTimeZone(),
        locale: Session.getActiveUserLocale()
      }
    };
  }

  /**
   * Email debug report
   */
  emailDebugReport(recipient) {
    const report = this.generateDebugReport();
    const subject = `Debug Report - ${new Date().toLocaleDateString()}`;
    const body = `Debug Report\n\n${JSON.stringify(report, null, 2)}`;
    
    if (this.enabled) {
      this.testEmailSend(recipient, subject, body);
    } else {
      GmailApp.sendEmail(recipient, subject, body);
    }
  }
}

// Create singleton instance
const Debug = new DebugService();

// Convenience functions
function debug(message, context) {
  return Debug.log('DEBUG', message, context);
}

function info(message, context) {
  return Debug.log('INFO', message, context);
}

function warn(message, context) {
  return Debug.log('WARN', message, context);
}

function error(message, context) {
  return Debug.log('ERROR', message, context);
}

function fatal(message, context) {
  return Debug.log('FATAL', message, context);
}

function trace(message, data) {
  return Debug.trace(message, data);
}

function assert(condition, message) {
  return Debug.assert(condition, message);
}

function profile(label) {
  return Debug.startProfile(label);
}

function profileEnd(label) {
  return Debug.endProfile(label);
}

function checkpoint(label) {
  return Debug.checkpoint(label);
}

function dump(variable, label) {
  return Debug.dump(variable, label);
}

// Debug wrapper for automatic function instrumentation
function debugWrap(functionName, fn) {
  return Debug.wrap(functionName, fn);
}

// Enable/disable debug mode
function setDebugMode(enabled) {
  Debug.setDebugMode(enabled);
}

// Get debug report
function getDebugReport() {
  return Debug.generateDebugReport();
}