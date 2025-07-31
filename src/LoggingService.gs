/**
 * LoggingService.gs - Advanced Logging with Cloud Logging Integration
 * 
 * KISS principle: Simple interface, powerful features
 * DRY principle: Reusable logging patterns
 */

class LoggingService {
  constructor() {
    this.config = Config.get('logging') || this.getDefaultConfig();
    this.logBuffer = [];
    this.maxBufferSize = 100;
    this.flushInterval = 5000; // 5 seconds
    this.setupAutoFlush();
  }

  /**
   * Get default logging configuration
   */
  getDefaultConfig() {
    return {
      enabled: true,
      level: 'INFO',
      cloudLogging: true,
      console: true,
      persistence: true,
      format: 'json',
      maxLogSize: 1000,
      retention: 7, // days
      sanitize: true,
      performance: true
    };
  }

  /**
   * Setup auto-flush for buffered logs
   */
  setupAutoFlush() {
    // Note: Apps Script doesn't support setInterval
    // Logs will be flushed on next execution or manually
  }

  /**
   * Main logging method
   */
  log(level, message, data = {}, options = {}) {
    if (!this.shouldLog(level)) return;

    const logEntry = this.createLogEntry(level, message, data, options);
    
    // Console logging
    if (this.config.console) {
      this.logToConsole(logEntry);
    }
    
    // Buffer for batch processing
    this.logBuffer.push(logEntry);
    
    // Flush if buffer is full
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
    
    // Cloud logging for errors
    if (this.config.cloudLogging && ['ERROR', 'FATAL'].includes(level)) {
      this.sendToCloudLogging(logEntry);
    }
    
    return logEntry;
  }

