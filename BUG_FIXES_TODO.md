# 🐛 Bug Fixes and Edge Cases TODO

## Overview
This document tracks all identified bugs, edge cases, and improvements needed for production readiness.

## 🔴 CRITICAL - Fix Immediately

### 1. API Key Validation ✅
**File**: Code.gs
**Issue**: Hardcoded placeholder API key
**Fix**:
```javascript
// Add to ConfigService.gs
static validateApiKey() {
  const apiKey = this.get('gemini.apiKey');
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    throw new Error('⚠️ Gemini API key not configured. Please run the installer or set GEMINI_API_KEY in Script Properties.');
  }
  return apiKey;
}
```

### 2. Properties Storage Limits ✅
**Files**: TicketService.gs, LoggingService.gs
**Issue**: No size checking for 500KB limit
**Fix**:
```javascript
// Add to BaseService or utilities
static checkStorageSize(key, data) {
  const serialized = JSON.stringify(data);
  const sizeKB = new Blob([serialized]).size / 1024;
  
  if (sizeKB > 450) { // Leave 50KB buffer
    throw new Error(`Storage limit exceeded for ${key}: ${sizeKB}KB (max 450KB)`);
  }
  
  return serialized;
}
```

### 3. Error Recovery in Main Loop ✅
**File**: Code.gs
**Issue**: One failed thread stops all processing
**Fix**:
```javascript
function processNewSupportEmails() {
  const errors = [];
  let processed = 0;
  
  threads.forEach(thread => {
    try {
      processSupportThread(thread);
      processed++;
    } catch (error) {
      console.error(`Failed to process thread ${thread.getId()}:`, error);
      errors.push({
        threadId: thread.getId(),
        subject: thread.getFirstMessageSubject(),
        error: error.toString()
      });
    }
  });
  
  // Report summary
  console.log(`Processed ${processed}/${threads.length} threads`);
  if (errors.length > 0) {
    ErrorService.reportBatchErrors(errors);
  }
}
```

## 🟡 HIGH Priority

### 4. Atomic Ticket Counter ✅
**File**: TicketService.gs
**Issue**: Race condition in ticket ID generation
**Fix**:
```javascript
static generateTicketId() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // Wait up to 10 seconds
    
    const props = PropertiesService.getScriptProperties();
    const counter = parseInt(props.getProperty('ticket_counter') || '1000');
    const nextCounter = counter + 1;
    
    // Atomic update
    props.setProperty('ticket_counter', nextCounter.toString());
    
    const date = new Date();
    const dateStr = Utilities.formatDate(date, 'GMT', 'yyyyMMdd');
    return `TICKET-${dateStr}-${nextCounter}`;
    
  } catch (e) {
    throw new Error('Could not obtain lock for ticket generation');
  } finally {
    lock.releaseLock();
  }
}
```

### 5. Remove Async/Await ✅
**Files**: AIService.gs, ErrorService.gs
**Issue**: Apps Script doesn't support async/await
**Fix**: Convert all async functions to synchronous

### 6. Gmail Operation Null Checks ✅
**File**: EmailService.gs
**Fix**:
```javascript
static getThreadSafely(threadId) {
  try {
    const thread = GmailApp.getThreadById(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    return thread;
  } catch (error) {
    if (error.toString().includes('Invalid thread id')) {
      throw new Error(`Invalid thread ID format: ${threadId}`);
    }
    throw error;
  }
}
```

### 7. Execution Time Limits ✅
**Issue**: Scripts timeout after 6 minutes
**Fix**:
```javascript
class ExecutionTimer {
  static start() {
    this.startTime = new Date();
    this.maxRuntime = 5 * 60 * 1000; // 5 minutes (leave 1 min buffer)
  }
  
  static shouldStop() {
    return (new Date() - this.startTime) > this.maxRuntime;
  }
  
  static getRemainingTime() {
    return Math.max(0, this.maxRuntime - (new Date() - this.startTime));
  }
}
```

## 🟠 MEDIUM Priority

### 8. Email Body Truncation ✅
**Fix**:
```javascript
static truncateEmailBody(body, maxLength = 10000) {
  if (!body) return '';
  
  if (body.length <= maxLength) return body;
  
  // Try to break at sentence boundary
  const truncated = body.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  
  if (lastPeriod > maxLength * 0.8) {
    return truncated.substring(0, lastPeriod + 1) + '\n\n[Content truncated...]';
  }
  
  return truncated + '...\n\n[Content truncated...]';
}
```

### 9. Concurrent Execution Prevention ✅
**Fix**:
```javascript
function processNewSupportEmails() {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(1000);
  
  if (!hasLock) {
    console.log('Another instance is already running. Skipping this execution.');
    return;
  }
  
  try {
    // Main processing logic
    ExecutionTimer.start();
    processEmailsWithTimeLimit();
  } finally {
    lock.releaseLock();
  }
}
```

