/**
 * Sales Inquiry Handler
 * 
 * Use Case: Handle sales inquiries, demos, pricing questions
 * Features: Lead scoring, CRM integration, automated follow-ups
 */

// Sales Configuration
const SALES_CONFIG = {
  leadScoring: {
    highValue: ['enterprise', 'corporate', 'team', 'business'],
    urgency: ['immediately', 'asap', 'urgent', 'today', 'tomorrow'],
    budget: ['budget', 'pricing', 'cost', 'investment', 'price']
  },
  autoResponse: {
    demoRequest: true,
    pricingInquiry: true,
    generalInfo: true
  },
  crmWebhook: 'YOUR_CRM_WEBHOOK_URL',
  calendlyLink: 'YOUR_CALENDLY_LINK',
  pricingPage: 'https://yourcompany.com/pricing'
};

/**
 * Sales inquiry processor
 */
function salesInquiryProcessor() {
  console.log('💼 Sales Inquiry Handler');
  console.log('========================\n');
  
  // Get sales-related emails
  const salesEmails = getSalesInquiries();
  
  salesEmails.forEach(email => {
    try {
      processSalesInquiry(email);
    } catch (error) {
      console.error('Error processing sales inquiry:', error);
    }
  });
  
  // Generate sales pipeline report
  generateSalesPipelineReport();
}

/**
 * Get sales inquiries
 */
function getSalesInquiries() {
  return Email.searchEmails({
    query: 'label:sales OR label:inquiry OR subject:(demo OR pricing OR quote)',
    excludeLabel: Config.get('email.processedLabel'),
    limit: 20
  });
}

/**
 * Process sales inquiry with lead scoring
 */
function processSalesInquiry(email) {
  console.log(`\n📧 Processing: ${email.subject}`);
  console.log(`From: ${email.from}`);
  
  // Score the lead
  const leadScore = calculateLeadScore(email);
  console.log(`Lead Score: ${leadScore.total}/100`);
  console.log(`Priority: ${leadScore.priority}`);
  
  // Extract inquiry details
  const inquiry = analyzeInquiry(email);
  console.log(`Type: ${inquiry.type}`);
  console.log(`Company: ${inquiry.company || 'Unknown'}`);
  
  // Create or update lead
  const lead = createOrUpdateLead(email, leadScore, inquiry);
  
  // Handle based on inquiry type
  switch (inquiry.type) {
  case 'demo_request':
    handleDemoRequest(email, lead, inquiry);
    break;
    
  case 'pricing_inquiry':
    handlePricingInquiry(email, lead, inquiry);
    break;
    
  case 'feature_question':
    handleFeatureQuestion(email, lead, inquiry);
    break;
    
  case 'partnership':
    handlePartnershipInquiry(email, lead, inquiry);
    break;
    
  default:
    handleGeneralInquiry(email, lead, inquiry);
  }
  
  // Send to CRM
  if (SALES_CONFIG.crmWebhook) {
    sendToCRM(lead);
  }
}

/**
 * Calculate lead score
 */
function calculateLeadScore(email) {
  const content = `${email.subject} ${email.body}`.toLowerCase();
  let score = 0;
  const factors = {};
  
  // Company size indicators
  if (content.match(/\b(\d+)\s*(employees|users|seats)/)) {
    const size = parseInt(content.match(/\b(\d+)/)[1]);
    if (size >= 100) {
      score += 30;
      factors.companySize = 'Enterprise';
    } else if (size >= 20) {
      score += 20;
      factors.companySize = 'Mid-market';
    } else {
      score += 10;
      factors.companySize = 'SMB';
    }
  }
  
  // High-value keywords
  SALES_CONFIG.leadScoring.highValue.forEach(keyword => {
    if (content.includes(keyword)) {
      score += 10;
      factors.highValueKeyword = true;
    }
  });
  
  // Urgency indicators
  SALES_CONFIG.leadScoring.urgency.forEach(keyword => {
    if (content.includes(keyword)) {
      score += 15;
      factors.urgent = true;
    }
  });
  
  // Budget mentioned
  SALES_CONFIG.leadScoring.budget.forEach(keyword => {
    if (content.includes(keyword)) {
      score += 20;
      factors.budgetMentioned = true;
    }
  });
  
  // Email domain quality
  const domain = email.from.split('@')[1];
  if (!domain.includes('gmail') && !domain.includes('yahoo') && !domain.includes('hotmail')) {
    score += 10;
    factors.corporateEmail = true;
  }
  
  // Determine priority
  let priority = 'low';
  if (score >= 60) priority = 'high';
  else if (score >= 30) priority = 'medium';
  
  return {
    total: Math.min(score, 100),
    priority: priority,
    factors: factors
  };
}

/**
 * Analyze inquiry type and details
 */
