/**
 * LoopPreventionService.gs - Advanced Email Loop Detection
 * 
 * Prevents email loops with multiple detection strategies
 * KISS implementation with powerful results
 */

class LoopPreventionService {
  constructor() {
    this.config = Config.get('loopPrevention');
    this.cache = CacheService.getScriptCache();
    this.blacklistPatterns = this.config.blacklistPatterns || [
      'auto-reply',
      'automatic response',
      'out of office',
      'do not reply',
      'noreply@',
      'no-reply@',
      'mailer-daemon',
      'postmaster@'
    ];
  }

  /**
   * Check if email should be processed
   */
  shouldProcessEmail(email) {
    profile('loop_prevention_check');
    
    try {
      const checks = {
        isLoop: false,
        reasons: [],
        confidence: 0
      };
      
      // Run all checks
      this.checkBlacklistPatterns(email, checks);
      this.checkFrequency(email, checks);
      this.checkReplyChain(email, checks);
      this.checkContentSimilarity(email, checks);
      this.checkHeaders(email, checks);
      this.checkSenderHistory(email, checks);
      
      // Calculate overall confidence
      checks.confidence = checks.reasons.length / 6;
      checks.isLoop = checks.confidence >= 0.5;
      
      profileEnd('loop_prevention_check');
      
      if (checks.isLoop) {
        logWarn('Email loop detected', {
          email: email.id,
          reasons: checks.reasons,
          confidence: checks.confidence
        });
      }
      
      return !checks.isLoop;
      
    } catch (error) {
      profileEnd('loop_prevention_check');
      logError('Loop prevention check failed', { error: error.message });
      // Err on the side of caution
      return true;
    }
  }

  /**
   * Check blacklist patterns
   */
  checkBlacklistPatterns(email, checks) {
    const content = `${email.from} ${email.subject} ${email.body}`.toLowerCase();
    
    for (const pattern of this.blacklistPatterns) {
      if (content.includes(pattern.toLowerCase())) {
        checks.reasons.push(`Blacklist pattern: ${pattern}`);
        break;
      }
    }
    
    // Check sender whitelist
    const whitelistDomains = this.config.whitelistDomains || [];
    const senderDomain = email.from.split('@')[1];
    
    if (whitelistDomains.includes(senderDomain)) {
      // Remove blacklist reason if whitelisted
      checks.reasons = checks.reasons.filter(r => !r.startsWith('Blacklist'));
    }
  }

  /**
   * Check email frequency
   */
  checkFrequency(email, checks) {
    const key = `freq_${this.hashEmail(email)}`;
    const window = this.config.similarityWindow || 3600; // 1 hour
    
    const count = parseInt(this.cache.get(key) || '0');
    
    if (count >= (this.config.maxSimilarEmails || 3)) {
      checks.reasons.push(`High frequency: ${count} similar emails in ${window}s`);
    }
    
    // Update count
    this.cache.put(key, (count + 1).toString(), window);
  }

  /**
   * Check reply chain depth
   */
  checkReplyChain(email, checks) {
    const reCount = (email.subject.match(/re:/gi) || []).length;
    const fwdCount = (email.subject.match(/fwd:/gi) || []).length;
    
    if (reCount > 5) {
      checks.reasons.push(`Deep reply chain: ${reCount} RE:`);
    }
    
    if (fwdCount > 3) {
      checks.reasons.push(`Multiple forwards: ${fwdCount} FWD:`);
    }
    
    // Check for ping-pong pattern
    if (email.messageCount > 10 && this.checkPingPongPattern(email)) {
      checks.reasons.push('Ping-pong conversation pattern detected');
    }
  }

  /**
   * Check content similarity
   */
  checkContentSimilarity(email, checks) {
    const contentHash = this.hashContent(email.body);
    const key = `content_${email.from}_${contentHash}`;
    
    const seen = this.cache.get(key);
    if (seen) {
      checks.reasons.push('Duplicate content detected');
    } else {
      this.cache.put(key, '1', 3600); // 1 hour
    }
    
    // Check for repetitive patterns
    if (this.hasRepetitiveContent(email.body)) {
      checks.reasons.push('Repetitive content pattern');
    }
  }

  /**
   * Check email headers
   */
  checkHeaders(email, checks) {
    const headers = email.headers || {};
    
    // Check for auto-responder headers
    const autoHeaders = [
      'X-Autoresponder',
      'X-Autoreply',
      'Auto-Submitted',
      'X-Auto-Response-Suppress'
    ];
    
    for (const header of autoHeaders) {
      if (headers[header]) {
        checks.reasons.push(`Auto-responder header: ${header}`);
        break;
      }
    }
    
    // Check precedence
    if (headers['Precedence'] === 'bulk' || headers['Precedence'] === 'junk') {
      checks.reasons.push('Bulk email precedence');
    }
    
    // Check for loop detection headers
    if (headers['X-Loop'] || headers['X-Mail-Loop']) {
      checks.reasons.push('Loop detection header present');
    }
  }

