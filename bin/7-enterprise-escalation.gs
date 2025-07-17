/**
 * Enterprise Escalation Manager
 * 
 * Use Case: Handle VIP customers, critical issues, executive escalations
 * Features: Priority routing, SLA enforcement, executive dashboards
 */

// Enterprise Configuration
const ENTERPRISE_CONFIG = {
  vipDomains: [
    'fortune500.com',
    'enterprise.com',
    'vip-customer.com'
  ],
  
  escalationLevels: {
    L1: { threshold: 2, assignTo: 'senior-support@company.com' },
    L2: { threshold: 4, assignTo: 'team-lead@company.com' },
    L3: { threshold: 8, assignTo: 'support-manager@company.com' },
    L4: { threshold: 24, assignTo: 'vp-support@company.com' },
    EXEC: { threshold: 48, assignTo: 'ceo@company.com' }
  },
  
  criticalKeywords: [
    'production down',
    'system failure',
    'data loss',
    'security breach',
    'urgent',
    'critical',
    'emergency',
    'CEO',
    'legal',
    'lawsuit'
  ],
  
  vipSLA: {
    responseTime: 15, // minutes
    resolutionTime: 240, // minutes (4 hours)
    updateFrequency: 60 // minutes
  }
};

/**
 * Enterprise escalation processor
 */
function enterpriseEscalationProcessor() {
  console.log('🏢 Enterprise Escalation Manager');
  console.log('================================\n');
  
  // Check for VIP and critical tickets
  const criticalTickets = identifyCriticalTickets();
  console.log(`Found ${criticalTickets.length} critical tickets\n`);
  
  // Process each critical ticket
  criticalTickets.forEach(ticket => {
    handleCriticalTicket(ticket);
  });
  
  // Monitor existing escalations
  monitorActiveEscalations();
  
  // Generate executive dashboard
  generateExecutiveDashboard();
  
  // Check SLA compliance
  enforceEnterpriseSLA();
}

/**
 * Identify critical tickets
 */
function identifyCriticalTickets() {
  const allTickets = Tickets.searchTickets('', {
    status: ['new', 'open', 'escalated'],
    limit: 100
  }).tickets;
  
  const critical = [];
  
  allTickets.forEach(ticket => {
    const criticality = calculateCriticality(ticket);
    
    if (criticality.score >= 70) {
      critical.push({
        ...ticket,
        criticality: criticality
      });
    }
  });
  
  // Sort by criticality score
  return critical.sort((a, b) => b.criticality.score - a.criticality.score);
}

/**
 * Calculate ticket criticality
 */
function calculateCriticality(ticket) {
  let score = 0;
  const factors = [];
  
  // VIP customer check
  const domain = ticket.customerEmail.split('@')[1];
  if (ENTERPRISE_CONFIG.vipDomains.includes(domain)) {
    score += 40;
    factors.push('VIP Customer');
  }
  
  // Check for enterprise email domain
  if (!['gmail.com', 'yahoo.com', 'hotmail.com'].includes(domain)) {
    score += 10;
    factors.push('Enterprise Domain');
  }
  
  // Critical keywords in content
  const content = `${ticket.subject} ${ticket.description}`.toLowerCase();
  ENTERPRISE_CONFIG.criticalKeywords.forEach(keyword => {
    if (content.includes(keyword)) {
      score += 20;
      factors.push(`Keyword: ${keyword}`);
    }
  });
  
  // Time-based escalation
  const age = (Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60); // hours
  if (age > 4) {
    score += Math.min(age * 5, 30);
    factors.push(`Aged: ${Math.round(age)} hours`);
  }
  
  // Previous escalations
  if (ticket.history) {
    const escalations = ticket.history.filter(h => h.action === 'escalated').length;
    score += escalations * 15;
    if (escalations > 0) factors.push(`Previous escalations: ${escalations}`);
  }
  
  // Customer sentiment
  if (ticket.analysis?.sentiment === 'negative') {
    score += 15;
    factors.push('Negative sentiment');
  }
  
  // Multiple replies without resolution
  if (ticket.metrics?.customerInteractions > 3) {
    score += 20;
    factors.push('Multiple interactions');
  }
  
  return {
    score: Math.min(score, 100),
    factors: factors,
    isVIP: ENTERPRISE_CONFIG.vipDomains.includes(domain),
    age: age
  };
}

/**
 * Handle critical ticket
 */
