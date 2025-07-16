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
   * Generate unique ticket ID
   */
  generateTicketId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const counter = this.getAndIncrementCounter();
    
    return `${this.ticketPrefix}-${timestamp}-${random}-${counter}`;
  }

  /**
   * Get and increment counter
   */
  getAndIncrementCounter() {
    const props = PropertiesService.getScriptProperties();
    const counter = parseInt(props.getProperty('ticket_counter') || '1000');
    props.setProperty('ticket_counter', (counter + 1).toString());
    return counter;
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
   * Extract customer name
   */
  extractCustomerName(fromString) {
    const match = fromString.match(/^([^<]+)</);
    if (match) {
      return match[1].trim();
    }
    
    const emailMatch = fromString.match(/([^@]+)@/);
    return emailMatch ? emailMatch[1].replace(/[._]/g, ' ') : 'Customer';
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
   * Index ticket for search
   */
  indexTicket(ticket) {
    // Simple indexing - in production use proper search engine
    const indexKey = 'ticket_index';
    const props = PropertiesService.getScriptProperties();
    
    let index = JSON.parse(props.getProperty(indexKey) || '[]');
    
    // Add to index
    index.push({
      id: ticket.id,
      subject: ticket.subject,
      customer: ticket.customerEmail,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      createdAt: ticket.createdAt
    });
    
    // Keep last 1000 entries
    if (index.length > 1000) {
      index = index.slice(-1000);
    }
    
    props.setProperty(indexKey, JSON.stringify(index));
  }

  /**
   * Get all tickets
   */
  getAllTickets() {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    
    const tickets = [];
    
    Object.keys(allProps).forEach(key => {
      if (key.startsWith('ticket_') && !key.includes('_counter') && !key.includes('_index')) {
        try {
          tickets.push(JSON.parse(allProps[key]));
        } catch (error) {
          logError(`Failed to parse ticket ${key}`, { error: error.message });
        }
      }
    });
    
    return tickets;
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