function analyzeInquiry(email) {
  const content = `${email.subject} ${email.body}`.toLowerCase();
  
  const inquiry = {
    type: 'general',
    company: extractCompanyName(email),
    features: [],
    timeline: 'not specified',
    currentSolution: null
  };
  
  // Determine inquiry type
  if (content.includes('demo') || content.includes('trial')) {
    inquiry.type = 'demo_request';
  } else if (content.includes('pricing') || content.includes('cost') || content.includes('quote')) {
    inquiry.type = 'pricing_inquiry';
  } else if (content.includes('feature') || content.includes('capability')) {
    inquiry.type = 'feature_question';
  } else if (content.includes('partner') || content.includes('reseller')) {
    inquiry.type = 'partnership';
  }
  
  // Extract timeline
  if (content.includes('immediately') || content.includes('asap')) {
    inquiry.timeline = 'immediate';
  } else if (content.includes('this month')) {
    inquiry.timeline = 'this month';
  } else if (content.includes('quarter')) {
    inquiry.timeline = 'this quarter';
  }
  
  // Extract current solution
  const solutionMatch = content.match(/currently using ([a-zA-Z0-9\s]+)/);
  if (solutionMatch) {
    inquiry.currentSolution = solutionMatch[1].trim();
  }
  
  return inquiry;
}

/**
 * Create or update lead record
 */
function createOrUpdateLead(email, leadScore, inquiry) {
  const props = PropertiesService.getScriptProperties();
  const leadKey = `lead_${email.from}`;
  
  let lead = {};
  try {
    lead = JSON.parse(props.getProperty(leadKey) || '{}');
  } catch (e) {
    // New lead
  }
  
  // Update lead information
  lead = {
    ...lead,
    email: email.from,
    company: inquiry.company || lead.company,
    firstContact: lead.firstContact || new Date().toISOString(),
    lastContact: new Date().toISOString(),
    score: leadScore.total,
    priority: leadScore.priority,
    inquiryType: inquiry.type,
    timeline: inquiry.timeline,
    interactions: (lead.interactions || 0) + 1,
    status: lead.status || 'new',
    assignedTo: determineAssignee(leadScore.priority)
  };
  
  // Save lead
  props.setProperty(leadKey, JSON.stringify(lead));
  
  return lead;
}

/**
 * Handle demo request
 */
function handleDemoRequest(email, lead, inquiry) {
  console.log('   📅 Processing demo request...');
  
  const response = `Hi there,

Thank you for your interest in a demo! I'd be happy to show you how our solution can help ${inquiry.company || 'your organization'}.

${lead.priority === 'high' ? 
    'Based on your requirements, I\'ve flagged this as a priority and our enterprise team will reach out within 2 hours.' :
    'You can schedule a demo at your convenience using the link below:'
}

${SALES_CONFIG.calendlyLink || '[Demo Scheduling Link]'}

In the meantime, here are some resources you might find helpful:
• Product Overview: [Link]
• Customer Success Stories: [Link]
• ROI Calculator: [Link]

${inquiry.timeline === 'immediate' ? 
    'I see you\'re looking to move quickly. I\'ll have our team prioritize your request.' : ''
}

Best regards,
Sales Team`;

  Email.sendEmail(
    email.from,
    `Re: ${email.subject}`,
    response,
    {
      labels: ['sales/demo-requested'],
      importance: lead.priority === 'high' ? 'high' : 'normal'
    }
  );
  
  // Create follow-up task
  createFollowUpTask(lead, 'demo_follow_up', 24);
}

/**
 * Handle pricing inquiry
 */
function handlePricingInquiry(email, lead, inquiry) {
  console.log('   💰 Processing pricing inquiry...');
  
  const response = `Hi there,

Thank you for your interest in our pricing!

${lead.score > 50 ? 
    'Based on your requirements, I\'d recommend our Enterprise plan which includes:' :
    'Here\'s an overview of our pricing plans:'
}

• Starter: $99/month - Up to 10 users
• Professional: $299/month - Up to 50 users  
• Enterprise: Custom pricing - Unlimited users + advanced features

You can see detailed pricing and features at: ${SALES_CONFIG.pricingPage}

${inquiry.company && lead.score > 30 ? 
    `For ${inquiry.company}, I can prepare a custom quote that includes volume discounts and enterprise features. Would you like me to schedule a brief call to discuss your specific needs?` :
    'Would you like to schedule a call to discuss which plan would work best for you?'
}

Best regards,
Sales Team`;

  Email.sendEmail(
    email.from,
    `Re: ${email.subject}`,
    response
  );
  
  // High-value leads get immediate follow-up
  if (lead.priority === 'high') {
    notifySalesManager(lead, 'High-value pricing inquiry');
  }
}

/**
 * Handle feature question
 */
