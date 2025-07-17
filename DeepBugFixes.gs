/**
 * 🔧 DEEP BUG FIXES - Critical Production Fixes
 * 
 * This file contains fixes for subtle bugs that could cause
 * data corruption, performance issues, or system failures
 */

/**
 * 1. Thread-Safe Rate Limiter
 * Prevents race conditions in rate limiting
 */
class ThreadSafeRateLimiter {
  static checkAndIncrement(operation, maxPerMinute = 20, maxPerHour = 1000) {
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
        return this.checkAndIncrement(operation, maxPerMinute, maxPerHour);
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
}

/**
 * 2. Safe Cache Manager
 * Handles cache corruption and size limits
 */
class SafeCacheManager {
  static MAX_KEY_LENGTH = 250;  // CacheService key limit
  static MAX_VALUE_SIZE = 100 * 1024;  // 100KB per value
  
  static generateKey(prefix, data) {
    // Create hash of data to ensure consistent key length
    const hash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA256,
      JSON.stringify(data).substring(0, 1000)  // Limit input size
    ).map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
     .join('')
     .substring(0, 32);  // Use first 32 chars of hash
    
    const key = `${prefix}_${hash}`;
    
    if (key.length > this.MAX_KEY_LENGTH) {
      throw new Error(`Cache key too long: ${key.length} chars`);
    }
    
    return key;
  }
  
  static put(key, value, ttl = 3600) {
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
  }
  
  static get(key, defaultValue = null) {
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
  }
  
  static safeParse(data, defaultValue = null) {
    if (!data) return defaultValue;
    
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('JSON parse failed:', error);
      return defaultValue;
    }
  }
}

/**
 * 3. Atomic Ticket Counter with Sharding
 * Prevents ID collisions under high concurrency
 */
class AtomicTicketCounter {
  static SHARD_COUNT = 10;  // Distribute load across shards
  
  static generateTicketId() {
    const lock = LockService.getScriptLock();
    const maxRetries = 3;
    let lastError;
    
    for (let retry = 0; retry < maxRetries; retry++) {
      try {
        // Try to acquire lock
        const hasLock = lock.tryLock(5000);
        if (!hasLock) {
          throw new Error('Could not acquire lock for ticket generation');
        }
        
        // Use sharding to reduce contention
        const shardId = Math.floor(Math.random() * this.SHARD_COUNT);
        const props = PropertiesService.getScriptProperties();
        const counterKey = `ticket_counter_shard_${shardId}`;
        
        // Atomic read-increment-write
        const counter = parseInt(props.getProperty(counterKey) || '10000');
        const nextCounter = counter + 1;
        
        // Validate counter
        if (isNaN(nextCounter) || nextCounter < counter) {
          throw new Error(`Counter corruption detected in shard ${shardId}`);
        }
        
        props.setProperty(counterKey, nextCounter.toString());
        
        // Generate ID with shard identifier
        const date = new Date();
        const dateStr = Utilities.formatDate(date, 'GMT', 'yyyyMMdd');
        const paddedCounter = nextCounter.toString().padStart(6, '0');
        
        return `T-${dateStr}-${shardId}${paddedCounter}`;
        
      } catch (error) {
        lastError = error;
        console.error(`Ticket generation attempt ${retry + 1} failed:`, error);
        
        // Exponential backoff
        if (retry < maxRetries - 1) {
          Utilities.sleep(Math.pow(2, retry) * 1000);
        }
      } finally {
        try {
          lock.releaseLock();
        } catch (e) {
          // Already released
        }
      }
    }
    
    // All retries failed - use timestamp fallback
    console.error('All ticket generation attempts failed, using timestamp');
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    return `T-FALLBACK-${timestamp}-${random}`;
  }
}

/**
 * 4. Memory-Safe Error History
 * Prevents memory leaks in long-running scripts
 */
class MemorySafeErrorHistory {
  static MAX_HISTORY_SIZE = 100;
  static CLEANUP_INTERVAL = 30 * 60 * 1000;  // 30 minutes
  static history = [];
  static lastCleanup = new Date();
  
