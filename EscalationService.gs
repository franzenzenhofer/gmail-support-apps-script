/**
 * EscalationService.gs - Smart Escalation Rules
 * 
 * Intelligent escalation based on multiple factors
 * Prevents issues from falling through cracks
 */

class EscalationService {
  constructor() {
    this.config = Config.get('escalation');
    this.rules = this.loadEscalationRules();
    this.cache = CacheService.getScriptCache();
  }

  /**
   * Check if ticket needs escalation
   */
  checkEscalation(ticket, analysis) {
    try {
      const escalationReasons = [];
      
      // Check all escalation rules
      this.rules.forEach(rule => {
        if (this.evaluateRule(rule, ticket, analysis)) {
          escalationReasons.push(rule.reason);
        }
      });
      
      if (escalationReasons.length > 0) {
        return {
          shouldEscalate: true,
          reasons: escalationReasons,
          priority: this.calculateEscalationPriority(escalationReasons),
          recommendedAgent: this.getRecommendedAgent(ticket, analysis),
          escalationType: this.getEscalationType(escalationReasons)
        };
      }
      
      return { shouldEscalate: false };
      
    } catch (error) {
      logError('Escalation check failed', { 
        ticketId: ticket.id, 
        error: error.message 
      });
      return { shouldEscalate: false };
    }
  }

  /**
   * Perform escalation
   */
  async escalateTicket(ticket, escalationInfo, actor = 'system') {
    try {
      // Update ticket status
      const updates = {
        status: 'escalated',
        priority: escalationInfo.priority || 'high',
        assignedTo: escalationInfo.recommendedAgent,
        escalationLevel: (ticket.escalationLevel || 0) + 1
      };
      
      // Add escalation history
      const escalationEntry = {
        timestamp: new Date().toISOString(),
        action: 'escalated',
        actor: actor,
        details: {
          reasons: escalationInfo.reasons,
          type: escalationInfo.escalationType,
          previousAgent: ticket.assignedTo,
          newAgent: escalationInfo.recommendedAgent
        }
      };
      
      ticket.history.push(escalationEntry);
      
      // Update metrics
      ticket.metrics.escalationCount++;
      
      // Update ticket
      const updatedTicket = Tickets.updateTicket(ticket.id, updates, actor);
      
      // Send notifications
      await this.sendEscalationNotifications(updatedTicket, escalationInfo);
      
      // Record escalation metric
      Metrics.recordMetric('escalation', {
        ticketId: ticket.id,
        reasons: escalationInfo.reasons,
        type: escalationInfo.escalationType,
        level: updatedTicket.escalationLevel
      });
      
      logInfo('Ticket escalated', {
        ticketId: ticket.id,
        reasons: escalationInfo.reasons,
        newAgent: escalationInfo.recommendedAgent
      });
      
      return updatedTicket;
      
    } catch (error) {
      throw handleError(error, { 
        operation: 'escalateTicket',
        ticketId: ticket.id 
      });
    }
  }

