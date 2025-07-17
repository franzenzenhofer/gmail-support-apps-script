/**
 * SafetyService.gs - Production Safety Measures
 * 
 * Implements critical safety features to prevent
 * data corruption, performance issues, and system failures
 */

class SafetyService {
  constructor() {
    this.scriptStartTime = new Date();
    this.maxScriptRuntime = 5.5 * 60 * 1000; // 5.5 minutes
    this.cache = CacheService.getScriptCache();
  }

  /**
   * Thread-safe rate limiter
   */
  static checkRateLimit(operation, maxPerMinute = 20, maxPerHour = 1000) {
    const lock = LockService.getScriptLock();
    
    try {
      // Acquire lock with timeout
      lock.waitLock(5000);
      
      const cache = CacheService.getScriptCache();
      const now = new Date();
      const minuteKey = `rate_${operation}_m_${Math.floor(now.getTime() / 60000)}`;
      const hourKey = `rate_${operation}_h_${Math.floor(now.getTime() / 3600000)}`;
      
      // Atomic read
      const minuteCount = parseInt(cache.get(minuteKey) || '0');
      const hourCount = parseInt(cache.get(hourKey) || '0');
      
      // Check limits
      if (minuteCount >= maxPerMinute) {
        throw new Error(`Rate limit exceeded: ${maxPerMinute} per minute`);
      }
      
      if (hourCount >= maxPerHour) {
        throw new Error(`Rate limit exceeded: ${maxPerHour} per hour`);
      }
      
      // Atomic increment
      cache.put(minuteKey, (minuteCount + 1).toString(), 60);
      cache.put(hourKey, (hourCount + 1).toString(), 3600);
      
      return true;
      
    } catch (error) {
      if (error.toString().includes('Could not acquire lock')) {
        // Another instance is checking - wait and retry once
        Utilities.sleep(1000);
        return SafetyService.checkRateLimit(operation, maxPerMinute, maxPerHour);
      }
      throw error;
    } finally {
      try {
        lock.releaseLock();
      } catch (e) {
        // Lock already released
      }
    }
  }

  /**
   * Safe cache operations
   */
  static safeCache = {
    MAX_KEY_LENGTH: 250,
    MAX_VALUE_SIZE: 100 * 1024, // 100KB
    
    generateKey(prefix, data) {
      // Create hash of data to ensure consistent key length
      const hash = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA256,
        JSON.stringify(data).substring(0, 1000)
      ).map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
       .join('')
       .substring(0, 32);
      
      const key = `${prefix}_${hash}`;
      
      if (key.length > this.MAX_KEY_LENGTH) {
        throw new Error(`Cache key too long: ${key.length} chars`);
      }
      
      return key;
    },
    
    put(key, value, ttl = 3600) {
      const cache = CacheService.getScriptCache();
      
      // Validate value size
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (serialized.length > this.MAX_VALUE_SIZE) {
        console.warn(`Cache value too large for ${key}: ${serialized.length} bytes`);
        return false;
      }
      
      try {
        cache.put(key, serialized, ttl);
        return true;
      } catch (error) {
        console.error('Cache put failed:', error);
        return false;
      }
    },
    
    get(key, defaultValue = null) {
      const cache = CacheService.getScriptCache();
      
      try {
        const value = cache.get(key);
        if (!value) return defaultValue;
        
        // Safe JSON parse
        try {
          return JSON.parse(value);
        } catch (e) {
          // Not JSON, return as string
          return value;
        }
      } catch (error) {
        console.error('Cache get failed:', error);
        return defaultValue;
      }
    },
    
