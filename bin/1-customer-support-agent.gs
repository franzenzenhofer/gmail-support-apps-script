/**
 * Customer Support Agent Dashboard
 * 
 * Use Case: Front-line support agents handling customer inquiries
 * Features: Quick reply templates, customer history, ticket management
 */

// Configuration for Support Agents
const AGENT_CONFIG = {
  maxTicketsPerAgent: 50,
  autoAssignEnabled: true,
  quickReplies: true,
  showCustomerHistory: true,
  escalationThreshold: 2, // hours
  languages: ['en', 'es', 'fr', 'de']
};

/**
 * Main function for support agents
 */
function supportAgentDashboard() {
  // Get assigned tickets
  const myTickets = getMyAssignedTickets();
  
  // Get tickets needing attention
  const urgentTickets = myTickets.filter(ticket => 
    ticket.priority === 'urgent' || 
    isApproachingSLA(ticket)
  );
  
  console.log(`You have ${myTickets.length} tickets assigned`);
  console.log(`${urgentTickets.length} need immediate attention`);
  
  // Process each urgent ticket
  urgentTickets.forEach(ticket => {
    handleUrgentTicket(ticket);
  });
}

/**
 * Get tickets assigned to current agent
 */
function getMyAssignedTickets() {
  const myEmail = Session.getActiveUser().getEmail();
  
  return Tickets.searchTickets('', {
    assignedTo: myEmail,
    status: 'open',
    limit: AGENT_CONFIG.maxTicketsPerAgent
  }).tickets;
}

/**
 * Handle urgent ticket with smart suggestions
 */
