/**
 * TicketService.gs - Complete Ticket Management System
 * 
 * Enterprise-grade ticket lifecycle management
 * Auto-assigns, tracks SLA, and manages customer journey
 */

class TicketService {
  constructor() {
    this.config = Config.get('support');
    this.cache = CacheService.getScriptCache();
    this.ticketPrefix = 'TKT';
    this.statusFlow = {
      'new': ['open', 'escalated'],
      'open': ['in_progress', 'waiting_customer', 'escalated', 'resolved'],
      'in_progress': ['waiting_customer', 'resolved', 'escalated'],
      'waiting_customer': ['in_progress', 'resolved', 'closed'],
      'escalated': ['in_progress', 'resolved'],
      'resolved': ['closed', 'reopened'],
      'closed': ['reopened'],
      'reopened': ['in_progress', 'escalated', 'resolved']
    };
  }

  /**
   * Create new ticket
   */
  createTicket(email, options = {}) {
    profile('ticket_create');
    
    try {
      const ticket = {
        id: this.generateTicketId(),
        threadId: email.threadId,
        messageId: email.id,
        customerEmail: email.from,
        subject: email.subject,
        description: email.body,
        status: 'new',
        priority: options.priority || 'medium',
        category: options.category || 'general',
        tags: options.tags || [],
        assignedTo: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: null,
        closedAt: null,
        reopenedCount: 0,
        
        // Customer info
        customer: {
          email: email.from,
          name: this.extractCustomerName(email.from),
          language: options.language || 'en',
          timezone: options.timezone || Session.getScriptTimeZone(),
          vip: this.isVIPCustomer(email.from)
        },
        
        // Metrics
        metrics: {
          responseTime: null,
          resolutionTime: null,
          customerInteractions: 1,
          agentInteractions: 0,
          escalationCount: 0,
          satisfactionScore: null
        },
        
        // SLA tracking
        sla: {
          responseTarget: this.calculateSLATarget('response', options.priority),
          resolutionTarget: this.calculateSLATarget('resolution', options.priority),
          breached: false,
          breachReason: null
        },
        
        // AI analysis
        analysis: options.analysis || {},
        
        // History
        history: [{
          timestamp: new Date().toISOString(),
          action: 'created',
          actor: 'system',
          details: 'Ticket created from email'
        }],
        
        // Custom fields
        customFields: options.customFields || {},
        
        // Internal
        _version: 1,
        _lastModifiedBy: 'system'
      };
      
      // Auto-assign if enabled
      if (this.config.autoAssign) {
        ticket.assignedTo = this.autoAssignAgent(ticket);
        if (ticket.assignedTo) {
          ticket.status = 'open';
          this.addHistory(ticket, 'assigned', 'system', `Auto-assigned to ${ticket.assignedTo}`);
        }
      }
      
      // Save ticket
      this.saveTicket(ticket);
      
      // Index for search
      this.indexTicket(ticket);
      
      // Create metrics entry
      this.initializeMetrics(ticket);
      
      profileEnd('ticket_create');
      
      logInfo('Ticket created', {
        ticketId: ticket.id,
        customer: ticket.customerEmail,
        priority: ticket.priority,
        category: ticket.category
      });
      
      // Trigger creation hooks
      this.triggerHooks('onCreate', ticket);
      
      return ticket;
      
    } catch (error) {
      profileEnd('ticket_create');
      throw handleError(error, { operation: 'createTicket' });
    }
  }

  /**
   * Update ticket
   */
  updateTicket(ticketId, updates, actor = 'system') {
    const ticket = this.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    
    const oldStatus = ticket.status;
    const changes = {};
    
    // Track changes
    Object.keys(updates).forEach(key => {
      if (ticket[key] !== updates[key]) {
        changes[key] = {
          from: ticket[key],
          to: updates[key]
        };
        ticket[key] = updates[key];
      }
    });
    
    // Update metadata
    ticket.updatedAt = new Date().toISOString();
    ticket._version++;
    ticket._lastModifiedBy = actor;
    
    // Handle status changes
    if (changes.status) {
      this.handleStatusChange(ticket, oldStatus, changes.status.to);
    }
    
    // Add history
    if (Object.keys(changes).length > 0) {
      this.addHistory(ticket, 'updated', actor, changes);
    }
    
    // Save
    this.saveTicket(ticket);
    
    // Update metrics
    this.updateMetrics(ticket, changes);
    
    // Trigger update hooks
    this.triggerHooks('onUpdate', ticket, changes);
    
    return ticket;
  }