    remove(key) {
      try {
        const cache = CacheService.getScriptCache();
        cache.remove(key);
      } catch (error) {
        console.error('Cache remove failed:', error);
      }
    }
  };

  /**
   * Properties storage validation
   */
  static validatePropertySize(key, value) {
    const MAX_PROPERTY_SIZE = 9 * 1024; // 9KB (leaving 1KB buffer)
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (serialized.length > MAX_PROPERTY_SIZE) {
      throw new Error(`Property ${key} too large: ${serialized.length} bytes (max: ${MAX_PROPERTY_SIZE})`);
    }
    
    return serialized;
  }

  /**
   * Check script execution time
   */
  checkExecutionTime() {
    const elapsed = new Date() - this.scriptStartTime;
    
    if (elapsed > this.maxScriptRuntime) {
      throw new Error('Script approaching 6-minute timeout limit');
    }
    
    if (elapsed > 4.5 * 60 * 1000) {
      console.warn(`Script has been running for ${Math.floor(elapsed/1000)} seconds`);
      return 'warning';
    }
    
    return 'ok';
  }

  /**
   * Get remaining execution time
   */
  getRemainingTime() {
    const elapsed = new Date() - this.scriptStartTime;
    const remaining = this.maxScriptRuntime - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Check if operation can continue
   */
  canContinue(estimatedTime = 60000) {
    return this.getRemainingTime() > estimatedTime;
  }

  /**
   * Safe JSON parse
   */
  static safeParse(data, defaultValue = null) {
    if (!data) return defaultValue;
    
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('JSON parse failed:', error);
      return defaultValue;
    }
  }

  /**
   * Robust email parser
   */
  static parseEmailAddress(fromString) {
    if (!fromString || typeof fromString !== 'string') {
      return {
        email: 'unknown@example.com',
        name: 'Unknown Sender',
        display: 'Unknown Sender <unknown@example.com>'
      };
    }
    
    // Patterns for different email formats
    const patterns = [
      // "Name" <email@domain.com>
      /^"?([^"<]+)"?\s*<([^>]+)>$/,
      // Name <email@domain.com>
      /^([^<]+)<([^>]+)>$/,
      // email@domain.com (Name)
      /^([^\s]+@[^\s]+)\s*\(([^)]+)\)$/,
      // Just email
      /^([^\s]+@[^\s]+)$/
    ];
    
    for (const pattern of patterns) {
      const match = fromString.match(pattern);
      if (match) {
        if (match.length === 3) {
          // Has name and email
          const name = match[1].trim();
          const email = match[2].trim();
          return {
            email: email,
            name: name || email.split('@')[0],
            display: `${name} <${email}>`
          };
        } else if (match.length === 2) {
          // Just email
          const email = match[1].trim();
          return {
            email: email,
            name: email.split('@')[0].replace(/[._-]/g, ' '),
            display: email
          };
        }
      }
    }
    
    // Fallback - treat whole string as email
    return {
      email: fromString.trim(),
      name: fromString.split('@')[0] || 'Customer',
      display: fromString.trim()
    };
  }

  /**
   * Extract email headers safely
   */
  static extractHeaders(message) {
    const headers = {};
    const headerNames = [
      'Message-ID',
      'In-Reply-To', 
      'References',
      'X-Mailer',
      'Return-Path',
      'Subject',
      'From',
      'To',
      'Date'
    ];
    
    for (const name of headerNames) {
      try {
        const value = message.getHeader(name);
        if (value) {
          headers[name] = value;
        }
      } catch (error) {
        // Individual header not available
        console.log(`Header ${name} not available`);
      }
    }
    
    return headers;
  }

  /**
   * HTML sanitization
   */
  static sanitizeHtml(text) {
    if (!text) return '';
    
    // First escape HTML entities (correct order)
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    // Convert line breaks
    html = html
      .replace(/\r\n/g, '<br>')
      .replace(/\n/g, '<br>')
      .replace(/\r/g, '<br>');
    
    // Convert URLs to links safely
    html = html.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
    
    return html;
  }

  /**
   * Remove dangerous HTML
   */
  static stripDangerousHtml(html) {
    if (!html) return '';
    
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '');
  }

  /**
   * Validate email format
   */
  static isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Basic format check
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    
    const [local, domain] = parts;
    
    // Local part validation
    if (local.length === 0 || local.length > 64) return false;
    
    // Domain validation
    if (domain.length === 0 || domain.length > 255) return false;
    
    // More permissive regex for international domains
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    return domainRegex.test(domain);
  }

  /**
   * Business hours check with timezone
   */
  static isBusinessHours(customerEmail, timezone) {
    const config = Config.get('businessHours', {
      start: 9,
      end: 17,
      days: [1, 2, 3, 4, 5], // Mon-Fri
      timezone: 'America/New_York'
    });
    
    // Use customer timezone if available
    const targetTimezone = timezone || config.timezone;
    
    // Current time in target timezone
    const now = new Date();
    const targetTime = new Date(
      now.toLocaleString('en-US', { timeZone: targetTimezone })
    );
    
    const hour = targetTime.getHours();
    const day = targetTime.getDay();
    
    return config.days.includes(day) && 
           hour >= config.start && 
           hour < config.end;
  }

  /**
   * Simple language detection
   */
  static detectLanguage(text) {
    if (!text || text.length < 10) return 'en';
    
    // Common language patterns
    const patterns = {
      'es': /\b(el|la|los|las|un|una|de|que|es|en)\b/gi,
      'fr': /\b(le|la|les|un|une|de|que|est|dans)\b/gi,
      'de': /\b(der|die|das|ein|eine|und|ist|nicht)\b/gi,
      'it': /\b(il|la|di|che|è|un|una|per)\b/gi,
      'pt': /\b(o|a|os|as|um|uma|de|que|é)\b/gi
    };
    
    // Count matches
    let maxMatches = 0;
    let detectedLang = 'en';
    
    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = (text.match(pattern) || []).length;
      if (matches > maxMatches && matches > 5) {
        maxMatches = matches;
        detectedLang = lang;
      }
    }
    
    return detectedLang;
  }
}

// Create singleton instance
const Safety = new SafetyService();

// Export convenience functions
function checkRateLimit(operation, maxPerMinute, maxPerHour) {
  return SafetyService.checkRateLimit(operation, maxPerMinute, maxPerHour);
}

function validatePropertySize(key, value) {
  return SafetyService.validatePropertySize(key, value);
}

function checkExecutionTime() {
  return Safety.checkExecutionTime();
}

function canContinue(estimatedTime) {
  return Safety.canContinue(estimatedTime);
}

function safeParse(data, defaultValue) {
  return SafetyService.safeParse(data, defaultValue);
}

function parseEmailAddress(fromString) {
  return SafetyService.parseEmailAddress(fromString);
}

function sanitizeHtml(text) {
  return SafetyService.sanitizeHtml(text);
}

function isValidEmail(email) {
  return SafetyService.isValidEmail(email);
}

function isBusinessHours(customerEmail, timezone) {
  return SafetyService.isBusinessHours(customerEmail, timezone);
}

// Initialize safety checks
(function initializeSafety() {
  console.log('✅ Safety Service initialized');
  console.log(`Script timeout protection: ${Safety.maxScriptRuntime / 1000}s`);
})();