  static add(error, context) {
    // Periodic cleanup
    if (new Date() - this.lastCleanup > this.CLEANUP_INTERVAL) {
      this.cleanup();
    }
    
    // Create error entry with limited size
    const entry = {
      timestamp: new Date().toISOString(),
      message: (error.message || error.toString()).substring(0, 500),
      context: JSON.stringify(context).substring(0, 1000),
      stack: (error.stack || '').substring(0, 2000)
    };
    
    this.history.unshift(entry);
    
    // Maintain size limit
    if (this.history.length > this.MAX_HISTORY_SIZE) {
      this.history = this.history.slice(0, this.MAX_HISTORY_SIZE);
    }
  }
  
  static cleanup() {
    console.log('Cleaning up error history');
    
    // Keep only recent errors
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);  // 24 hours
    
    this.history = this.history.filter(entry => {
      return new Date(entry.timestamp) > cutoff;
    });
    
    this.lastCleanup = new Date();
  }
  
  static getRecent(count = 10) {
    return this.history.slice(0, count);
  }
  
  static clear() {
    this.history = [];
    this.lastCleanup = new Date();
  }
}

/**
 * 5. Efficient Ticket Storage with Sharding
 * Prevents loading all tickets into memory
 */
class ShardedTicketStorage {
  static TICKETS_PER_SHARD = 100;
  static SHARD_INDEX_KEY = 'ticket_shard_index';
  
  static saveTicket(ticket) {
    const props = PropertiesService.getScriptProperties();
    
    // Validate ticket size
    const ticketJson = JSON.stringify(ticket);
    if (ticketJson.length > 400000) {  // 400KB limit
      throw new Error('Ticket data too large');
    }
    
    // Find appropriate shard
    const shardInfo = this.findOrCreateShard(ticket.createdAt);
    const ticketKey = `ticket_${shardInfo.shardId}_${ticket.id}`;
    
    // Save ticket
    props.setProperty(ticketKey, ticketJson);
    
    // Update shard metadata
    this.updateShardMetadata(shardInfo.shardId, ticket.id);
  }
  
  static findOrCreateShard(date) {
    const props = PropertiesService.getScriptProperties();
    const dateStr = date.substring(0, 10);  // YYYY-MM-DD
    
    // Load shard index
    const indexJson = props.getProperty(this.SHARD_INDEX_KEY) || '{}';
    const index = JSON.parse(indexJson);
    
    if (!index[dateStr]) {
      // Create new shard
      index[dateStr] = {
        shardId: `shard_${dateStr}`,
        count: 0,
        created: new Date().toISOString()
      };
      props.setProperty(this.SHARD_INDEX_KEY, JSON.stringify(index));
    }
    
    return index[dateStr];
  }
  
  static getTicketsPaginated(page = 1, pageSize = 50) {
    const props = PropertiesService.getScriptProperties();
    
    // Get shard index
    const indexJson = props.getProperty(this.SHARD_INDEX_KEY) || '{}';
    const index = JSON.parse(indexJson);
    
    // Get sorted shard list
    const shards = Object.values(index).sort((a, b) => 
      b.created.localeCompare(a.created)
    );
    
    // Calculate pagination
    const tickets = [];
    let skipped = 0;
    const skip = (page - 1) * pageSize;
    
    for (const shard of shards) {
      if (tickets.length >= pageSize) break;
      
      // Get tickets from shard
      const shardTickets = this.getTicketsFromShard(
        shard.shardId, 
        Math.max(0, skip - skipped),
        pageSize - tickets.length
      );
      
      tickets.push(...shardTickets);
      skipped += shard.count;
    }
    
    return {
      tickets: tickets,
      page: page,
      pageSize: pageSize,
      totalCount: Object.values(index).reduce((sum, s) => sum + s.count, 0)
    };
  }
  
  static getTicketsFromShard(shardId, skip, limit) {
    const props = PropertiesService.getScriptProperties();
    const tickets = [];
    
    // Get all properties (this is still a limitation)
    const allProps = props.getProperties();
    
    const shardKeys = Object.keys(allProps)
      .filter(k => k.startsWith(`ticket_${shardId}_`))
      .sort()
      .slice(skip, skip + limit);
    
    for (const key of shardKeys) {
      try {
        const ticketData = allProps[key];
        if (ticketData) {
          tickets.push(JSON.parse(ticketData));
        }
      } catch (error) {
        console.error(`Failed to parse ticket ${key}:`, error);
      }
    }
    
    return tickets;
  }
}