function handleFeatureQuestion(email, lead, inquiry) {
  console.log('   🔧 Processing feature question...');
  
  // Use AI to understand the specific feature question
  const aiAnalysis = AI.analyzeEmail(email);
  
  // Search knowledge base for feature information
  const features = KnowledgeBase.search(email.body, {
    category: 'features',
    limit: 3
  });
  
  const response = AI.generateReply(email, {
    knowledgeArticles: features,
    tone: 'professional',
    includeCallToAction: true,
    customPrompt: 'Focus on how the features solve their business problems'
  });
  
  Email.sendEmail(
    email.from,
    `Re: ${email.subject}`,
    response.reply
  );
}

/**
 * Handle partnership inquiry
 */
function handlePartnershipInquiry(email, lead, inquiry) {
  console.log('   🤝 Processing partnership inquiry...');
  
  // Route to partnerships team
  Email.forwardEmail(
    email.threadId,
    'partnerships@company.com',
    'New partnership inquiry - please handle'
  );
  
  // Send acknowledgment
  const response = `Hi there,

Thank you for your interest in partnering with us!

I've forwarded your inquiry to our partnerships team who will review your proposal and get back to you within 48 hours.

In the meantime, you can learn more about our partner program at: [Partner Program Link]

Best regards,
Sales Team`;

  Email.sendEmail(email.from, `Re: ${email.subject}`, response);
}

/**
 * Send lead to CRM
 */
function sendToCRM(lead) {
  if (!SALES_CONFIG.crmWebhook) return;
  
  try {
    const payload = {
      email: lead.email,
      company: lead.company,
      score: lead.score,
      priority: lead.priority,
      type: lead.inquiryType,
      timeline: lead.timeline,
      source: 'email_inquiry',
      assignedTo: lead.assignedTo
    };
    
    UrlFetchApp.fetch(SALES_CONFIG.crmWebhook, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
    
    console.log('   ✅ Lead sent to CRM');
  } catch (error) {
    console.error('CRM integration error:', error);
  }
}

/**
 * Create follow-up task
 */
function createFollowUpTask(lead, type, hoursDelay) {
  const followUp = {
    leadEmail: lead.email,
    type: type,
    scheduledFor: new Date(Date.now() + hoursDelay * 60 * 60 * 1000).toISOString(),
    priority: lead.priority
  };
  
  const props = PropertiesService.getScriptProperties();
  props.setProperty(`followup_${Date.now()}`, JSON.stringify(followUp));
}

/**
 * Generate sales pipeline report
 */
function generateSalesPipelineReport() {
  const props = PropertiesService.getScriptProperties();
  const keys = props.getKeys();
  
  const leads = keys
    .filter(key => key.startsWith('lead_'))
    .map(key => JSON.parse(props.getProperty(key)));
  
  const report = {
    total: leads.length,
    byPriority: { high: 0, medium: 0, low: 0 },
    byType: {},
    byStatus: {},
    totalScore: 0
  };
  
  leads.forEach(lead => {
    report.byPriority[lead.priority]++;
    report.byType[lead.inquiryType] = (report.byType[lead.inquiryType] || 0) + 1;
    report.byStatus[lead.status] = (report.byStatus[lead.status] || 0) + 1;
    report.totalScore += lead.score;
  });
  
  console.log('\n📊 Sales Pipeline Report');
  console.log('========================');
  console.log(`Total Leads: ${report.total}`);
  console.log(`Average Score: ${Math.round(report.totalScore / report.total)}`);
  console.log('\nBy Priority:');
  Object.entries(report.byPriority).forEach(([priority, count]) => {
    console.log(`  ${priority}: ${count}`);
  });
  console.log('\nBy Type:');
  Object.entries(report.byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
}

/**
 * Helper functions
 */
function extractCompanyName(email) {
  // Try to extract from email domain
  const domain = email.from.split('@')[1];
  if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
    return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
  }
  
  // Try to extract from signature
  const signatureMatch = email.body.match(/(?:^|\n)([A-Z][a-zA-Z\s]+(?:Inc|LLC|Ltd|Corp))/);
  if (signatureMatch) {
    return signatureMatch[1].trim();
  }
  
  return null;
}

function determineAssignee(priority) {
  const salesTeam = {
    high: 'enterprise-sales@company.com',
    medium: 'sales-team@company.com',
    low: 'sales-queue@company.com'
  };
  
  return salesTeam[priority];
}

function notifySalesManager(lead, message) {
  const notification = {
    to: 'sales-manager@company.com',
    subject: `🔥 ${message}`,
    body: `Lead: ${lead.email}
Company: ${lead.company || 'Unknown'}
Score: ${lead.score}/100
Priority: ${lead.priority}
Type: ${lead.inquiryType}

Please review and take action.`
  };
  
  // In production, send actual email
  console.log('   📢 Sales manager notified');
}

// Run the sales handler
function runSalesInquiryHandler() {
  salesInquiryProcessor();
}