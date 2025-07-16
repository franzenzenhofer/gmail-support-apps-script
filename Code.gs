/**
 * Gmail First-Level Support System - 100% Google Apps Script
 * 
 * Complete customer support automation that runs entirely in Google Apps Script
 * No external hosting needed - uses your Gmail directly!
 */

// ==================== CONFIGURATION ====================
const CONFIG = {
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE', // Get from https://makersuite.google.com
  
  // Support settings
  AUTO_REPLY: true,
  MAX_AUTO_REPLIES: 3,
  ESCALATION_THRESHOLD: 0.7,
  SENTIMENT_ESCALATION: true,
  
  // Business hours (timezone from Gmail settings)
  BUSINESS_HOURS: {
    start: 9,  // 9 AM
    end: 17,   // 5 PM
    days: [1, 2, 3, 4, 5] // Mon-Fri
  },
  
  // Email categorization rules
  CATEGORIES: {
    technical: ['error', 'bug', 'crash', 'not working', 'broken', 'issue'],
    billing: ['payment', 'invoice', 'charge', 'refund', 'subscription', 'price'],
    account: ['password', 'login', 'access', 'security', '2fa', 'account'],
    feature: ['feature', 'request', 'add', 'implement', 'suggestion', 'improve'],
    complaint: ['complaint', 'unhappy', 'disappointed', 'angry', 'frustrated', 'worst']
  },
  
  // Support email settings
  SUPPORT_LABEL: 'Support',
  PROCESSED_LABEL: 'Support/Processed',
  ESCALATED_LABEL: 'Support/Escalated',
  AUTO_REPLIED_LABEL: 'Support/Auto-Replied',
  
  // Knowledge base spreadsheet ID (create from template)
  KNOWLEDGE_BASE_SHEET_ID: 'YOUR_SHEET_ID_HERE'
};

// ==================== MAIN FUNCTIONS ====================

/**
 * Process new support emails
 * Run this function on a time trigger (e.g., every 5 minutes)
 */
function processNewSupportEmails() {
  try {
    // Get unprocessed support emails
    const threads = GmailApp.search(`label:${CONFIG.SUPPORT_LABEL} -label:${CONFIG.PROCESSED_LABEL}`, 0, 10);
    
    Logger.log(`Found ${threads.length} new support emails`);
    
    threads.forEach(thread => {
      try {
        processSupportThread(thread);
      } catch (error) {
        console.error(`Error processing thread ${thread.getId()}:`, error);
      }
    });
    
  } catch (error) {
    console.error('Error in processNewSupportEmails:', error);
  }
}

/**
 * Process a single support thread
 */
function processSupportThread(thread) {
  const messages = thread.getMessages();
  const latestMessage = messages[messages.length - 1];
  
  // Skip if already processed
  if (latestMessage.getThread().getLabels().some(l => l.getName() === CONFIG.PROCESSED_LABEL)) {
    return;
  }
  
  // Extract email data
  const email = {
    id: latestMessage.getId(),
    threadId: thread.getId(),
    from: extractEmailAddress(latestMessage.getFrom()),
    subject: latestMessage.getSubject(),
    body: latestMessage.getPlainBody(),
    date: latestMessage.getDate(),
    messageCount: messages.length
  };
  
  Logger.log(`Processing email from ${email.from}: ${email.subject}`);
  
  // Check for email loops
  const loopCheck = checkForEmailLoop(email);
  if (loopCheck.isLoop) {
    Logger.log(`Email loop detected: ${loopCheck.reason}`);
    addLabel(thread, CONFIG.PROCESSED_LABEL);
    return;
  }
  
  // Get or create ticket
  const ticket = getOrCreateTicket(email);
  
  // Analyze email with AI
  const analysis = analyzeEmailWithAI(email);
  
  // Update ticket with analysis
  updateTicket(ticket.id, {
    sentiment: analysis.sentiment,
    category: analysis.category || categorizeEmail(email),
    priority: calculatePriority(email, analysis)
  });
  
  // Search knowledge base
  const knowledgeResults = searchKnowledgeBase(email.body, 5);
  
  // Generate solution
  const solution = generateSolution(email, knowledgeResults, analysis);
  
  // Decide on action
  if (solution.needsEscalation || solution.confidence < CONFIG.ESCALATION_THRESHOLD) {
    escalateTicket(ticket, thread, 'Requires human attention');
  } else if (shouldAutoReply(ticket, email)) {
    sendAutoReply(thread, latestMessage, solution, ticket, knowledgeResults[0]);
  }
  
  // Mark as processed
  addLabel(thread, CONFIG.PROCESSED_LABEL);
}

