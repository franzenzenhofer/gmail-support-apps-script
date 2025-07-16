/**
 * ErrorService.gs - Comprehensive Error Handling and Recovery
 * 
 * DRY: Centralized error handling patterns
 * KISS: Simple API for complex error scenarios
 */

class ErrorService {
  constructor() {
    this.errorHandlers = new Map();
    this.recoveryStrategies = new Map();
    this.errorHistory = [];
    this.maxHistorySize = 100;
    this.retryConfig = this.getDefaultRetryConfig();
    this.setupDefaultHandlers();
    this.setupDefaultRecoveryStrategies();
  }

  /**
   * Get default retry configuration
   */
  getDefaultRetryConfig() {
    return {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true
    };
  }

  /**
   * Setup default error handlers
   */
  setupDefaultHandlers() {
    // Network errors
    this.registerHandler('NetworkError', (error) => ({
      message: 'Network connection failed',
      action: 'retry',
      userMessage: 'Please check your internet connection and try again.'
    }));
    
    // API errors
    this.registerHandler('ApiError', (error) => ({
      message: `API error: ${error.code || 'Unknown'}`,
      action: error.code === 429 ? 'backoff' : 'log',
      userMessage: error.code === 429 ? 'Too many requests. Please wait a moment.' : 'Service temporarily unavailable.'
    }));
    
    // Gmail errors
    this.registerHandler('GmailError', (error) => ({
      message: 'Gmail operation failed',
      action: 'retry',
      userMessage: 'Unable to access Gmail. Please ensure you have granted necessary permissions.'
    }));
    
    // Permission errors
    this.registerHandler('PermissionError', (error) => ({
      message: 'Insufficient permissions',
      action: 'escalate',
      userMessage: 'You do not have permission to perform this action.'
    }));
    
    // Validation errors
    this.registerHandler('ValidationError', (error) => ({
      message: `Validation failed: ${error.field}`,
      action: 'reject',
      userMessage: `Invalid input: ${error.message}`
    }));
    
    // Timeout errors
    this.registerHandler('TimeoutError', (error) => ({
      message: 'Operation timed out',
      action: 'retry',
      userMessage: 'The operation took too long. Retrying...'
    }));
  }

  /**
   * Setup default recovery strategies
   */
  setupDefaultRecoveryStrategies() {
    // Retry strategy
    this.registerRecovery('retry', async (error, context) => {
      const attempt = context.attempt || 1;
      if (attempt > this.retryConfig.maxRetries) {
        throw new Error(`Max retries (${this.retryConfig.maxRetries}) exceeded`);
      }
      
      const delay = this.calculateDelay(attempt);
      Utilities.sleep(delay);
      
      return {
        retry: true,
        attempt: attempt + 1,
        delay: delay
      };
    });
    
    // Exponential backoff strategy
    this.registerRecovery('backoff', async (error, context) => {
      const attempt = context.attempt || 1;
      const delay = Math.min(
        this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
        this.retryConfig.maxDelay
      );
      
      Utilities.sleep(delay);
      
      return {
        retry: true,
        attempt: attempt + 1,
        delay: delay,
        nextDelay: Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelay)
      };
    });
    
    // Circuit breaker strategy
    this.registerRecovery('circuit', async (error, context) => {
      const failures = context.failures || 0;
      const threshold = 5;
      
      if (failures >= threshold) {
        const resetTime = context.resetTime || Date.now() + 60000; // 1 minute
        if (Date.now() < resetTime) {
          throw new Error('Circuit breaker is OPEN. Service is temporarily disabled.');
        }
        // Reset circuit
        return {
          retry: true,
          failures: 0,
          resetTime: null
        };
      }
      
      return {
        retry: true,
        failures: failures + 1,
        resetTime: failures + 1 >= threshold ? Date.now() + 60000 : null
      };
    });
    
    // Fallback strategy
    this.registerRecovery('fallback', async (error, context) => {
      if (context.fallbackFn) {
        return {
          retry: false,
          result: await context.fallbackFn()
        };
      }
      throw new Error('No fallback function provided');
    });
    