### 10. Spreadsheet Access Validation ✅
**Fix**:
```javascript
static validateSpreadsheetAccess(spreadsheetId) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    // Try to read to ensure we have permission
    ss.getName();
    return true;
  } catch (error) {
    if (error.toString().includes('No item with the given ID')) {
      throw new Error(`Spreadsheet not found: ${spreadsheetId}`);
    }
    if (error.toString().includes('No access')) {
      throw new Error(`No permission to access spreadsheet: ${spreadsheetId}. Please share it with the script.`);
    }
    throw error;
  }
}
```

## 🔵 LOW Priority

### 11. Implement Data Archival
```javascript
class DataArchiver {
  static archiveOldTickets(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const tickets = TicketService.getAllTickets();
    const toArchive = tickets.filter(t => new Date(t.createdAt) < cutoffDate);
    
    if (toArchive.length > 0) {
      const archiveSheet = this.getOrCreateArchiveSheet();
      this.appendToArchive(archiveSheet, toArchive);
      this.removeFromProperties(toArchive.map(t => t.id));
    }
    
    return toArchive.length;
  }
}
```

### 12. Email Deduplication
```javascript
class DeduplicationService {
  static isDuplicate(email) {
    const hash = this.generateEmailHash(email);
    const cache = CacheService.getScriptCache();
    
    if (cache.get(`processed_${hash}`)) {
      return true;
    }
    
    // Mark as processed for 1 hour
    cache.put(`processed_${hash}`, '1', 3600);
    return false;
  }
  
  static generateEmailHash(email) {
    const key = `${email.from}_${email.subject}_${email.date}`;
    return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, key)
      .map(byte => (byte & 0xFF).toString(16).padStart(2, '0'))
      .join('');
  }
}
```

## 🛡️ Security Fixes

### 13. Enhanced HTML Sanitization
```javascript
class HtmlSanitizer {
  static sanitize(html) {
    if (!html) return '';
    
    // Remove script tags and event handlers
    let safe = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '');
    
    // Whitelist allowed tags
    const allowedTags = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote'];
    const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    
    safe = safe.replace(tagRegex, (match, tag) => {
      return allowedTags.includes(tag.toLowerCase()) ? match : '';
    });
    
    return safe;
  }
}
```

### 14. Secure Configuration
```javascript
class SecureConfig {
  static getSecretKey(keyName) {
    const props = PropertiesService.getScriptProperties();
    const encrypted = props.getProperty(keyName);
    
    if (!encrypted) {
      throw new Error(`Secret key ${keyName} not found`);
    }
    
    // In production, implement proper decryption
    // For now, just return the value
    return encrypted;
  }
  
  static setSecretKey(keyName, value) {
    // In production, implement proper encryption
    const props = PropertiesService.getScriptProperties();
    props.setProperty(keyName, value);
  }
}
```

## 📊 Performance Optimizations

### 15. Batch Gmail Operations
```javascript
class BatchProcessor {
  static processThreadsInBatches(threads, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < threads.length; i += batchSize) {
      if (ExecutionTimer.shouldStop()) {
        console.log(`Stopping at thread ${i} due to time limit`);
        break;
      }
      
      const batch = threads.slice(i, i + batchSize);
      const batchResults = this.processBatch(batch);
      results.push(...batchResults);
      
      // Small delay to avoid rate limits
      Utilities.sleep(100);
    }
    
    return results;
  }
}
```

### 16. Smart Caching
```javascript
class SmartCache {
  static get(key, generator, ttl = 3600) {
    const cache = CacheService.getScriptCache();
    let value = cache.get(key);
    
    if (!value) {
      value = generator();
      if (value !== null && value !== undefined) {
        const serialized = JSON.stringify(value);
        // Check size before caching
        if (serialized.length < 100000) { // 100KB limit
          cache.put(key, serialized, ttl);
        }
      }
    } else {
      value = JSON.parse(value);
    }
    
    return value;
  }
}
```

## 🧪 Testing Utilities

### 17. Test Mode Flag
```javascript
class TestMode {
  static isEnabled() {
    return PropertiesService.getScriptProperties().getProperty('TEST_MODE') === 'true';
  }
  
  static enable() {
    PropertiesService.getScriptProperties().setProperty('TEST_MODE', 'true');
  }
  
  static disable() {
    PropertiesService.getScriptProperties().deleteProperty('TEST_MODE');
  }
}
```

## 📝 Implementation Checklist

- [ ] Implement all CRITICAL fixes
- [ ] Add comprehensive error logging
- [ ] Create unit tests for each fix
- [ ] Test with production-like data volume
- [ ] Add monitoring for key metrics
- [ ] Document all changes
- [ ] Update installation guide with new requirements
- [ ] Create rollback procedure

## 🚀 Deployment Strategy

1. **Phase 1**: Critical fixes (1-3)
2. **Phase 2**: High priority fixes (4-7)
3. **Phase 3**: Medium priority (8-10)
4. **Phase 4**: Low priority and optimizations
5. **Phase 5**: Security hardening
6. **Phase 6**: Performance tuning

Each phase should be tested thoroughly before moving to the next.