/**
 * AutoReplyService.gs - Intelligent Response Generation
 * 
 * Generates smart auto-replies based on AI analysis and knowledge base
 * KISS implementation with genius-level results
 */

class AutoReplyService {
  constructor() {
    this.config = Config.get('autoReply');
    this.cache = CacheService.getScriptCache();
    this.templates = this.loadTemplates();
  }

  /**
   * Generate auto-reply for email
   */
  async generateAutoReply(email, ticket, analysis, knowledgeArticles = []) {
    profile('auto_reply_generate');
    
    try {
      // Check if auto-reply is disabled
      if (!this.config.enabled) {
        return null;
      }
      
      // Check reply limits
      if (!this.canReply(email, ticket)) {
        logInfo('Auto-reply skipped - limit reached', { 
          ticketId: ticket.id,
          replyCount: ticket.metrics.agentInteractions 
        });
        return null;
      }
      
      // Determine reply strategy
      const strategy = this.determineReplyStrategy(analysis, ticket);
      
      let reply;
      switch (strategy) {
        case 'ai_generated':
          reply = await this.generateAIReply(email, ticket, analysis, knowledgeArticles);
          break;
        case 'template_based':
          reply = this.generateTemplateReply(email, ticket, analysis);
          break;
        case 'knowledge_direct':
          reply = this.generateKnowledgeReply(email, ticket, knowledgeArticles);
          break;
        case 'escalation':
          reply = this.generateEscalationReply(email, ticket, analysis);
          break;
        default:
          reply = this.generateFallbackReply(email, ticket);
      }
      
      // Post-process reply
      reply = this.postProcessReply(reply, email, ticket);
      
      profileEnd('auto_reply_generate');
      
      logInfo('Auto-reply generated', {
        ticketId: ticket.id,
        strategy: strategy,
        confidence: reply.confidence
      });
      
      return reply;
      
    } catch (error) {
      profileEnd('auto_reply_generate');
      throw handleError(error, { operation: 'generateAutoReply' });
    }
  }

  /**
   * Check if we can send auto-reply
   */
  canReply(email, ticket) {
    // Check max replies per ticket
    const maxReplies = this.config.maxRepliesPerTicket || 3;
    if (ticket.metrics.agentInteractions >= maxReplies) {
      return false;
    }
    
    // Check business hours
    if (this.config.businessHoursOnly && !this.isBusinessHours()) {
      return false;
    }
    
    // Check sender blacklist
    if (this.isSenderBlacklisted(email.from)) {
      return false;
    }
    
    // Check recent reply frequency
    if (this.hasRecentReply(ticket)) {
      return false;
    }
    
    return true;
  }

  /**
   * Determine best reply strategy
   */
  determineReplyStrategy(analysis, ticket) {
    // High confidence AI analysis with knowledge articles
    if (analysis.confidence > 0.8 && analysis.knowledgeMatches?.length > 0) {
      return 'ai_generated';
    }
    
    // Direct knowledge base match
    if (analysis.knowledgeMatches?.length > 0 && analysis.knowledgeMatches[0].confidence > 0.9) {
      return 'knowledge_direct';
    }
    
    // Template for common categories
    if (this.hasTemplate(analysis.category)) {
      return 'template_based';
    }
    
    // Escalation needed
    if (analysis.escalationRequired || analysis.urgency === 'urgent') {
      return 'escalation';
    }
    
    // Low confidence - use AI with caution
    if (analysis.confidence > 0.5) {
      return 'ai_generated';
    }
    
    return 'fallback';
  }

  /**
   * Generate AI-powered reply
   */
  async generateAIReply(email, ticket, analysis, knowledgeArticles) {
    const context = {
      ticket: ticket,
      analysis: analysis,
      knowledgeArticles: knowledgeArticles,
      customerHistory: await this.getCustomerHistory(email.from),
      tone: this.determineTone(analysis),
      includeSignature: true
    };
    
    const aiResponse = await AI.generateReply(email, context);
    
    return {
      subject: this.generateSubject(email, ticket),
      body: aiResponse.reply,
      confidence: aiResponse.confidence,
      strategy: 'ai_generated',
      metadata: {
        aiModel: 'gemini',
        knowledgeUsed: knowledgeArticles.length,
        tone: context.tone
      }
    };
  }

