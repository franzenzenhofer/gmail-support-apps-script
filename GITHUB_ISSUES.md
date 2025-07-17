# GitHub Issues to Create

Copy and paste these issues into GitHub Issues for tracking:

---

## Issue #1: [CRITICAL] API Key Validation Missing
**Labels**: bug, critical, security

### Description
The system doesn't validate if the default API key placeholder has been replaced with a real key, causing cryptic errors.

### Current Behavior
- System tries to use `'YOUR_GEMINI_API_KEY_HERE'` as actual API key
- Results in authentication failures

### Expected Behavior
- Clear error message when API key is not configured
- Validation on startup

### Fix
See `CriticalBugFixes.gs` - `ConfigServiceFixes.validateApiKey()`

---

## Issue #2: [CRITICAL] Properties Storage Can Exceed Limits
**Labels**: bug, critical, data-loss

### Description
Google Apps Script Properties have a 500KB per value limit and 9MB total limit. No validation exists.

### Impact
- Data loss when limits exceeded
- Script failures

### Fix
See `CriticalBugFixes.gs` - `StorageValidator` class

---

## Issue #3: [HIGH] Race Condition in Ticket ID Generation
**Labels**: bug, high, concurrency

### Description
Multiple concurrent executions can generate duplicate ticket IDs.

### Fix
Implement atomic counter with LockService - see `AtomicTicketCounter`

---

## Issue #4: [HIGH] No Error Recovery in Email Processing
**Labels**: bug, high, reliability

### Description
One failed email stops processing of all remaining emails in batch.

### Current Behavior
- Exception in one thread stops entire batch
- Remaining emails not processed

### Expected Behavior
- Continue processing other emails
- Track and report failures

### Fix
See `processNewSupportEmailsWithRecovery()`

---

## Issue #5: [HIGH] Async/Await Used in Synchronous Environment
**Labels**: bug, high

### Description
Several files use async/await syntax which Apps Script doesn't support.

### Files Affected
- AIService.gs
- ErrorService.gs

### Fix
Remove all async/await keywords and use synchronous code

---

## Issue #6: [MEDIUM] Gmail Operations Missing Null Checks
**Labels**: bug, medium

### Description
`getThreadById()` and `getMessageById()` can return null but code doesn't check.

### Fix
See `SafeGmailOperations` class for safe wrappers

---

## Issue #7: [MEDIUM] Execution Time Limit Not Managed
**Labels**: bug, medium, performance

### Description
Scripts timeout after 6 minutes but no handling for this limit.

### Fix
Implement `ExecutionTimer` to track and respect time limits

---

## Issue #8: [MEDIUM] Large Email Bodies Can Break Storage
**Labels**: bug, medium

### Description
Very large email bodies can exceed storage limits and cause failures.

### Fix
Implement `EmailTruncator` to limit body size

---

## Issue #9: [LOW] Inefficient Cache Key Generation
**Labels**: enhancement, performance

### Description
MD5 hashes for cache keys can collide and are inefficient.

### Improvement
Include more context in cache keys

---

## Issue #10: [SECURITY] HTML Injection Possible in Email Replies
**Labels**: security, medium

### Description
Basic HTML escaping might miss edge cases allowing XSS.

### Fix
Implement comprehensive HTML sanitization

---

## Issue #11: [ENHANCEMENT] Add Execution Monitoring
**Labels**: enhancement, monitoring

### Description
Add comprehensive monitoring for:
- Execution times
- Error rates
- Storage usage
- API quotas

---

## Issue #12: [ENHANCEMENT] Implement Data Archival
**Labels**: enhancement, scalability

### Description
Old tickets should be archived to prevent storage limits.

### Proposal
- Archive tickets older than 90 days
- Move to Google Sheets for long-term storage

---

## Issue #13: [ENHANCEMENT] Add Integration Tests
**Labels**: testing, enhancement

### Description
Need integration tests for Gmail API operations.

### Tests Needed
- Email processing flow
- Error handling
- Concurrent execution
- Storage limits

---

## Issue #14: [DOCUMENTATION] Add Troubleshooting Guide
**Labels**: documentation

### Description
Create comprehensive troubleshooting guide for common issues:
- API key problems
- Permission errors
- Quota limits
- Performance issues

---

## Issue #15: [FEATURE] Add Admin Dashboard
**Labels**: enhancement, feature

### Description
Create admin dashboard showing:
- System health
- Error rates
- Storage usage
- Performance metrics
- Recent errors