  /**
   * Load escalation rules
   */
  loadEscalationRules() {
    return [
      // Sentiment-based escalation
      {
        id: 'negative_sentiment',
        name: 'Negative Sentiment',
        condition: (ticket, analysis) => 
          analysis.sentiment === 'negative' && analysis.confidence > 0.7,
        reason: 'Customer expressing negative sentiment',
        priority: 'high'
      },
      
      // SLA breach escalation
      {
        id: 'sla_breach',
        name: 'SLA Breach',
        condition: (ticket, analysis) => ticket.sla.breached,
        reason: 'SLA target breached',
        priority: 'urgent'
      },
      
      // High urgency escalation
      {
        id: 'urgent_request',
        name: 'Urgent Request',
        condition: (ticket, analysis) => 
          analysis.urgency === 'urgent' || ticket.priority === 'urgent',
        reason: 'Urgent priority request',
        priority: 'urgent'
      },
      
      // VIP customer escalation
      {
        id: 'vip_customer',
        name: 'VIP Customer',
        condition: (ticket, analysis) => ticket.customer.vip,
        reason: 'VIP customer requires immediate attention',
        priority: 'high'
      },
      
      // Multiple reopens
      {
        id: 'multiple_reopens',
        name: 'Multiple Reopens',
        condition: (ticket, analysis) => ticket.reopenedCount >= 2,
        reason: 'Ticket reopened multiple times',
        priority: 'high'
      },
      
      // Long response time
      {
        id: 'delayed_response',
        name: 'Delayed Response',
        condition: (ticket, analysis) => {
          const hoursSinceCreation = (Date.now() - new Date(ticket.createdAt)) / (1000 * 60 * 60);
          return hoursSinceCreation > 24 && !ticket.metrics.responseTime;
        },
        reason: 'No response within 24 hours',
        priority: 'medium'
      },
      
      // Billing issues
      {
        id: 'billing_category',
        name: 'Billing Category',
        condition: (ticket, analysis) => 
          analysis.category === 'billing' && ticket.priority !== 'low',
        reason: 'Billing-related issue requiring specialized handling',
        priority: 'high'
      },
      
      // Security concerns
      {
        id: 'security_keywords',
        name: 'Security Keywords',
        condition: (ticket, analysis) => {
          const securityKeywords = ['hack', 'breach', 'unauthorized', 'security', 'fraud'];
          const content = `${ticket.subject} ${ticket.description}`.toLowerCase();
          return securityKeywords.some(keyword => content.includes(keyword));
        },
        reason: 'Potential security concern detected',
        priority: 'urgent'
      },
      
      // Complex technical issues
      {
        id: 'complex_technical',
        name: 'Complex Technical',
        condition: (ticket, analysis) => {
          const complexKeywords = ['api', 'integration', 'database', 'server', 'crash'];
          const content = `${ticket.subject} ${ticket.description}`.toLowerCase();
          return analysis.category === 'technical' && 
                 complexKeywords.some(keyword => content.includes(keyword));
        },
        reason: 'Complex technical issue requiring specialist',
        priority: 'medium'
      },
      
      // Low AI confidence
      {
        id: 'low_ai_confidence',
        name: 'Low AI Confidence',
        condition: (ticket, analysis) => 
          analysis.confidence < 0.3 && ticket.priority !== 'low',
        reason: 'Low confidence in automated analysis',
        priority: 'medium'
      }
    ];
  }

  /**
   * Evaluate escalation rule
   */
  evaluateRule(rule, ticket, analysis) {
    try {
      return rule.condition(ticket, analysis);
    } catch (error) {
      logError(`Rule evaluation failed: ${rule.id}`, { 
        error: error.message,
        ticketId: ticket.id 
      });
      return false;
    }
  }

  /**
   * Calculate escalation priority
   */
  calculateEscalationPriority(reasons) {
    const priorityWeights = {
      'urgent': 4,
      'high': 3,
      'medium': 2,
      'low': 1
    };
    
    let maxWeight = 0;
    let priority = 'medium';
    
    this.rules.forEach(rule => {
      if (reasons.includes(rule.reason)) {
        const weight = priorityWeights[rule.priority] || 2;
        if (weight > maxWeight) {
          maxWeight = weight;
          priority = rule.priority;
        }
      }
    });
    
    return priority;
  }

  /**
   * Get recommended agent for escalation
   */
  getRecommendedAgent(ticket, analysis) {
    const agents = this.getAvailableAgents();
    
    // Try to match by expertise
    const expertAgent = this.findExpertAgent(analysis.category, agents);
    if (expertAgent) return expertAgent;
    
    // Try to match by workload
    const leastBusyAgent = this.getLeastBusyAgent(agents);
    if (leastBusyAgent) return leastBusyAgent;
    
    // Fallback to manager
    return this.config.defaultEscalationAgent || 'manager@company.com';
  }

  /**
   * Get escalation type
   */
  getEscalationType(reasons) {
    if (reasons.some(r => r.includes('security') || r.includes('fraud'))) {
      return 'security';
    }
    
    if (reasons.some(r => r.includes('billing'))) {
      return 'billing';
    }
    
    if (reasons.some(r => r.includes('technical'))) {
      return 'technical';
    }
    
    if (reasons.some(r => r.includes('VIP') || r.includes('urgent'))) {
      return 'priority';
    }
    
    return 'general';
  }

  /**
   * Send escalation notifications
   */
  async sendEscalationNotifications(ticket, escalationInfo) {
    try {
      // Notify new assignee
      if (escalationInfo.recommendedAgent) {
        await this.notifyAgent(escalationInfo.recommendedAgent, ticket, escalationInfo);
      }
      
      // Notify manager
      if (this.config.notifyManager) {
        await this.notifyManager(ticket, escalationInfo);
      }
      
      // Send customer notification if configured
      if (this.config.notifyCustomer) {
        await this.notifyCustomer(ticket, escalationInfo);
      }
      
      // Send to external systems
      await this.sendExternalNotifications(ticket, escalationInfo);
      
    } catch (error) {
      logError('Escalation notification failed', { 
        ticketId: ticket.id,
        error: error.message 
      });
    }
  }