  /**
   * Generate template-based reply
   */
  generateTemplateReply(email, ticket, analysis) {
    const template = this.getTemplate(analysis.category);
    
    const variables = {
      customerName: ticket.customer.name,
      ticketId: ticket.id,
      category: analysis.category,
      urgency: analysis.urgency,
      currentDate: new Date().toLocaleDateString(),
      supportEmail: this.config.supportEmail || Session.getActiveUser().getEmail()
    };
    
    const body = this.replaceVariables(template.body, variables);
    
    return {
      subject: this.generateSubject(email, ticket),
      body: body,
      confidence: 0.7,
      strategy: 'template_based',
      metadata: {
        template: template.id,
        category: analysis.category
      }
    };
  }

  /**
   * Generate knowledge base direct reply
   */
  generateKnowledgeReply(email, ticket, knowledgeArticles) {
    const bestMatch = knowledgeArticles[0];
    
    const greeting = this.getGreeting(ticket.customer.name);
    const solution = bestMatch.solution || bestMatch.content;
    const closing = this.getClosing();
    
    const body = `${greeting}

Thank you for contacting us regarding "${email.subject}".

${solution}

${this.getAdditionalHelp()}

${closing}`;

    return {
      subject: this.generateSubject(email, ticket),
      body: body,
      confidence: bestMatch.confidence,
      strategy: 'knowledge_direct',
      metadata: {
        knowledgeId: bestMatch.id,
        knowledgeTitle: bestMatch.title
      }
    };
  }

  /**
   * Generate escalation reply
   */
  generateEscalationReply(email, ticket, analysis) {
    const greeting = this.getGreeting(ticket.customer.name);
    
    const body = `${greeting}

Thank you for contacting us. I've received your message regarding "${email.subject}" and understand this requires immediate attention.

I've escalated your request to our specialized team who will review your case and respond within ${this.getEscalationSLA(analysis.urgency)}.

Your ticket reference is: ${ticket.id}

If you have any urgent questions in the meantime, please don't hesitate to contact us.

${this.getClosing()}`;

    return {
      subject: this.generateSubject(email, ticket),
      body: body,
      confidence: 0.8,
      strategy: 'escalation',
      metadata: {
        escalatedTo: 'specialized_team',
        sla: this.getEscalationSLA(analysis.urgency)
      }
    };
  }

  /**
   * Generate fallback reply
   */
  generateFallbackReply(email, ticket) {
    const greeting = this.getGreeting(ticket.customer.name);
    
    const body = `${greeting}

Thank you for contacting our support team. I've received your message regarding "${email.subject}".

I'm currently reviewing your request and will get back to you with a detailed response shortly.${this.config.helpCenterUrl ? ` In the meantime, you might find our help center useful: ${this.config.helpCenterUrl}` : ''}

Your ticket reference is: ${ticket.id}

${this.getClosing()}`;

    return {
      subject: this.generateSubject(email, ticket),
      body: body,
      confidence: 0.5,
      strategy: 'fallback',
      metadata: {
        reason: 'low_confidence'
      }
    };
  }

  /**
   * Post-process reply
   */
  postProcessReply(reply, email, ticket) {
    // Add ticket ID to subject if not present
    if (!reply.subject.includes(ticket.id)) {
      reply.subject = `${reply.subject} [${ticket.id}]`;
    }
    
    // Add signature if configured
    if (this.config.addSignature && !reply.body.includes(this.config.signature)) {
      reply.body += `\n\n${this.config.signature}`;
    }
    
    // Track for loop prevention
    reply.headers = {
      'X-Auto-Reply': 'true',
      'X-Ticket-ID': ticket.id,
      'X-Reply-Strategy': reply.strategy
    };
    
    return reply;
  }

  /**
   * Generate subject line
   */
  generateSubject(email, ticket) {
    const originalSubject = email.subject.replace(/^re:\s*/i, '');
    return `Re: ${originalSubject}`;
  }

  /**
   * Determine tone based on analysis
   */
  determineTone(analysis) {
    if (analysis.sentiment === 'negative' || analysis.urgency === 'urgent') {
      return 'empathetic';
    }
    
    if (analysis.category === 'billing') {
      return 'professional';
    }
    
    return 'friendly';
  }