function handleUrgentTicket(ticket) {
  console.log(`\n🚨 Urgent Ticket: ${ticket.id}`);
  console.log(`Customer: ${ticket.customerEmail}`);
  console.log(`Subject: ${ticket.subject}`);
  
  // Get customer history
  if (AGENT_CONFIG.showCustomerHistory) {
    const history = getCustomerHistory(ticket.customerEmail);
    console.log(`Previous tickets: ${history.length}`);
    console.log(`Customer since: ${history.firstContact}`);
  }
  
  // Get AI suggestions
  const analysis = AI.analyzeEmail({
    from: ticket.customerEmail,
    subject: ticket.subject,
    body: ticket.description,
    date: ticket.createdAt,
    messageCount: ticket.metrics.customerInteractions
  });
  
  console.log(`\nAI Analysis:`);
  console.log(`- Sentiment: ${analysis.sentiment}`);
  console.log(`- Category: ${analysis.category}`);
  console.log(`- Suggested approach: ${analysis.suggestedResponse}`);
  
  // Search knowledge base
  const kbArticles = searchKnowledgeBase(ticket.subject + ' ' + ticket.description, {
    limit: 3,
    category: analysis.category
  });
  
  if (kbArticles.length > 0) {
    console.log(`\n📚 Relevant KB Articles:`);
    kbArticles.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title} (${Math.round(article.confidence * 100)}% match)`);
    });
  }
  
  // Generate reply suggestions
  if (AGENT_CONFIG.quickReplies) {
    generateQuickReplies(ticket, analysis, kbArticles);
  }
}

/**
 * Generate quick reply options
 */
function generateQuickReplies(ticket, analysis, kbArticles) {
  console.log(`\n💬 Quick Reply Options:`);
  
  // Template-based replies
  const templates = getReplyTemplates(analysis.category);
  templates.forEach((template, index) => {
    console.log(`${index + 1}. ${template.name}`);
  });
  
  // AI-generated reply
  const aiReply = AI.generateReply({
    from: ticket.customerEmail,
    subject: ticket.subject,
    body: ticket.description
  }, {
    knowledgeArticles: kbArticles,
    tone: analysis.sentiment === 'negative' ? 'empathetic' : 'friendly'
  });
  
  console.log(`\n🤖 AI Suggested Reply:`);
  console.log(aiReply.reply.substring(0, 200) + '...');
}

/**
 * Get customer history
 */
function getCustomerHistory(email) {
  const tickets = Tickets.searchTickets('', {
    customerEmail: email,
    limit: 10
  }).tickets;
  
  return {
    length: tickets.length,
    firstContact: tickets.length > 0 ? tickets[tickets.length - 1].createdAt : 'New customer',
    categories: [...new Set(tickets.map(t => t.category))],
    avgResolutionTime: calculateAvgResolutionTime(tickets)
  };
}

/**
 * Check if ticket is approaching SLA
 */
function isApproachingSLA(ticket) {
  if (!ticket.sla.responseTarget) return false;
  
  const now = new Date();
  const target = new Date(ticket.sla.responseTarget);
  const hoursUntilBreach = (target - now) / (1000 * 60 * 60);
  
  return hoursUntilBreach < AGENT_CONFIG.escalationThreshold;
}

/**
 * Get reply templates for category
 */
function getReplyTemplates(category) {
  const templates = {
    technical: [
      { name: 'Request more details', content: 'I need more information about...' },
      { name: 'Troubleshooting steps', content: 'Please try these steps...' },
      { name: 'Known issue acknowledgment', content: 'We\'re aware of this issue...' }
    ],
    billing: [
      { name: 'Payment confirmation', content: 'I can confirm your payment...' },
      { name: 'Refund process', content: 'I\'ll process your refund...' },
      { name: 'Invoice request', content: 'I\'ll send your invoice...' }
    ],
    general: [
      { name: 'Acknowledgment', content: 'Thank you for contacting us...' },
      { name: 'Need more info', content: 'To better assist you...' },
      { name: 'Resolution confirmation', content: 'I\'m happy to help...' }
    ]
  };
  
  return templates[category] || templates.general;
}

/**
 * Calculate average resolution time
 */
function calculateAvgResolutionTime(tickets) {
  const resolved = tickets.filter(t => t.metrics.resolutionTime);
  if (resolved.length === 0) return 0;
  
  const total = resolved.reduce((sum, t) => sum + t.metrics.resolutionTime, 0);
  return Math.round(total / resolved.length / 60); // Convert to hours
}

/**
 * Quick actions for agents
 */
function agentQuickActions() {
  return {
    // Claim next available ticket
    claimNextTicket: function() {
      const unassigned = Tickets.searchTickets('', {
        assignedTo: null,
        status: 'new',
        limit: 1
      }).tickets;
      
      if (unassigned.length > 0) {
        const ticket = unassigned[0];
        Tickets.updateTicket(ticket.id, {
          assignedTo: Session.getActiveUser().getEmail(),
          status: 'open'
        });
        console.log(`Claimed ticket ${ticket.id}`);
        return ticket;
      }
      
      console.log('No unassigned tickets available');
      return null;
    },
    
    // Get my stats
    getMyStats: function() {
      const myEmail = Session.getActiveUser().getEmail();
      const myTickets = Tickets.searchTickets('', {
        assignedTo: myEmail,
        limit: 100
      }).tickets;
      
      return {
        totalTickets: myTickets.length,
        openTickets: myTickets.filter(t => t.status === 'open').length,
        resolvedToday: myTickets.filter(t => 
          t.resolvedAt && 
          new Date(t.resolvedAt).toDateString() === new Date().toDateString()
        ).length,
        avgResponseTime: calculateAvgResponseTime(myTickets),
        customerSatisfaction: calculateSatisfactionScore(myTickets)
      };
    },
    
    // Send quick reply
    sendQuickReply: function(ticketId, templateName) {
      const ticket = Tickets.getTicket(ticketId);
      if (!ticket) return;
      
      const templates = getReplyTemplates(ticket.category);
      const template = templates.find(t => t.name === templateName);
      
      if (template) {
        Email.sendReply(ticket.threadId, template.content);
        Tickets.updateTicket(ticketId, {
          status: 'waiting_customer',
          lastReplyAt: new Date().toISOString()
        });
        console.log(`Quick reply sent for ticket ${ticketId}`);
      }
    }
  };
}

// Run the dashboard
function runSupportAgentDashboard() {
  console.log('🎧 Customer Support Agent Dashboard');
  console.log('===================================\n');
  
  supportAgentDashboard();
  
  // Show available quick actions
  console.log('\n⚡ Quick Actions Available:');
  console.log('- agentQuickActions().claimNextTicket()');
  console.log('- agentQuickActions().getMyStats()');
  console.log('- agentQuickActions().sendQuickReply(ticketId, templateName)');
}