  /**
   * Notify assigned agent
   */
  async notifyAgent(agentEmail, ticket, escalationInfo) {
    const subject = `🚨 Escalated Ticket: ${ticket.subject} [${ticket.id}]`;
    
    const body = `A ticket has been escalated to you:

Ticket ID: ${ticket.id}
Customer: ${ticket.customer.name} (${ticket.customerEmail})
Subject: ${ticket.subject}
Priority: ${ticket.priority}
Category: ${ticket.category}

Escalation Reasons:
${escalationInfo.reasons.map(r => `• ${r}`).join('\n')}

Customer Message:
${ticket.description}

Action Required:
Please review and respond to this ticket promptly based on its priority level.

View ticket: ${this.getTicketUrl(ticket.id)}`;

    await Email.sendEmail(agentEmail, subject, body);
  }

  /**
   * Notify manager
   */
  async notifyManager(ticket, escalationInfo) {
    const managerEmail = this.config.managerEmail;
    if (!managerEmail) return;
    
    const subject = `📊 Escalation Alert: ${ticket.id}`;
    
    const body = `Ticket escalation summary:

Ticket: ${ticket.id}
Customer: ${ticket.customerEmail}
Escalation Level: ${ticket.escalationLevel}
Assigned To: ${escalationInfo.recommendedAgent}

Reasons: ${escalationInfo.reasons.join(', ')}

This escalation requires management awareness.`;

    await Email.sendEmail(managerEmail, subject, body);
  }

  /**
   * Notify customer
   */
  async notifyCustomer(ticket, escalationInfo) {
    const subject = `Re: ${ticket.subject} [${ticket.id}]`;
    
    const body = `Dear ${ticket.customer.name},

Thank you for your patience. Your request has been escalated to ensure you receive the best possible assistance.

A specialist will review your case and respond shortly. We appreciate your business and are committed to resolving your issue promptly.

Ticket Reference: ${ticket.id}

Best regards,
Customer Support Team`;

    await Email.sendEmail(ticket.customerEmail, subject, body);
  }

  /**
   * Send external notifications
   */
  async sendExternalNotifications(ticket, escalationInfo) {
    // Slack notification
    if (this.config.slackWebhook) {
      await this.sendSlackNotification(ticket, escalationInfo);
    }
    
    // Discord notification
    if (this.config.discordWebhook) {
      await this.sendDiscordNotification(ticket, escalationInfo);
    }
    
    // Custom webhook
    if (this.config.customWebhook) {
      await this.sendCustomWebhook(ticket, escalationInfo);
    }
  }

  /**
   * Helper methods
   */
  getAvailableAgents() {
    // In production, check agent availability, workload, schedules
    return this.config.agents || ['agent1@company.com', 'agent2@company.com'];
  }

  findExpertAgent(category, agents) {
    const expertise = this.config.agentExpertise || {};
    
    for (const agent of agents) {
      if (expertise[agent]?.includes(category)) {
        return agent;
      }
    }
    
    return null;
  }

  getLeastBusyAgent(agents) {
    // Simple implementation - in production, check actual workload
    const workloads = {};
    
    agents.forEach(agent => {
      const openTickets = Tickets.searchTickets('', { 
        assignedTo: agent, 
        status: 'open',
        limit: 100 
      });
      workloads[agent] = openTickets.total;
    });
    
    return Object.keys(workloads).reduce((a, b) => 
      workloads[a] < workloads[b] ? a : b
    );
  }

  getTicketUrl(ticketId) {
    const baseUrl = this.config.ticketBaseUrl;
    if (!baseUrl) {
      // Return internal dashboard URL if no external URL configured
      const webAppUrl = ScriptApp.getService().getUrl();
      return `${webAppUrl}?ticket=${ticketId}`;
    }
    return `${baseUrl}${ticketId}`;
  }

  async sendSlackNotification(ticket, escalationInfo) {
    const payload = {
      text: `🚨 Ticket Escalated: ${ticket.id}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Ticket:* ${ticket.id}\n*Customer:* ${ticket.customerEmail}\n*Reasons:* ${escalationInfo.reasons.join(', ')}`
          }
        }
      ]
    };
    
    await UrlFetchApp.fetch(this.config.slackWebhook, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
  }
}

// Create singleton instance
const Escalation = new EscalationService();

// Convenience functions
function checkEscalation(ticket, analysis) {
  return Escalation.checkEscalation(ticket, analysis);
}

function escalateTicket(ticket, escalationInfo, actor) {
  return Escalation.escalateTicket(ticket, escalationInfo, actor);
}