  /**
   * Get customer history
   */
  async getCustomerHistory(email) {
    // Simple implementation - in production, query customer database
    const tickets = Tickets.searchTickets('', { customerEmail: email, limit: 5 });
    
    return {
      ticketCount: tickets.total,
      firstContact: tickets.tickets.length > 0 ? tickets.tickets[tickets.tickets.length - 1].createdAt : new Date().toISOString(),
      satisfaction: 4.0, // Default
      vip: Tickets.isVIPCustomer(email)
    };
  }

  /**
   * Load reply templates
   */
  loadTemplates() {
    return {
      technical: {
        id: 'technical_support',
        body: `Hi {{customerName}},

Thank you for reporting this technical issue. I understand how frustrating technical problems can be, and I'm here to help resolve this quickly.

I'm investigating the issue you described and will provide you with a solution or update within 24 hours.

In the meantime, you might want to try:
- Clearing your browser cache
- Checking your internet connection
- Trying a different browser

Best regards,
Technical Support Team`
      },
      
      billing: {
        id: 'billing_inquiry',
        body: `Hi {{customerName}},

Thank you for contacting us about your billing inquiry. I understand billing questions are important, and I want to make sure we resolve this promptly.

I'm reviewing your account details and will get back to you with specific information within 24 hours.

If you need immediate assistance, please don't hesitate to call our billing department at [phone number].

Best regards,
Billing Support Team`
      },
      
      account: {
        id: 'account_support',
        body: `Hi {{customerName}},

Thank you for reaching out about your account. I'm here to help you with any account-related questions or concerns.

I'm looking into your request and will respond with detailed information shortly.

Your account security and satisfaction are our top priorities.

Best regards,
Account Support Team`
      }
    };
  }

  /**
   * Check if template exists for category
   */
  hasTemplate(category) {
    return this.templates.hasOwnProperty(category);
  }

  /**
   * Get template for category
   */
  getTemplate(category) {
    return this.templates[category] || this.templates['general'];
  }

  /**
   * Replace variables in template
   */
  replaceVariables(text, variables) {
    let result = text;
    
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, variables[key]);
    });
    
    return result;
  }

  /**
   * Get greeting based on customer name
   */
  getGreeting(customerName) {
    if (customerName && customerName !== 'Customer') {
      return `Hi ${customerName},`;
    }
    
    return 'Hi there,';
  }

  /**
   * Get closing signature
   */
  getClosing() {
    return `Best regards,
${this.config.agentName || 'Support Team'}
${this.config.companyName || 'Customer Support'}`;
  }

  /**
   * Get additional help text
   */
  getAdditionalHelp() {
    return `If you need any further assistance or have additional questions, please don't hesitate to reply to this email.

You can also check our help center for more resources${this.config.helpCenterUrl ? `: ${this.config.helpCenterUrl}` : '.'}`;
  }

  /**
   * Get escalation SLA
   */
  getEscalationSLA(urgency) {
    const slas = {
      urgent: '2 hours',
      high: '4 hours',
      medium: '24 hours',
      low: '48 hours'
    };
    
    return slas[urgency] || '24 hours';
  }

  /**
   * Check if business hours
   */
  isBusinessHours() {
    const now = new Date();
    const config = Config.get('businessHours');
    
    if (!config) return true;
    
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    
    return config.days.includes(currentDay) && 
           currentHour >= config.start && 
           currentHour < config.end;
  }

  /**
   * Check if sender is blacklisted
   */
  isSenderBlacklisted(email) {
    return LoopPrevention.isBlacklisted(email);
  }

  /**
   * Check if there was a recent reply
   */
  hasRecentReply(ticket) {
    const recentMinutes = this.config.minReplyInterval || 60;
    const cutoff = new Date(Date.now() - recentMinutes * 60000);
    
    return ticket.history.some(entry => 
      entry.action === 'replied' && 
      new Date(entry.timestamp) > cutoff
    );
  }
}

// Create singleton instance
const AutoReply = new AutoReplyService();

// Convenience functions
function generateAutoReply(email, ticket, analysis, knowledgeArticles) {
  return AutoReply.generateAutoReply(email, ticket, analysis, knowledgeArticles);
}

function canSendAutoReply(email, ticket) {
  return AutoReply.canReply(email, ticket);
}