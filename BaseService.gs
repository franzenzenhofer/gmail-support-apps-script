/**
 * BaseService.gs - DRY Base Class for All Services
 * Eliminates repeated constructor patterns and common functionality
 */

class BaseService {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.config = Config.get(serviceName) || {};
    this.cache = CacheService.getScriptCache();
    this.startTime = Date.now();
    
    // Rate limiting
    this.rateLimiter = options.rateLimiter || this.createRateLimiter();
    
    // Error handling context
    this.errorContext = { service: serviceName };
    
    // Initialize service-specific setup
    this.initializeService();
  }
  
  /**
   * Override in child classes for specific initialization
   */
  initializeService() {
    // Default: no-op
  }
  
  /**
   * Centralized rate limiting
   */
  createRateLimiter() {
    const limits = this.config.rateLimits || DEFAULT_RATE_LIMITS;
    return new RateLimiter(limits);
  }
  
  /**
   * DRY wrapper for operations with error handling and profiling
   */
  withErrorHandling(operation, fn, context = {}) {
    const fullOperation = `${this.serviceName}_${operation}`;
    
    try {
      this.profile(fullOperation);
      
      // Rate limiting check
      if (this.rateLimiter) {
        this.rateLimiter.checkLimit(operation);
      }
      
      const result = fn();
      this.profileEnd(fullOperation);
      return result;
      
    } catch (error) {
      this.profileEnd(fullOperation);
      throw this.handleError(error, { ...this.errorContext, operation, ...context });
    }
  }
  
  /**
   * Async version of withErrorHandling
   */
  async withAsyncErrorHandling(operation, fn, context = {}) {
    const fullOperation = `${this.serviceName}_${operation}`;
    
    try {
      this.profile(fullOperation);
      
      if (this.rateLimiter) {
        this.rateLimiter.checkLimit(operation);
      }
      
      const result = await fn();
      this.profileEnd(fullOperation);
      return result;
      
    } catch (error) {
      this.profileEnd(fullOperation);
      throw this.handleError(error, { ...this.errorContext, operation, ...context });
    }
  }
  
  /**
   * Centralized caching with TTL
   */
  getCached(key, fallbackFn, ttl = CACHE_TTL.MEDIUM) {
    const cacheKey = `${this.serviceName}_${key}`;
    let cached = this.cache.get(cacheKey);
    
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Invalid JSON, proceed to fallback
      }
    }
    
    const result = fallbackFn();
    if (result !== null && result !== undefined) {
      this.cache.put(cacheKey, JSON.stringify(result), ttl);
    }
    
    return result;
  }
  
  /**
   * Batch operation helper
   */
  batchProcess(items, processor, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = processor(batch);
      results.push(...batchResults);
      
      // Execution time check
      if (!this.canContinue()) {
        Logger.log(`${this.serviceName}: Stopping batch processing due to time limit`);
        break;
      }
    }
    
    return results;
  }
  
  /**
   * Centralized profiling
   */
  profile(operation) {
    if (typeof profile === 'function') {
      profile(operation);
    }
  }
  
  profileEnd(operation) {
    if (typeof profileEnd === 'function') {
      profileEnd(operation);
    }
  }
  
  /**
   * Centralized error handling
   */
  handleError(error, context = {}) {
    if (typeof handleError === 'function') {
      return handleError(error, { ...this.errorContext, ...context });
    }
    
    // Fallback error handling
    Logger.log(`Error in ${this.serviceName}: ${error.toString()}`);
    return error;
  }
  
  /**
   * Execution time check
   */
  canContinue(bufferSeconds = 30) {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const maxRuntime = this.config.maxRuntime || 300; // 5 minutes default
    return elapsed < (maxRuntime - bufferSeconds);
  }
  
  /**
   * Input validation helper
   */
  validateInput(input, rules) {
    return InputValidator.validate(input, rules);
  }
  
  /**
   * Memory cleanup for long-running processes
   */
  cleanup() {
    // Clear internal caches if they exist
    if (this.internalCache) {
      this.internalCache.clear();
    }
    
    // Reset large arrays
    Object.keys(this).forEach(key => {
      if (Array.isArray(this[key]) && this[key].length > 100) {
        this[key].length = 0;
      }
    });
  }
}

/**
 * Rate Limiter - Centralized rate limiting logic
 */
class RateLimiter {
  constructor(limits = {}) {
    this.limits = { ...DEFAULT_RATE_LIMITS, ...limits };
    this.cache = CacheService.getScriptCache();
  }
  
  checkLimit(operation) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    
    const minuteKey = `rate_${operation}_${minute}`;
    const hourKey = `rate_${operation}_${hour}`;
    
    const minuteCount = parseInt(this.cache.get(minuteKey) || '0');
    const hourCount = parseInt(this.cache.get(hourKey) || '0');
    
    if (minuteCount >= this.limits.perMinute || hourCount >= this.limits.perHour) {
      throw new Error(`Rate limit exceeded for ${operation}`);
    }
    
    this.cache.put(minuteKey, (minuteCount + 1).toString(), 60);
    this.cache.put(hourKey, (hourCount + 1).toString(), 3600);
  }
}

/**
 * Input Validator - Centralized input validation
 */
class InputValidator {
  static validate(input, rules) {
    const errors = [];
    
    if (rules.required && (input === null || input === undefined || input === '')) {
      errors.push('Input is required');
    }
    
    if (input && rules.type) {
      if (rules.type === 'email' && !this.isValidEmail(input)) {
        errors.push('Invalid email format');
      }
      if (rules.type === 'url' && !this.isValidUrl(input)) {
        errors.push('Invalid URL format');
      }
    }
    
    if (input && rules.maxLength && input.length > rules.maxLength) {
      errors.push(`Input too long (max ${rules.maxLength})`);
    }
    
    if (input && rules.pattern && !rules.pattern.test(input)) {
      errors.push('Input format invalid');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors,
      sanitized: this.sanitize(input)
    };
  }
  
  static sanitize(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '') // Remove potential HTML
      .replace(/javascript:/gi, '') // Remove JS protocols
      .trim();
  }
  
  static isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  static isValidUrl(url) {
    try {
      new URL(url);
      return url.startsWith('https://');
    } catch {
      return false;
    }
  }
}

/**
 * Constants - Centralized configuration
 */
const DEFAULT_RATE_LIMITS = {
  perMinute: 60,
  perHour: 1000
};

const CACHE_TTL = {
  SHORT: 300,    // 5 minutes
  MEDIUM: 3600,  // 1 hour
  LONG: 86400,   // 24 hours
  PERMANENT: 604800 // 1 week
};

const ERROR_MESSAGES = {
  API_KEY_MISSING: 'API key not configured',
  RATE_LIMIT: 'Rate limit exceeded',
  INVALID_INPUT: 'Invalid input provided',
  TIMEOUT: 'Operation timed out',
  PERMISSION_DENIED: 'Permission denied'
};