function handleCriticalTicket(ticket) {
  console.log(`\n🚨 Critical Ticket: ${ticket.id}`);
  console.log(`Customer: ${ticket.customerEmail}`);
  console.log(`Subject: ${ticket.subject}`);
  console.log(`Criticality Score: ${ticket.criticality.score}/100`);
  console.log(`Factors: ${ticket.criticality.factors.join(', ')}`);
  
  // Determine escalation level
  const escalationLevel = determineEscalationLevel(ticket);
  console.log(`Escalation Level: ${escalationLevel}`);
  
  // Create war room if needed
  if (ticket.criticality.score >= 90) {
    createWarRoom(ticket);
  }
  
  // Assign to appropriate team
  assignToEscalationTeam(ticket, escalationLevel);
  
  // Send immediate acknowledgment
  sendEnterpriseAcknowledgment(ticket);
  
  // Set up monitoring
  setupTicketMonitoring(ticket);
  
  // Notify stakeholders
  notifyStakeholders(ticket, escalationLevel);
}

/**
 * Determine escalation level
 */
function determineEscalationLevel(ticket) {
  const age = ticket.criticality.age;
  
  for (const [level, config] of Object.entries(ENTERPRISE_CONFIG.escalationLevels)) {
    if (age <= config.threshold) {
      return level;
    }
  }
  
  return 'EXEC';
}

/**
 * Create war room for critical issues
 */
function createWarRoom(ticket) {
  console.log('   🏃 Creating War Room...');
  
  const warRoom = {
    id: `WAR-${Date.now()}`,
    ticketId: ticket.id,
    created: new Date().toISOString(),
    participants: [],
    status: 'active',
    updates: []
  };
  
  // Add key participants
  warRoom.participants = [
    ENTERPRISE_CONFIG.escalationLevels.L2.assignTo,
    ENTERPRISE_CONFIG.escalationLevels.L3.assignTo,
    'engineering-lead@company.com',
    'product-manager@company.com'
  ];
  
  // Create communication channel
  const channelUrl = createSlackChannel(warRoom);
  warRoom.channelUrl = channelUrl;
  
  // Store war room data
  const props = PropertiesService.getScriptProperties();
  props.setProperty(`warroom_${warRoom.id}`, JSON.stringify(warRoom));
  
  console.log(`   ✅ War Room created: ${warRoom.id}`);
  
  return warRoom;
}

/**
 * Assign to escalation team
 */
function assignToEscalationTeam(ticket, level) {
  const assignee = ENTERPRISE_CONFIG.escalationLevels[level].assignTo;
  
  Tickets.updateTicket(ticket.id, {
    assignedTo: assignee,
    priority: 'urgent',
    status: 'escalated',
    escalationLevel: level,
    customFields: {
      criticality: ticket.criticality.score,
      vipCustomer: ticket.criticality.isVIP,
      escalationFactors: ticket.criticality.factors
    }
  }, 'escalation_manager');
  
  console.log(`   ✅ Assigned to: ${assignee}`);
}

/**
 * Send enterprise acknowledgment
 */
function sendEnterpriseAcknowledgment(ticket) {
  const isVIP = ticket.criticality.isVIP;
  const level = determineEscalationLevel(ticket);
  
  let response = `Dear ${ticket.customerEmail.split('@')[0]},

Thank you for contacting us. ${isVIP ? 'As a valued enterprise customer, ' : ''}your issue has been marked as high priority and escalated to our ${level === 'EXEC' ? 'executive' : 'senior'} support team.

Ticket ID: ${ticket.id}
Priority: URGENT
Expected Response Time: ${isVIP ? '15 minutes' : '30 minutes'}

`;

  if (ticket.criticality.score >= 90) {
    response += `Due to the critical nature of your issue, we have initiated our emergency response protocol. A dedicated team has been assembled to resolve your issue.

`;
  }

  response += `What happens next:
1. A senior specialist will contact you within ${isVIP ? '15' : '30'} minutes
2. We will provide updates every ${ENTERPRISE_CONFIG.vipSLA.updateFrequency} minutes
3. Our target resolution time is ${ENTERPRISE_CONFIG.vipSLA.resolutionTime / 60} hours

If you need immediate assistance, please call our enterprise hotline: 1-800-ENTERPRISE

Best regards,
Enterprise Support Team`;

  Email.sendEmail(
    ticket.customerEmail,
    `Re: ${ticket.subject} [URGENT - Ticket ${ticket.id}]`,
    response,
    {
      importance: 'high',
      labels: ['escalated/enterprise']
    }
  );
  
  console.log('   ✅ Enterprise acknowledgment sent');
}

/**
 * Monitor active escalations
 */