  /**
   * Check sender history
   */
  checkSenderHistory(email, checks) {
    const historyKey = `sender_history_${email.from}`;
    const history = JSON.parse(this.cache.get(historyKey) || '{}');
    
    const now = Date.now();
    const hourAgo = now - 3600000;
    
    // Clean old entries
    Object.keys(history).forEach(time => {
      if (parseInt(time) < hourAgo) {
        delete history[time];
      }
    });
    
    // Count recent emails
    const recentCount = Object.keys(history).length;
    
    if (recentCount > 10) {
      checks.reasons.push(`High sender activity: ${recentCount} emails/hour`);
    }
    
    // Add current email
    history[now] = true;
    this.cache.put(historyKey, JSON.stringify(history), 3600);
  }

  /**
   * Check for ping-pong pattern
   */
  checkPingPongPattern(email) {
    // Simple heuristic: rapid back-and-forth
    const thread = Email.getThreadById(email.threadId);
    if (!thread || !thread.messages) return false;
    
    const messages = thread.messages;
    const senders = messages.map(m => m.from);
    
    // Check for alternating pattern
    let alternating = 0;
    for (let i = 1; i < senders.length; i++) {
      if (senders[i] !== senders[i-1]) {
        alternating++;
      }
    }
    
    return alternating > 8; // More than 8 alternations
  }

  /**
   * Check for repetitive content
   */
  hasRepetitiveContent(body) {
    if (!body || body.length < 50) return false;
    
    // Split into lines
    const lines = body.split('\n').filter(l => l.trim().length > 10);
    if (lines.length < 5) return false;
    
    // Count duplicate lines
    const lineCount = {};
    lines.forEach(line => {
      const normalized = line.trim().toLowerCase();
      lineCount[normalized] = (lineCount[normalized] || 0) + 1;
    });
    
    // Check for high repetition
    const maxRepetition = Math.max(...Object.values(lineCount));
    return maxRepetition > 3;
  }

  /**
   * Hash email for deduplication
   */
  hashEmail(email) {
    const content = `${email.from}|${email.subject}|${email.body.substring(0, 100)}`;
    return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, content)
      .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
      .join('')
      .substring(0, 16);
  }

  /**
   * Hash content for similarity
   */
  hashContent(content) {
    const normalized = content.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
    
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalized)
      .map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2))
      .join('')
      .substring(0, 16);
  }

  /**
   * Record loop detection
   */
  recordLoopDetection(email, reason) {
    const stats = this.getLoopStats();
    
    stats.total++;
    stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;
    stats.bySender[email.from] = (stats.bySender[email.from] || 0) + 1;
    
    const props = PropertiesService.getScriptProperties();
    props.setProperty('loop_prevention_stats', JSON.stringify(stats));
    
    logAudit('Email loop blocked', {
      email: email.id,
      from: email.from,
      reason: reason
    });
  }

  /**
   * Get loop prevention statistics
   */
  getLoopStats() {
    const props = PropertiesService.getScriptProperties();
    const stats = props.getProperty('loop_prevention_stats');
    
    return stats ? JSON.parse(stats) : {
      total: 0,
      byReason: {},
      bySender: {},
      lastReset: new Date().toISOString()
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('loop_prevention_stats');
    
    return {
      total: 0,
      byReason: {},
      bySender: {},
      lastReset: new Date().toISOString()
    };
  }

  /**
   * Add sender to blacklist
   */
  blacklistSender(email) {
    const blacklistKey = 'sender_blacklist';
    const props = PropertiesService.getScriptProperties();
    
    const blacklist = JSON.parse(props.getProperty(blacklistKey) || '[]');
    
    if (!blacklist.includes(email)) {
      blacklist.push(email);
      props.setProperty(blacklistKey, JSON.stringify(blacklist));
      
      logInfo(`Sender blacklisted: ${email}`);
    }
  }

  /**
   * Check if sender is blacklisted
   */
  isBlacklisted(email) {
    const blacklistKey = 'sender_blacklist';
    const props = PropertiesService.getScriptProperties();
    
    const blacklist = JSON.parse(props.getProperty(blacklistKey) || '[]');
    return blacklist.includes(email);
  }

  /**
   * Get blacklist
   */
  getBlacklist() {
    const props = PropertiesService.getScriptProperties();
    return JSON.parse(props.getProperty('sender_blacklist') || '[]');
  }

  /**
   * Remove from blacklist
   */
  removeFromBlacklist(email) {
    const blacklistKey = 'sender_blacklist';
    const props = PropertiesService.getScriptProperties();
    
    let blacklist = JSON.parse(props.getProperty(blacklistKey) || '[]');
    blacklist = blacklist.filter(e => e !== email);
    
    props.setProperty(blacklistKey, JSON.stringify(blacklist));
    
    logInfo(`Sender removed from blacklist: ${email}`);
  }
}

// Create singleton instance
const LoopPrevention = new LoopPreventionService();

// Convenience functions
function shouldProcessEmail(email) {
  return LoopPrevention.shouldProcessEmail(email);
}

function getLoopStats() {
  return LoopPrevention.getLoopStats();
}

function blacklistSender(email) {
  return LoopPrevention.blacklistSender(email);
}

function getBlacklist() {
  return LoopPrevention.getBlacklist();
}

function removeFromBlacklist(email) {
  return LoopPrevention.removeFromBlacklist(email);
}