/**
 * 6. Timezone-Aware Business Hours
 * Correctly handles customer timezones
 */
class TimezoneAwareSchedule {
  static isBusinessHours(customerEmail) {
    const config = Config.get('businessHours', {
      start: 9,
      end: 17,
      days: [1, 2, 3, 4, 5],  // Mon-Fri
      timezone: 'America/New_York'
    });
    
    // Get customer timezone (from profile or IP-based detection)
    const customerTimezone = this.getCustomerTimezone(customerEmail) || config.timezone;
    
    // Current time in customer timezone
    const now = new Date();
    const customerTime = new Date(
      now.toLocaleString('en-US', { timeZone: customerTimezone })
    );
    
    const hour = customerTime.getHours();
    const day = customerTime.getDay();
    
    return config.days.includes(day) && 
           hour >= config.start && 
           hour < config.end;
  }
  
  static getCustomerTimezone(email) {
    // Check customer profile
    const props = PropertiesService.getScriptProperties();
    const profileKey = `customer_tz_${email}`;
    return props.getProperty(profileKey);
  }
  
  static setCustomerTimezone(email, timezone) {
    const props = PropertiesService.getScriptProperties();
    const profileKey = `customer_tz_${email}`;
    props.setProperty(profileKey, timezone);
  }
}

/**
 * 7. Robust Email Parser
 * Handles malformed emails gracefully
 */
class RobustEmailParser {
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
}

/**
 * 8. Smart HTML Sanitizer
 * Prevents XSS and encoding issues
 */
class SmartHtmlSanitizer {
  static escapeHtml(text) {
    if (!text) return '';
    
    // Create a text node and get its escaped content
    const div = XmlService.createElement('div');
    div.setText(text);
    
    return XmlService.getRawFormat()
      .format(div)
      .replace(/<\/?div>/g, '');
  }
  
  static convertToHtml(text) {
    if (!text) return '';
    
    // First escape HTML entities
    let html = this.escapeHtml(text);
    
    // Convert line breaks
    html = html
      .replace(/\r\n/g, '<br>')
      .replace(/\n/g, '<br>')
      .replace(/\r/g, '<br>');
    
    // Convert URLs to links
    html = html.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank">$1</a>'
    );
    
    return html;
  }
  
  static sanitizeHtml(html) {
    if (!html) return '';
    
    // Remove dangerous tags and attributes
    const cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '');
    
    return cleaned;
  }
}

/**
 * 9. Execution Time Guard
 * Prevents script timeout
 */
class ExecutionTimeGuard {
  static startTime = new Date();
  static warningThreshold = 4.5 * 60 * 1000;  // 4.5 minutes
  static criticalThreshold = 5.5 * 60 * 1000;  // 5.5 minutes
  
  static check() {
    const elapsed = new Date() - this.startTime;
    
    if (elapsed > this.criticalThreshold) {
      throw new Error('Script approaching 6-minute timeout limit');
    }
    
    if (elapsed > this.warningThreshold) {
      console.warn(`Script has been running for ${Math.floor(elapsed/1000)} seconds`);
      return 'warning';
    }
    
    return 'ok';
  }
  
  static reset() {
    this.startTime = new Date();
  }
  
  static getRemainingTime() {
    const elapsed = new Date() - this.startTime;
    const remaining = this.criticalThreshold - elapsed;
    return Math.max(0, remaining);
  }
  
  static canContinue(estimatedTime = 60000) {
    return this.getRemainingTime() > estimatedTime;
  }
}

/**
 * 10. Initialize all safety measures
 */
function initializeDeepBugFixes() {
  // Reset execution timer
  ExecutionTimeGuard.reset();
  
  // Clear old error history
  MemorySafeErrorHistory.cleanup();
  
  // Validate critical services
  try {
    // Test atomic counter
    const testId = AtomicTicketCounter.generateTicketId();
    console.log('Atomic counter test:', testId);
    
    // Test cache
    SafeCacheManager.put('test_key', 'test_value', 60);
    const cached = SafeCacheManager.get('test_key');
    console.log('Cache test:', cached === 'test_value' ? 'PASS' : 'FAIL');
    
  } catch (error) {
    console.error('Deep bug fixes initialization failed:', error);
  }
  
  console.log('✅ Deep bug fixes initialized');
}

// Auto-initialize
initializeDeepBugFixes();