function monitorActiveEscalations() {
  console.log('\n⏱️  Monitoring Active Escalations...');
  
  const escalatedTickets = Tickets.searchTickets('', {
    status: 'escalated',
    limit: 50
  }).tickets;
  
  escalatedTickets.forEach(ticket => {
    const age = (Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60);
    const currentLevel = ticket.escalationLevel || 'L1';
    const nextLevel = getNextEscalationLevel(currentLevel);
    
    // Check if needs further escalation
    if (shouldEscalate(ticket, currentLevel, age)) {
      console.log(`   ⬆️  Escalating ${ticket.id} from ${currentLevel} to ${nextLevel}`);
      escalateToNextLevel(ticket, nextLevel);
    }
    
    // Check if SLA is at risk
    if (isSLAAtRisk(ticket)) {
      console.log(`   ⚠️  SLA at risk for ${ticket.id}`);
      sendSLAWarning(ticket);
    }
  });
}

/**
 * Generate executive dashboard
 */
function generateExecutiveDashboard() {
  console.log('\n📊 Executive Dashboard');
  console.log('======================');
  
  const metrics = {
    totalEscalations: 0,
    vipTickets: 0,
    avgResolutionTime: 0,
    slaCompliance: 0,
    byLevel: {},
    topIssues: {},
    customerImpact: []
  };
  
  // Gather metrics
  const escalatedTickets = Tickets.searchTickets('', {
    status: ['escalated', 'resolved'],
    createdAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    limit: 200
  }).tickets;
  
  escalatedTickets.forEach(ticket => {
    if (ticket.escalationLevel) {
      metrics.totalEscalations++;
      metrics.byLevel[ticket.escalationLevel] = (metrics.byLevel[ticket.escalationLevel] || 0) + 1;
      
      if (ticket.customFields?.vipCustomer) {
        metrics.vipTickets++;
      }
      
      // Track issue types
      const category = ticket.category || 'other';
      metrics.topIssues[category] = (metrics.topIssues[category] || 0) + 1;
    }
  });
  
  // Calculate SLA compliance
  const slaResults = calculateSLACompliance(escalatedTickets);
  metrics.slaCompliance = slaResults.compliance;
  
  // Display dashboard
  console.log(`Total Escalations (7 days): ${metrics.totalEscalations}`);
  console.log(`VIP Tickets: ${metrics.vipTickets}`);
  console.log(`SLA Compliance: ${metrics.slaCompliance}%`);
  console.log('\nBy Level:');
  Object.entries(metrics.byLevel).forEach(([level, count]) => {
    console.log(`  ${level}: ${count}`);
  });
  console.log('\nTop Issues:');
  Object.entries(metrics.topIssues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([issue, count]) => {
      console.log(`  ${issue}: ${count}`);
    });
  
  // Generate HTML report
  const htmlReport = generateHTMLDashboard(metrics);
  
  // Save to Drive
  const file = DriveApp.createFile(
    `Executive_Dashboard_${new Date().toISOString().split('T')[0]}.html`,
    htmlReport,
    MimeType.HTML
  );
  
  console.log(`\n📄 Full report saved: ${file.getUrl()}`);
}

/**
 * Enforce enterprise SLA
 */
function enforceEnterpriseSLA() {
  console.log('\n⚖️  Enforcing Enterprise SLA...');
  
  const vipTickets = Tickets.searchTickets('', {
    customerEmail: ENTERPRISE_CONFIG.vipDomains.map(d => `@${d}`),
    status: ['new', 'open', 'escalated'],
    limit: 50
  }).tickets;
  
  vipTickets.forEach(ticket => {
    const age = (Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60);
    
    // Check response time SLA
    if (!ticket.firstResponseAt && age > ENTERPRISE_CONFIG.vipSLA.responseTime) {
      console.log(`   🚨 Response SLA breached: ${ticket.id}`);
      handleSLABreach(ticket, 'response');
    }
    
    // Check resolution time SLA
    if (!ticket.resolvedAt && age > ENTERPRISE_CONFIG.vipSLA.resolutionTime) {
      console.log(`   🚨 Resolution SLA breached: ${ticket.id}`);
      handleSLABreach(ticket, 'resolution');
    }
  });
}

/**
 * Helper functions
 */
function getNextEscalationLevel(currentLevel) {
  const levels = Object.keys(ENTERPRISE_CONFIG.escalationLevels);
  const currentIndex = levels.indexOf(currentLevel);
  return levels[Math.min(currentIndex + 1, levels.length - 1)];
}

function shouldEscalate(ticket, currentLevel, age) {
  const nextLevel = getNextEscalationLevel(currentLevel);
  if (nextLevel === currentLevel) return false;
  
  const threshold = ENTERPRISE_CONFIG.escalationLevels[nextLevel].threshold;
  return age >= threshold;
}

function escalateToNextLevel(ticket, nextLevel) {
  assignToEscalationTeam(ticket, nextLevel);
  
  // Notify new assignee
  const assignee = ENTERPRISE_CONFIG.escalationLevels[nextLevel].assignTo;
  Email.sendEmail(
    assignee,
    `🚨 Escalation: ${ticket.subject}`,
    `You have been assigned a critical escalation.

Ticket: ${ticket.id}
Customer: ${ticket.customerEmail}
Level: ${nextLevel}
Age: ${Math.round(ticket.criticality.age)} hours

Please review immediately.`
  );
}