// ==================== TICKET MANAGEMENT ====================

/**
 * Get or create support ticket
 */
function getOrCreateTicket(email) {
  const cache = CacheService.getScriptCache();
  const ticketKey = `ticket_thread_${email.threadId}`;
  
  // Check cache first
  let ticket = cache.get(ticketKey);
  if (ticket) {
    ticket = JSON.parse(ticket);
    ticket.messageCount = email.messageCount;
    return ticket;
  }
  
  // Check properties store
  const props = PropertiesService.getScriptProperties();
  ticket = props.getProperty(ticketKey);
  if (ticket) {
    ticket = JSON.parse(ticket);
    ticket.messageCount = email.messageCount;
    return ticket;
  }
  
  // Create new ticket
  ticket = {
    id: generateTicketId(),
    threadId: email.threadId,
    customerEmail: email.from,
    subject: email.subject,
    description: email.body,
    status: 'open',
    priority: 'medium',
    category: 'general',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 1,
    autoReplyCount: 0,
    escalated: false
  };
  
  // Store ticket
  saveTicket(ticket);
  
  Logger.log(`Created new ticket ${ticket.id}`);
  return ticket;
}

/**
 * Update ticket
 */
function updateTicket(ticketId, updates) {
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  
  // Find ticket
  let ticket = null;
  let ticketKey = null;
  
  Object.keys(allProps).forEach(key => {
    if (key.startsWith('ticket_')) {
      const t = JSON.parse(allProps[key]);
      if (t.id === ticketId) {
        ticket = t;
        ticketKey = key;
      }
    }
  });
  
  if (!ticket) return null;
  
  // Update fields
  Object.assign(ticket, updates);
  ticket.updatedAt = new Date().toISOString();
  
  // Save
  props.setProperty(ticketKey, JSON.stringify(ticket));
  CacheService.getScriptCache().put(ticketKey, JSON.stringify(ticket), 3600);
  
  return ticket;
}

/**
 * Save ticket
 */
function saveTicket(ticket) {
  const key = `ticket_thread_${ticket.threadId}`;
  const props = PropertiesService.getScriptProperties();
  props.setProperty(key, JSON.stringify(ticket));
  CacheService.getScriptCache().put(key, JSON.stringify(ticket), 3600);
}

/**
 * Generate ticket ID
 */
function generateTicketId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `TKT-${timestamp}-${random}`.toUpperCase();
}

// ==================== AI ANALYSIS ====================

/**
 * Analyze email with Gemini AI
 */
function analyzeEmailWithAI(email) {
  if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    Logger.log('Gemini API key not configured');
    return {
      sentiment: 'neutral',
      category: 'general',
      urgency: 'medium',
      intent: 'unknown',
      summary: email.body.substring(0, 100)
    };
  }
  
  const prompt = `
Analyze this customer support email and provide a JSON response:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body}

Provide JSON with:
- sentiment: "positive", "negative", or "neutral"
- category: "technical", "billing", "account", "feature", "complaint", or "general"
- urgency: "low", "medium", "high", or "urgent"
- intent: main purpose of the email
- summary: one sentence summary
- suggestedResponse: brief suggested reply
- keywords: array of important keywords`;

  try {
    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024
          }
        })
      }
    );
    
    const result = JSON.parse(response.getContentText());
    const text = result.candidates[0].content.parts[0].text;
    
    // Extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    Logger.log('AI analysis error: ' + error);
  }
  
  // Fallback
  return {
    sentiment: 'neutral',
    category: categorizeEmail(email),
    urgency: 'medium',
    intent: 'support request',
    summary: email.body.substring(0, 100)
  };
}

// ==================== KNOWLEDGE BASE ====================

/**
 * Search knowledge base (stored in Google Sheets)
 */