    // Cache strategy
    this.registerRecovery('cache', async (error, context) => {
      const cache = CacheService.getScriptCache();
      const cacheKey = context.cacheKey;
      
      if (cacheKey) {
        const cached = cache.get(cacheKey);
        if (cached) {
          return {
            retry: false,
            result: JSON.parse(cached),
            fromCache: true
          };
        }
      }
      
      throw new Error('No cached data available');
    });
  }

  /**
   * Handle error with recovery
   */
  async handle(error, context = {}) {
    const errorEntry = this.createErrorEntry(error, context);
    this.addToHistory(errorEntry);
    
    try {
      // Log error
      logError(`Error handled: ${error.name || 'UnknownError'}`, {
        error: errorEntry,
        context: context
      });
      
      // Get handler
      const handler = this.getHandler(error);
      const handlerResult = handler(error, context);
      
      // Apply recovery strategy
      if (handlerResult.action && this.recoveryStrategies.has(handlerResult.action)) {
        const recovery = this.recoveryStrategies.get(handlerResult.action);
        const recoveryResult = await recovery(error, context);
        
        return {
          ...handlerResult,
          recovery: recoveryResult,
          handled: true
        };
      }
      
      return {
        ...handlerResult,
        handled: true
      };
      
    } catch (recoveryError) {
      logError('Recovery failed', {
        originalError: error,
        recoveryError: recoveryError
      });
      
      return {
        message: 'Error recovery failed',
        userMessage: 'An unexpected error occurred. Please try again later.',
        handled: false,
        error: recoveryError
      };
    }
  }

  /**
   * Wrap function with error handling
   */
  wrap(fn, options = {}) {
    const self = this;
    
    return async function(...args) {
      let context = {
        functionName: fn.name || 'anonymous',
        attempt: 1,
        ...options
      };
      
      while (true) {
        try {
          // Start performance tracking
          const startTime = Date.now();
          
          // Execute function
          const result = await fn.apply(this, args);
          
          // Log success if recovered
          if (context.attempt > 1) {
            logInfo(`Function recovered after ${context.attempt} attempts`, {
              functionName: context.functionName,
              duration: Date.now() - startTime
            });
          }
          
          return result;
          
        } catch (error) {
          // Handle error
          const handled = await self.handle(error, context);
          
          // Check if should retry
          if (handled.recovery && handled.recovery.retry) {
            context = { ...context, ...handled.recovery };
            continue;
          }
          
          // Check if has fallback result
          if (handled.recovery && handled.recovery.result !== undefined) {
            return handled.recovery.result;
          }
          
          // Re-throw if not handled
          throw self.enhance(error, {
            context: context,
            handled: handled
          });
        }
      }
    };
  }

  /**
   * Try-catch with recovery
   */
  async tryWithRecovery(fn, options = {}) {
    return this.wrap(fn, options)();
  }

  /**
   * Register error handler
   */
  registerHandler(errorType, handler) {
    this.errorHandlers.set(errorType, handler);
  }

  /**
   * Register recovery strategy
   */
  registerRecovery(strategy, recoveryFn) {
    this.recoveryStrategies.set(strategy, recoveryFn);
  }

  /**
   * Get handler for error
   */
  getHandler(error) {
    // Check specific error type
    const errorType = error.name || error.constructor.name;
    if (this.errorHandlers.has(errorType)) {
      return this.errorHandlers.get(errorType);
    }
    
    // Check error code
    if (error.code && this.errorHandlers.has(error.code)) {
      return this.errorHandlers.get(error.code);
    }
    
    // Default handler
    return (error) => ({
      message: error.message || 'Unknown error',
      action: 'log',
      userMessage: 'An unexpected error occurred.'
    });
  }

  /**
   * Create error entry
   */
  createErrorEntry(error, context) {
    return {
      id: Utilities.getUuid(),
      timestamp: new Date().toISOString(),
      name: error.name || 'UnknownError',
      message: error.message,
      stack: error.stack,
      code: error.code,
      context: context,
      user: Session.getActiveUser().getEmail(),
      scriptId: ScriptApp.getScriptId()
    };
  }

  /**
   * Add to error history
   */
  addToHistory(errorEntry) {
    this.errorHistory.unshift(errorEntry);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.pop();
    }
  }

  /**
   * Calculate retry delay with jitter
   */
  calculateDelay(attempt) {
    let delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
      this.retryConfig.maxDelay
    );
    
    if (this.retryConfig.jitter) {
      // Add random jitter (±25%)
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      delay += jitter;
    }
    
    return Math.round(delay);
  }

  /**
   * Enhance error with additional context
   */
  enhance(error, additionalContext = {}) {
    if (error._enhanced) return error;
    
    const enhanced = new Error(error.message);
    enhanced.name = error.name;
    enhanced.stack = error.stack;
    enhanced.code = error.code;
    enhanced._enhanced = true;
    enhanced.context = {
      ...error.context,
      ...additionalContext,
      timestamp: new Date().toISOString(),
      user: Session.getActiveUser().getEmail()
    };
    
    return enhanced;
  }

  /**
   * Create custom error types
   */
  createError(name, message, code, context = {}) {
    const error = new Error(message);
    error.name = name;
    error.code = code;
    error.context = context;
    return error;
  }

  /**
   * Get error history
   */
  getHistory(options = {}) {
    let history = this.errorHistory;
    
    if (options.errorType) {
      history = history.filter(e => e.name === options.errorType);
    }
    
    if (options.startDate) {
      history = history.filter(e => new Date(e.timestamp) >= new Date(options.startDate));
    }
    
    if (options.limit) {
      history = history.slice(0, options.limit);
    }
    
    return history;
  }

  /**
   * Get error statistics
   */
  getStats() {
    const stats = {
      total: this.errorHistory.length,
      byType: {},
      byHour: {},
      topErrors: []
    };
    
    this.errorHistory.forEach(error => {
      // By type
      stats.byType[error.name] = (stats.byType[error.name] || 0) + 1;
      
      // By hour
      const hour = new Date(error.timestamp).getHours();
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
    });
    
    // Top errors
    stats.topErrors = Object.entries(stats.byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
    
    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
  }

  /**
   * Export error report
   */
  exportReport(format = 'json') {
    const report = {
      generated: new Date().toISOString(),
      stats: this.getStats(),
      recentErrors: this.getHistory({ limit: 20 })
    };
    
    if (format === 'html') {
      return this.generateHtmlReport(report);
    }
    
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate HTML error report
   */
  generateHtmlReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Error Report - ${report.generated}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1, h2 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .error { color: #d73502; }
    .stat { background-color: #f9f9f9; padding: 10px; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Error Report</h1>
  <p>Generated: ${report.generated}</p>
  
  <h2>Statistics</h2>
  <div class="stat">
    <strong>Total Errors:</strong> ${report.stats.total}
  </div>
  
  <h3>Top Error Types</h3>
  <table>
    <tr><th>Error Type</th><th>Count</th></tr>
    ${report.stats.topErrors.map(e => 
      `<tr><td class="error">${e.type}</td><td>${e.count}</td></tr>`
    ).join('')}
  </table>
  
  <h3>Recent Errors</h3>
  <table>
    <tr><th>Time</th><th>Type</th><th>Message</th><th>User</th></tr>
    ${report.recentErrors.map(e => 
      `<tr>
        <td>${new Date(e.timestamp).toLocaleString()}</td>
        <td class="error">${e.name}</td>
        <td>${e.message}</td>
        <td>${e.user}</td>
      </tr>`
    ).join('')}
  </table>
</body>
</html>`;
  }
}

// Create singleton instance
const ErrorHandler = new ErrorService();

// Convenience functions
function handleError(error, context) {
  return ErrorHandler.handle(error, context);
}

function wrapWithErrorHandling(fn, options) {
  return ErrorHandler.wrap(fn, options);
}

function tryWithRecovery(fn, options) {
  return ErrorHandler.tryWithRecovery(fn, options);
}

function createError(name, message, code, context) {
  return ErrorHandler.createError(name, message, code, context);
}

function getErrorHistory(options) {
  return ErrorHandler.getHistory(options);
}

function getErrorStats() {
  return ErrorHandler.getStats();
}

function exportErrorReport(format) {
  return ErrorHandler.exportReport(format);
}

// Common error types
const NetworkError = (message) => createError('NetworkError', message, 'NETWORK_ERROR');
const ApiError = (message, code) => createError('ApiError', message, code);
const ValidationError = (field, message) => createError('ValidationError', message, 'VALIDATION_ERROR', { field });
const PermissionError = (message) => createError('PermissionError', message, 'PERMISSION_ERROR');
const TimeoutError = (message) => createError('TimeoutError', message, 'TIMEOUT_ERROR');