  /**
   * Create structured log entry
   */
  createLogEntry(level, message, data, options) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      data: this.sanitizeData(data),
      metadata: {
        executionId: Utilities.getUuid(),
        user: Session.getActiveUser().getEmail(),
        scriptId: ScriptApp.getScriptId(),
        functionName: options.functionName || this.getCallerName(),
        environment: this.getEnvironment()
      }
    };
    
    // Add performance metrics if enabled
    if (this.config.performance && options.duration) {
      entry.performance = {
        duration: options.duration,
        memory: this.getMemoryUsage()
      };
    }
    
    // Add error details
    if (options.error) {
      entry.error = {
        message: options.error.message,
        stack: options.error.stack,
        code: options.error.code
      };
    }
    
    return entry;
  }

  /**
   * Sanitize sensitive data
   */
  sanitizeData(data) {
    if (!this.config.sanitize || !data) return data;
    
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'auth', 'credential'];
    const sanitized = JSON.parse(JSON.stringify(data)); // Deep clone
    
    const sanitizeObject = (obj) => {
      Object.keys(obj).forEach(key => {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      });
    };
    
    if (typeof sanitized === 'object' && sanitized !== null) {
      sanitizeObject(sanitized);
    }
    
    return sanitized;
  }

  /**
   * Log to console with formatting
   */
  logToConsole(entry) {
    const { timestamp, level, message, data, error } = entry;
    const prefix = `[${timestamp}] [${level}]`;
    
    switch (level) {
      case 'ERROR':
      case 'FATAL':
        console.error(prefix, message, data);
        if (error) console.error(error.stack);
        break;
      case 'WARN':
        console.warn(prefix, message, data);
        break;
      case 'INFO':
        console.info(prefix, message, data);
        break;
      default:
        console.log(prefix, message, data);
    }
  }

  /**
   * Send to Cloud Logging
   */
  sendToCloudLogging(entry) {
    try {
      // Apps Script automatically sends console.error to Cloud Logging
      // For custom integration, we can use webhooks
      if (this.config.cloudLoggingWebhook) {
        UrlFetchApp.fetch(this.config.cloudLoggingWebhook, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            severity: entry.level,
            jsonPayload: entry,
            resource: {
              type: 'apps_script',
              labels: {
                project_id: ScriptApp.getScriptId(),
                function_name: entry.metadata.functionName
              }
            }
          }),
          muteHttpExceptions: true
        });
      }
    } catch (error) {
      console.error('Failed to send to Cloud Logging:', error);
    }
  }

  /**
   * Flush buffered logs
   */
  flush() {
    if (this.logBuffer.length === 0) return;
    
    try {
      if (this.config.persistence) {
        this.persistLogs(this.logBuffer);
      }
      
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }

  /**
   * Persist logs to storage
   */
  persistLogs(logs) {
    const props = PropertiesService.getScriptProperties();
    const existingLogs = JSON.parse(props.getProperty('system_logs') || '[]');
    
    // Add new logs
    const allLogs = existingLogs.concat(logs);
    
    // Apply retention policy
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retention);
    
    const retainedLogs = allLogs.filter(log => 
      new Date(log.timestamp) > cutoffDate
    );
    
    // Limit size
    const trimmedLogs = retainedLogs.slice(-this.config.maxLogSize);
    
    props.setProperty('system_logs', JSON.stringify(trimmedLogs));
  }

  /**
   * Check if should log based on level
   */
  shouldLog(level) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    const configuredLevel = levels.indexOf(this.config.level);
    const messageLevel = levels.indexOf(level);
    
    return this.config.enabled && messageLevel >= configuredLevel;
  }

  /**
   * Get caller function name
   */
  getCallerName() {
    try {
      const stack = new Error().stack;
      const lines = stack.split('\n');
      // Skip this function and the log function
      const callerLine = lines[3] || lines[2];
      const match = callerLine.match(/at (\w+)/);
      return match ? match[1] : 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get environment info
   */
  getEnvironment() {
    return {
      runtime: 'apps-script',
      timezone: Session.getScriptTimeZone(),
      locale: Session.getActiveUserLocale(),
      deploymentId: this.getDeploymentId()
    };
  }

  /**
   * Get deployment ID
   */
  getDeploymentId() {
    try {
      const url = ScriptApp.getService().getUrl();
      if (url) {
        const match = url.match(/\/exec$/);
        return match ? 'production' : 'development';
      }
    } catch (error) {
      // Not a web app
    }
    return 'standalone';
  }

  /**
   * Get memory usage estimation
   */
  getMemoryUsage() {
    return {
      properties: PropertiesService.getScriptProperties().getKeys().length,
      cache: this.getCacheSize(),
      bufferSize: this.logBuffer.length
    };
  }

  /**
   * Get cache size estimation
   */
  getCacheSize() {
    try {
      const cache = CacheService.getScriptCache();
      // This is an estimation
      return cache.get('cache_size') || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Query logs
   */
  query(options = {}) {
    const props = PropertiesService.getScriptProperties();
    const logs = JSON.parse(props.getProperty('system_logs') || '[]');
    
    let filtered = logs;
    
    // Filter by level
    if (options.level) {
      filtered = filtered.filter(log => log.level === options.level);
    }
    
    // Filter by date range
    if (options.startDate) {
      filtered = filtered.filter(log => 
        new Date(log.timestamp) >= new Date(options.startDate)
      );
    }
    
    if (options.endDate) {
      filtered = filtered.filter(log => 
        new Date(log.timestamp) <= new Date(options.endDate)
      );
    }
    
    // Filter by search term
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.data).toLowerCase().includes(searchLower)
      );
    }
    
    // Sort
    filtered.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // Limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return filtered;
  }

  /**
   * Export logs
   */
  export(format = 'json') {
    const logs = this.query();
    
    switch (format) {
      case 'csv':
        return this.exportToCsv(logs);
      case 'json':
      default:
        return JSON.stringify(logs, null, 2);
    }
  }

  /**
   * Export to CSV
   */
  exportToCsv(logs) {
    if (logs.length === 0) return '';
    
    const headers = ['timestamp', 'level', 'message', 'user', 'functionName'];
    const rows = logs.map(log => [
      log.timestamp,
      log.level,
      log.message,
      log.metadata.user,
      log.metadata.functionName
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  /**
   * Clear logs
   */
  clear() {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('system_logs');
    this.logBuffer = [];
  }

  /**
   * Get statistics
   */
  getStats() {
    const logs = this.query();
    const stats = {
      total: logs.length,
      byLevel: {},
      byUser: {},
      byFunction: {},
      errorRate: 0
    };
    
    logs.forEach(log => {
      // By level
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      
      // By user
      const user = log.metadata.user;
      stats.byUser[user] = (stats.byUser[user] || 0) + 1;
      
      // By function
      const func = log.metadata.functionName;
      stats.byFunction[func] = (stats.byFunction[func] || 0) + 1;
    });
    
    // Calculate error rate
    const errors = (stats.byLevel.ERROR || 0) + (stats.byLevel.FATAL || 0);
    stats.errorRate = stats.total > 0 ? (errors / stats.total) * 100 : 0;
    
    return stats;
  }
}

// Create singleton instance
const Logger = new LoggingService();

// Convenience logging functions
function logDebug(message, data, options) {
  return Logger.log('DEBUG', message, data, options);
}

function logInfo(message, data, options) {
  return Logger.log('INFO', message, data, options);
}

function logWarn(message, data, options) {
  return Logger.log('WARN', message, data, options);
}

function logError(message, data, options) {
  return Logger.log('ERROR', message, data, options);
}

function logFatal(message, data, options) {
  return Logger.log('FATAL', message, data, options);
}

// Performance logging
function logPerformance(functionName, duration, data) {
  return Logger.log('INFO', `Performance: ${functionName}`, data, {
    functionName,
    duration
  });
}

// Audit logging
function logAudit(action, data) {
  return Logger.log('INFO', `Audit: ${action}`, data, {
    audit: true
  });
}

// Security logging
function logSecurity(event, data) {
  return Logger.log('WARN', `Security: ${event}`, data, {
    security: true
  });
}

// Query logs
function queryLogs(options) {
  return Logger.query(options);
}

// Export logs
function exportLogs(format) {
  return Logger.export(format);
}

// Get log statistics
function getLogStats() {
  return Logger.getStats();
}

// Clear logs
function clearLogs() {
  return Logger.clear();
}

// Flush buffered logs
function flushLogs() {
  return Logger.flush();
}