  /**
   * Get ticket by ID
   */
  getTicket(ticketId) {
    // Try cache first
    const cached = this.cache.get(`ticket_${ticketId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Try properties
    const props = PropertiesService.getScriptProperties();
    const stored = props.getProperty(`ticket_${ticketId}`);
    
    if (stored) {
      const ticket = JSON.parse(stored);
      // Cache for performance
      this.cache.put(`ticket_${ticketId}`, stored, 300);
      return ticket;
    }
    
    return null;
  }

  /**
   * Search tickets
   */
  searchTickets(query, options = {}) {
    profile('ticket_search');
    
    try {
      const {
        status,
        priority,
        category,
        assignedTo,
        customerEmail,
        dateFrom,
        dateTo,
        limit = 50,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;
      
      // Get all tickets (in production, use proper database)
      const allTickets = this.getAllTickets();
      
      // Filter
      let filtered = allTickets;
      
      if (query) {
        const queryLower = query.toLowerCase();
        filtered = filtered.filter(ticket => 
          ticket.subject.toLowerCase().includes(queryLower) ||
          ticket.description.toLowerCase().includes(queryLower) ||
          ticket.id.toLowerCase().includes(queryLower) ||
          ticket.customerEmail.toLowerCase().includes(queryLower)
        );
      }
      
      if (status) {
        filtered = filtered.filter(t => t.status === status);
      }
      
      if (priority) {
        filtered = filtered.filter(t => t.priority === priority);
      }
      
      if (category) {
        filtered = filtered.filter(t => t.category === category);
      }
      
      if (assignedTo) {
        filtered = filtered.filter(t => t.assignedTo === assignedTo);
      }
      
      if (customerEmail) {
        filtered = filtered.filter(t => t.customerEmail === customerEmail);
      }
      
      if (dateFrom) {
        filtered = filtered.filter(t => new Date(t.createdAt) >= new Date(dateFrom));
      }
      
      if (dateTo) {
        filtered = filtered.filter(t => new Date(t.createdAt) <= new Date(dateTo));
      }
      
      // Sort
      filtered.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        const comparison = aVal > bVal ? 1 : -1;
        return sortOrder === 'desc' ? -comparison : comparison;
      });
      
      // Paginate
      const total = filtered.length;
      const results = filtered.slice(offset, offset + limit);
      
      profileEnd('ticket_search');
      
      return {
        tickets: results,
        total: total,
        offset: offset,
        limit: limit
      };
      
    } catch (error) {
      profileEnd('ticket_search');
      throw handleError(error, { operation: 'searchTickets' });
    }
  }

  /**
   * Generate unique ticket ID with atomic counter
   */
  generateTicketId() {
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
        const shardId = Math.floor(Math.random() * 10); // 10 shards
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

  /**
   * Get and increment counter - DEPRECATED
   */
  getAndIncrementCounter() {
    // Kept for backward compatibility
    return Math.floor(Math.random() * 100000);
  }

  /**
   * Save ticket
   */
  saveTicket(ticket) {
    const key = `ticket_${ticket.id}`;
    const data = JSON.stringify(ticket);
    
    // Save to properties
    const props = PropertiesService.getScriptProperties();
    props.setProperty(key, data);
    
    // Update cache
    this.cache.put(key, data, 300);
    
    // Update thread mapping
    this.mapThreadToTicket(ticket.threadId, ticket.id);
  }

  /**
   * Map thread to ticket
   */
  mapThreadToTicket(threadId, ticketId) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(`thread_${threadId}`, ticketId);
  }

  /**
   * Get ticket by thread ID
   */
  getTicketByThreadId(threadId) {
    const props = PropertiesService.getScriptProperties();
    const ticketId = props.getProperty(`thread_${threadId}`);
    
    if (ticketId) {
      return this.getTicket(ticketId);
    }
    
    return null;
  }

  /**
   * Handle status change
   */
  handleStatusChange(ticket, oldStatus, newStatus) {
    // Validate transition
    if (!this.isValidTransition(oldStatus, newStatus)) {
      throw new Error(`Invalid status transition: ${oldStatus} -> ${newStatus}`);
    }
    
    // Update timestamps
    switch (newStatus) {
      case 'resolved':
        ticket.resolvedAt = new Date().toISOString();
        ticket.metrics.resolutionTime = this.calculateElapsedTime(ticket.createdAt);
        break;
        
      case 'closed':
        ticket.closedAt = new Date().toISOString();
        break;
        
      case 'reopened':
        ticket.reopenedCount++;
        ticket.resolvedAt = null;
        ticket.closedAt = null;
        break;
    }
    
    // Check SLA
    this.checkSLA(ticket);
  }

  /**
   * Check if status transition is valid
   */
  isValidTransition(from, to) {
    return this.statusFlow[from]?.includes(to) || false;
  }

  /**
   * Calculate SLA target
   */
  calculateSLATarget(type, priority) {
    const slaConfig = Config.get('sla');
    if (!slaConfig.enabled) return null;
    
    const targets = type === 'response' 
      ? slaConfig.responseTargets 
      : slaConfig.resolutionTargets;
    
    const minutes = targets[priority] || targets.medium;
    return new Date(Date.now() + minutes * 60000).toISOString();
  }

  /**
   * Check SLA compliance
   */
  checkSLA(ticket) {
    if (!ticket.sla.responseTarget || !ticket.sla.resolutionTarget) return;
    
    const now = new Date();
    
    // Check response SLA
    if (!ticket.metrics.responseTime && now > new Date(ticket.sla.responseTarget)) {
      ticket.sla.breached = true;
      ticket.sla.breachReason = 'Response SLA breached';
      this.triggerHooks('onSLABreach', ticket, 'response');
    }
    
    // Check resolution SLA
    if (!ticket.resolvedAt && now > new Date(ticket.sla.resolutionTarget)) {
      ticket.sla.breached = true;
      ticket.sla.breachReason = 'Resolution SLA breached';
      this.triggerHooks('onSLABreach', ticket, 'resolution');
    }
  }

  /**
   * Auto-assign agent
   */
  autoAssignAgent(ticket) {
    // Simple round-robin assignment
    // In production, use more sophisticated algorithm
    const agents = this.getAvailableAgents();
    if (agents.length === 0) return null;
    
    const lastAssigned = this.cache.get('last_assigned_agent') || 0;
    const nextIndex = (parseInt(lastAssigned) + 1) % agents.length;
    
    this.cache.put('last_assigned_agent', nextIndex.toString(), 3600);
    
    return agents[nextIndex];
  }

  /**
   * Get available agents
   */
  getAvailableAgents() {
    // In production, check agent availability, workload, skills
    return Config.get('support.agents') || ['support@company.com'];
  }

  /**
   * Check if VIP customer
   */
  isVIPCustomer(email) {
    const vipList = Config.get('support.vipCustomers') || [];
    return vipList.includes(email);
  }

  /**
   * Extract customer name with robust parsing
   */
  extractCustomerName(fromString) {
    if (!fromString || typeof fromString !== 'string') {
      return 'Unknown Customer';
    }
    
    // Try to extract display name
    const match = fromString.match(/^([^<]+)</);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Try to extract from email
    const emailMatch = fromString.match(/([^@]+)@/);
    if (emailMatch && emailMatch[1]) {
      return emailMatch[1]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return 'Customer';
  }

  /**
   * Add history entry
   */
  addHistory(ticket, action, actor, details) {
    ticket.history.push({
      timestamp: new Date().toISOString(),
      action: action,
      actor: actor,
      details: details
    });
  }

  /**
   * Calculate elapsed time
   */
  calculateElapsedTime(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    return Math.round((now - start) / 60000); // minutes
  }

  /**
   * Initialize metrics
   */
  initializeMetrics(ticket) {
    const metricsKey = `metrics_${ticket.id}`;
    const metrics = {
      ticketId: ticket.id,
      createdAt: ticket.createdAt,
      events: [],
      interactions: {
        customer: 1,
        agent: 0,
        system: 1
      }
    };
    
    const props = PropertiesService.getScriptProperties();
    props.setProperty(metricsKey, JSON.stringify(metrics));
  }

  /**
   * Update metrics
   */
  updateMetrics(ticket, changes) {
    const metricsKey = `metrics_${ticket.id}`;
    const props = PropertiesService.getScriptProperties();
    
    const metrics = JSON.parse(props.getProperty(metricsKey) || '{}');
    
    metrics.events.push({
      timestamp: new Date().toISOString(),
      type: 'update',
      changes: changes
    });
    
    props.setProperty(metricsKey, JSON.stringify(metrics));
  }

  /**
   * Index ticket for search with sharding
   */
  indexTicket(ticket) {
    try {
      const props = PropertiesService.getScriptProperties();
      
      // Use date-based sharding to avoid loading entire index
      const shardKey = `ticket_index_${ticket.createdAt.substring(0, 10)}`; // Daily shards
      let shard = [];
      
      try {
        shard = JSON.parse(props.getProperty(shardKey) || '[]');
      } catch (e) {
        console.error('Failed to parse index shard:', e);
        shard = [];
      }
      
      // Add to shard
      shard.push({
        id: ticket.id,
        created: ticket.createdAt
      });
      
      // Keep only last 100 per shard
      if (shard.length > 100) {
        shard = shard.slice(-100);
      }
      
      props.setProperty(shardKey, JSON.stringify(shard));
      
      // Update index metadata
      this.updateIndexMetadata(shardKey);
    } catch (error) {
      console.error('Failed to index ticket:', error);
      // Don't fail ticket creation due to indexing error
    }
  }
  
  /**
   * Update index metadata
   */
  updateIndexMetadata(shardKey) {
    try {
      const props = PropertiesService.getScriptProperties();
      const metaKey = 'ticket_index_metadata';
      
      let metadata = {};
      try {
        metadata = JSON.parse(props.getProperty(metaKey) || '{}');
      } catch (e) {
        metadata = {};
      }
      
      metadata[shardKey] = {
        lastUpdated: new Date().toISOString(),
        count: JSON.parse(props.getProperty(shardKey) || '[]').length
      };
      
      // Clean old shards (older than 90 days)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      
      Object.keys(metadata).forEach(key => {
        const date = key.match(/\d{4}-\d{2}-\d{2}/);
        if (date && new Date(date[0]) < cutoff) {
          delete metadata[key];
          props.deleteProperty(key);
        }
      });
      
      props.setProperty(metaKey, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to update index metadata:', error);
    }
  }

  /**
   * Get all tickets with pagination
   */
  getAllTickets(page = 1, pageSize = 50) {
    const props = PropertiesService.getScriptProperties();
    
    // Get index metadata to find shards
    const metaKey = 'ticket_index_metadata';
    let metadata = {};
    
    try {
      metadata = JSON.parse(props.getProperty(metaKey) || '{}');
    } catch (e) {
      metadata = {};
    }
    
    // Get sorted shard list
    const shards = Object.keys(metadata)
      .filter(k => k.startsWith('ticket_index_'))
      .sort((a, b) => b.localeCompare(a)); // Newest first
    
    // Calculate pagination
    const tickets = [];
    let skipped = 0;
    const skip = (page - 1) * pageSize;
    
    // Get ticket keys (this is still a limitation but necessary)
    const allProps = props.getProperties();
    const ticketKeys = Object.keys(allProps)
      .filter(k => k.startsWith('ticket_') && !k.includes('_counter') && !k.includes('_index') && !k.includes('_shard'))
      .sort((a, b) => b.localeCompare(a)); // Newest first
    
    // Paginate
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pageKeys = ticketKeys.slice(startIdx, endIdx);
    
    // Load only needed tickets
    for (const key of pageKeys) {
      try {
        const ticketData = allProps[key];
        if (ticketData) {
          tickets.push(JSON.parse(ticketData));
        }
      } catch (error) {
        console.error(`Failed to parse ticket ${key}:`, error);
      }
    }
    
    return {
      tickets: tickets,
      page: page,
      pageSize: pageSize,
      totalCount: ticketKeys.length,
      totalPages: Math.ceil(ticketKeys.length / pageSize)
    };
  }

  /**
   * Get ticket statistics
   */
  getStatistics(options = {}) {
    const tickets = this.getAllTickets();
    const { dateFrom, dateTo } = options;
    
    let filtered = tickets;
    
    if (dateFrom) {
      filtered = filtered.filter(t => new Date(t.createdAt) >= new Date(dateFrom));
    }
    
    if (dateTo) {
      filtered = filtered.filter(t => new Date(t.createdAt) <= new Date(dateTo));
    }
    
    const stats = {
      total: filtered.length,
      byStatus: {},
      byPriority: {},
      byCategory: {},
      avgResolutionTime: 0,
      avgResponseTime: 0,
      slaCompliance: 0,
      customerSatisfaction: 0
    };
    
    let totalResolutionTime = 0;
    let resolvedCount = 0;
    let totalResponseTime = 0;
    let respondedCount = 0;
    let slaCompliant = 0;
    
    filtered.forEach(ticket => {
      // By status
      stats.byStatus[ticket.status] = (stats.byStatus[ticket.status] || 0) + 1;
      
      // By priority
      stats.byPriority[ticket.priority] = (stats.byPriority[ticket.priority] || 0) + 1;
      
      // By category
      stats.byCategory[ticket.category] = (stats.byCategory[ticket.category] || 0) + 1;
      
      // Resolution time
      if (ticket.metrics.resolutionTime) {
        totalResolutionTime += ticket.metrics.resolutionTime;
        resolvedCount++;
      }
      
      // Response time
      if (ticket.metrics.responseTime) {
        totalResponseTime += ticket.metrics.responseTime;
        respondedCount++;
      }
      
      // SLA compliance
      if (!ticket.sla.breached) {
        slaCompliant++;
      }
    });
    
    // Calculate averages
    stats.avgResolutionTime = resolvedCount > 0 ? Math.round(totalResolutionTime / resolvedCount) : 0;
    stats.avgResponseTime = respondedCount > 0 ? Math.round(totalResponseTime / respondedCount) : 0;
    stats.slaCompliance = filtered.length > 0 ? Math.round((slaCompliant / filtered.length) * 100) : 100;
    
    return stats;
  }

  /**
   * Trigger hooks
   */
  triggerHooks(event, ticket, ...args) {
    // Plugin system hook point
    const hooks = this.getHooks(event);
    
    hooks.forEach(hook => {
      try {
        hook(ticket, ...args);
      } catch (error) {
        logError(`Hook error in ${event}`, { error: error.message });
      }
    });
  }

  /**
   * Get hooks for event
   */
  getHooks(event) {
    // In production, load from plugin system
    return [];
  }

  /**
   * Merge tickets
   */
  mergeTickets(primaryId, duplicateIds) {
    const primary = this.getTicket(primaryId);
    if (!primary) {
      throw new Error(`Primary ticket ${primaryId} not found`);
    }
    
    duplicateIds.forEach(dupId => {
      const duplicate = this.getTicket(dupId);
      if (!duplicate) return;
      
      // Merge history
      primary.history.push(...duplicate.history);
      
      // Update metrics
      primary.metrics.customerInteractions += duplicate.metrics.customerInteractions;
      primary.metrics.agentInteractions += duplicate.metrics.agentInteractions;
      
      // Add merge note
      this.addHistory(primary, 'merged', 'system', `Merged with ticket ${dupId}`);
      
      // Close duplicate
      duplicate.status = 'closed';
      duplicate.closedAt = new Date().toISOString();
      this.addHistory(duplicate, 'merged', 'system', `Merged into ticket ${primaryId}`);
      
      this.saveTicket(duplicate);
    });
    
    // Save primary
    this.saveTicket(primary);
    
    return primary;
  }
}

// Create singleton instance
const Tickets = new TicketService();

// Convenience functions
function createTicket(email, options) {
  return Tickets.createTicket(email, options);
}

function updateTicket(ticketId, updates, actor) {
  return Tickets.updateTicket(ticketId, updates, actor);
}

function getTicket(ticketId) {
  return Tickets.getTicket(ticketId);
}

function getTicketByThreadId(threadId) {
  return Tickets.getTicketByThreadId(threadId);
}

function searchTickets(query, options) {
  return Tickets.searchTickets(query, options);
}

function getTicketStatistics(options) {
  return Tickets.getStatistics(options);
}

function mergeTickets(primaryId, duplicateIds) {
  return Tickets.mergeTickets(primaryId, duplicateIds);
}