function isSLAAtRisk(ticket) {
  if (!ticket.sla?.resolutionTarget) return false;
  
  const now = new Date();
  const target = new Date(ticket.sla.resolutionTarget);
  const timeRemaining = (target - now) / (1000 * 60 * 60); // hours
  
  return timeRemaining < 1 && timeRemaining > 0;
}

function sendSLAWarning(ticket) {
  const assignee = ticket.assignedTo;
  if (!assignee) return;
  
  Email.sendEmail(
    assignee,
    `⚠️ SLA Warning: ${ticket.id}`,
    `SLA deadline approaching for ticket ${ticket.id}.

Time remaining: ${Math.round((new Date(ticket.sla.resolutionTarget) - new Date()) / (1000 * 60))} minutes

Please prioritize this ticket.`
  );
}

function calculateSLACompliance(tickets) {
  let total = 0;
  let compliant = 0;
  
  tickets.forEach(ticket => {
    if (ticket.sla?.resolutionTarget) {
      total++;
      if (!ticket.sla.breached) {
        compliant++;
      }
    }
  });
  
  return {
    compliance: total > 0 ? Math.round((compliant / total) * 100) : 100,
    total: total,
    compliant: compliant
  };
}

function handleSLABreach(ticket, type) {
  // Update ticket
  Tickets.updateTicket(ticket.id, {
    sla: {
      ...ticket.sla,
      breached: true,
      breachType: type,
      breachedAt: new Date().toISOString()
    }
  }, 'sla_monitor');
  
  // Notify executives
  const notification = `SLA BREACH ALERT

Customer: ${ticket.customerEmail}
Ticket: ${ticket.id}
Type: ${type} SLA
Subject: ${ticket.subject}

Immediate action required.`;
  
  Email.sendEmail(
    ENTERPRISE_CONFIG.escalationLevels.L3.assignTo,
    `🚨 SLA Breach: ${ticket.id}`,
    notification,
    { importance: 'high' }
  );
}

function createSlackChannel(warRoom) {
  // In production, integrate with Slack API
  console.log('   📢 Slack channel created');
  return `https://slack.com/channels/war-${warRoom.id}`;
}

function notifyStakeholders(ticket, level) {
  // Get stakeholder list based on level
  const stakeholders = getStakeholders(level);
  
  stakeholders.forEach(email => {
    Email.sendEmail(
      email,
      `Critical Escalation: ${ticket.subject}`,
      `A critical issue has been escalated.

Level: ${level}
Customer: ${ticket.customerEmail}
Issue: ${ticket.subject}

Dashboard: [Link to dashboard]`
    );
  });
}

function getStakeholders(level) {
  const stakeholders = {
    L1: ['team-lead@company.com'],
    L2: ['support-manager@company.com'],
    L3: ['vp-support@company.com', 'vp-engineering@company.com'],
    L4: ['c-suite@company.com'],
    EXEC: ['ceo@company.com', 'board@company.com']
  };
  
  return stakeholders[level] || [];
}

function generateHTMLDashboard(metrics) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Executive Support Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .metric { background: #f0f0f0; padding: 20px; margin: 10px; border-radius: 5px; }
    .critical { color: #ff0000; font-weight: bold; }
    .chart { margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Executive Support Dashboard</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  
  <div class="metric">
    <h2>Key Metrics (7 Days)</h2>
    <p>Total Escalations: <strong>${metrics.totalEscalations}</strong></p>
    <p>VIP Tickets: <strong>${metrics.vipTickets}</strong></p>
    <p>SLA Compliance: <strong>${metrics.slaCompliance}%</strong></p>
  </div>
  
  <div class="metric">
    <h2>Escalation Levels</h2>
    ${Object.entries(metrics.byLevel).map(([level, count]) => 
      `<p>${level}: ${count}</p>`
    ).join('')}
  </div>
  
  <div class="metric">
    <h2>Top Issues</h2>
    ${Object.entries(metrics.topIssues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => 
        `<p>${issue}: ${count}</p>`
      ).join('')}
  </div>
</body>
</html>`;
}

function setupTicketMonitoring(ticket) {
  // Set up automated monitoring
  const monitoring = {
    ticketId: ticket.id,
    interval: 30, // minutes
    escalationThreshold: 2, // hours without update
    lastCheck: new Date().toISOString()
  };
  
  const props = PropertiesService.getScriptProperties();
  props.setProperty(`monitor_${ticket.id}`, JSON.stringify(monitoring));
}

// Run enterprise escalation manager
function runEnterpriseEscalation() {
  enterpriseEscalationProcessor();
}