function searchKnowledgeBase(query, limit = 5) {
  try {
    if (!CONFIG.KNOWLEDGE_BASE_SHEET_ID || CONFIG.KNOWLEDGE_BASE_SHEET_ID === 'YOUR_SHEET_ID_HERE') {
      return [];
    }
    
    const sheet = SpreadsheetApp.openById(CONFIG.KNOWLEDGE_BASE_SHEET_ID);
    const dataSheet = sheet.getSheetByName('Articles') || sheet.getSheets()[0];
    const data = dataSheet.getDataRange().getValues();
    
    if (data.length < 2) return []; // No data or only headers
    
    const headers = data[0];
    const articles = [];
    
    // Convert to objects
    for (let i = 1; i < data.length; i++) {
      const article = {};
      headers.forEach((header, index) => {
        article[header.toLowerCase()] = data[i][index];
      });
      articles.push(article);
    }
    
    // Simple keyword search
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/);
    
    const results = articles.map(article => {
      let score = 0;
      
      // Check title
      if (article.title) {
        words.forEach(word => {
          if (article.title.toLowerCase().includes(word)) score += 2;
        });
      }
      
      // Check content
      if (article.content) {
        words.forEach(word => {
          if (article.content.toLowerCase().includes(word)) score += 1;
        });
      }
      
      // Check tags
      if (article.tags) {
        const tags = article.tags.split(',').map(t => t.trim().toLowerCase());
        words.forEach(word => {
          if (tags.includes(word)) score += 1.5;
        });
      }
      
      return { article, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(result => result.article);
    
    return results;
    
  } catch (error) {
    Logger.log('Knowledge base search error: ' + error);
    return [];
  }
}

/**
 * Generate solution from knowledge base
 */
function generateSolution(email, knowledgeArticles, analysis) {
  if (knowledgeArticles.length === 0) {
    return {
      solution: analysis.suggestedResponse || 'Thank you for contacting support. A team member will assist you shortly.',
      confidence: 0.3,
      needsEscalation: true
    };
  }
  
  // Use first article as primary solution
  const primaryArticle = knowledgeArticles[0];
  
  const solution = {
    solution: primaryArticle.content || primaryArticle.solution,
    articleId: primaryArticle.id,
    confidence: 0.8,
    needsEscalation: false
  };
  
  // Lower confidence for certain categories
  if (analysis.category === 'complaint' || analysis.sentiment === 'negative') {
    solution.confidence *= 0.7;
  }
  
  return solution;
}

// ==================== EMAIL OPERATIONS ====================

/**
 * Send auto-reply
 */
function sendAutoReply(thread, originalMessage, solution, ticket, knowledgeArticle) {
  const customerName = extractCustomerName(originalMessage.getFrom());
  
  let reply = `Hi ${customerName},\n\n`;
  reply += `Thank you for contacting our support team.\n\n`;
  
  if (solution.solution) {
    reply += solution.solution + '\n\n';
  }
  
  if (knowledgeArticle && knowledgeArticle.link) {
    reply += `For more information, please see: ${knowledgeArticle.link}\n\n`;
  }
  
  reply += `If you need further assistance, please reply to this email.\n\n`;
  reply += `Best regards,\nCustomer Support Team\n`;
  reply += `Ticket ID: ${ticket.id}`;
  
  // Send reply
  thread.reply(reply);
  
  // Update ticket
  updateTicket(ticket.id, {
    autoReplyCount: (ticket.autoReplyCount || 0) + 1,
    lastAutoReply: new Date().toISOString()
  });
  
  // Add label
  addLabel(thread, CONFIG.AUTO_REPLIED_LABEL);
  
  Logger.log(`Sent auto-reply for ticket ${ticket.id}`);
}

/**
 * Escalate ticket
 */
function escalateTicket(ticket, thread, reason) {
  updateTicket(ticket.id, {
    escalated: true,
    escalatedAt: new Date().toISOString(),
    escalationReason: reason,
    priority: 'high'
  });
  
  addLabel(thread, CONFIG.ESCALATED_LABEL);
  
  // Optional: Send notification
  if (CONFIG.ESCALATION_EMAIL) {
    GmailApp.sendEmail(
      CONFIG.ESCALATION_EMAIL,
      `Escalated: ${ticket.subject}`,
      `Ticket ${ticket.id} has been escalated.\n\nReason: ${reason}\n\nCustomer: ${ticket.customerEmail}`
    );
  }
  
  Logger.log(`Escalated ticket ${ticket.id}: ${reason}`);
}

// ==================== LOOP PREVENTION ====================

/**
 * Check for email loops
 */
function checkForEmailLoop(email) {
  const cache = CacheService.getScriptCache();
  const key = `loop_${email.from}_${Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    email.subject + email.body.substring(0, 100)
  ).join('')}`;
  
  const recent = cache.get(key);
  if (recent) {
    const count = parseInt(recent) + 1;
    if (count > 3) {
      return { isLoop: true, reason: 'Too many similar emails' };
    }
    cache.put(key, count.toString(), 3600);
  } else {
    cache.put(key, '1', 3600);
  }
  
  // Check patterns
  const patterns = ['auto-reply', 'automatic response', 'out of office', 'do not reply'];
  const content = (email.subject + ' ' + email.body).toLowerCase();
  
  for (const pattern of patterns) {
    if (content.includes(pattern)) {
      return { isLoop: true, reason: 'Auto-responder pattern detected' };
    }
  }
  
  return { isLoop: false };
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Categorize email based on content
 */
function categorizeEmail(email) {
  const content = `${email.subject} ${email.body}`.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CONFIG.CATEGORIES)) {
    if (keywords.some(keyword => content.includes(keyword))) {
      return category;
    }
  }
  
  return 'general';
}

/**
 * Calculate priority
 */
function calculatePriority(email, analysis) {
  if (analysis.urgency === 'urgent') return 'urgent';
  if (analysis.sentiment === 'negative') return 'high';
  
  const urgentWords = ['urgent', 'asap', 'immediately', 'emergency'];
  const content = email.subject.toLowerCase();
  
  if (urgentWords.some(word => content.includes(word))) {
    return 'urgent';
  }
  
  return analysis.urgency || 'medium';
}

/**
 * Should auto-reply?
 */
function shouldAutoReply(ticket, email) {
  if (!CONFIG.AUTO_REPLY) return false;
  
  // Check business hours
  if (!isBusinessHours()) return false;
  
  // Check auto-reply limit
  if (ticket.autoReplyCount >= CONFIG.MAX_AUTO_REPLIES) return false;
  
  // Don't auto-reply to complaints
  if (ticket.category === 'complaint') return false;
  
  return true;
}

/**
 * Check business hours
 */
function isBusinessHours() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  
  return CONFIG.BUSINESS_HOURS.days.includes(day) && 
         hour >= CONFIG.BUSINESS_HOURS.start && 
         hour < CONFIG.BUSINESS_HOURS.end;
}

/**
 * Extract email address
 */
function extractEmailAddress(fromString) {
  const match = fromString.match(/<(.+?)>/) || fromString.match(/([^\s]+@[^\s]+)/);
  return match ? match[1] : fromString;
}

/**
 * Extract customer name
 */
function extractCustomerName(fromString) {
  const nameMatch = fromString.match(/^([^<]+)</);
  if (nameMatch) {
    return nameMatch[1].trim();
  }
  const emailMatch = fromString.match(/([^@]+)@/);
  return emailMatch ? emailMatch[1] : 'Customer';
}

/**
 * Add label to thread
 */
function addLabel(thread, labelName) {
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  thread.addLabel(label);
}

// ==================== WEB APP INTERFACE ====================

/**
 * Handle GET requests - Support dashboard
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Dashboard');
  return template.evaluate()
    .setTitle('Gmail Support System')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Get dashboard data
 */
function getDashboardData() {
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  
  const tickets = [];
  Object.keys(allProps).forEach(key => {
    if (key.startsWith('ticket_')) {
      tickets.push(JSON.parse(allProps[key]));
    }
  });
  
  // Sort by date
  tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Calculate metrics
  const metrics = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    escalated: tickets.filter(t => t.escalated).length,
    autoReplied: tickets.filter(t => t.autoReplyCount > 0).length,
    categories: {}
  };
  
  tickets.forEach(t => {
    metrics.categories[t.category] = (metrics.categories[t.category] || 0) + 1;
  });
  
  return {
    tickets: tickets.slice(0, 50), // Last 50 tickets
    metrics
  };
}

// ==================== SETUP & TRIGGERS ====================

/**
 * Initial setup - Run this once
 */
function setup() {
  // Create labels
  const labels = [
    CONFIG.SUPPORT_LABEL,
    CONFIG.PROCESSED_LABEL,
    CONFIG.ESCALATED_LABEL,
    CONFIG.AUTO_REPLIED_LABEL
  ];
  
  labels.forEach(labelName => {
    try {
      GmailApp.createLabel(labelName);
      Logger.log(`Created label: ${labelName}`);
    } catch (e) {
      Logger.log(`Label already exists: ${labelName}`);
    }
  });
  
  // Create time-based trigger
  ScriptApp.newTrigger('processNewSupportEmails')
    .timeBased()
    .everyMinutes(5)
    .create();
    
  Logger.log('Setup complete! Support system will check for new emails every 5 minutes.');
}