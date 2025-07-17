/**
 * Customer Feedback Analyzer
 * 
 * Use Case: Analyze customer feedback, reviews, satisfaction surveys
 * Features: Sentiment analysis, trend detection, actionable insights
 */

// Feedback Configuration
const FEEDBACK_CONFIG = {
  sentimentThresholds: {
    positive: 0.6,
    negative: -0.3,
    neutral: { min: -0.3, max: 0.6 }
  },
  
  feedbackCategories: [
    'product_quality',
    'customer_service',
    'pricing',
    'features',
    'usability',
    'performance',
    'documentation',
    'delivery'
  ],
  
  npsCategories: {
    promoter: { min: 9, max: 10 },
    passive: { min: 7, max: 8 },
    detractor: { min: 0, max: 6 }
  },
  
  alertThresholds: {
    negativeTrend: 0.3, // 30% increase in negative feedback
    npsDropAlert: 10, // 10 point NPS drop
    urgentKeywords: ['refund', 'cancel', 'terrible', 'worst', 'lawsuit', 'BBB']
  }
};

/**
 * Feedback analyzer main function
 */
function feedbackAnalyzer() {
  console.log('📊 Customer Feedback Analyzer');
  console.log('=============================\n');
  
  // Collect feedback from multiple sources
  const feedback = collectFeedback();
  console.log(`Collected ${feedback.length} feedback items\n`);
  
  // Analyze each feedback
  const analyzedFeedback = [];
  feedback.forEach(item => {
    const analysis = analyzeFeedback(item);
    analyzedFeedback.push(analysis);
    
    // Handle urgent feedback
    if (analysis.urgent) {
      handleUrgentFeedback(analysis);
    }
  });
  
  // Generate insights
  const insights = generateInsights(analyzedFeedback);
  displayInsights(insights);
  
  // Detect trends
  const trends = detectTrends(analyzedFeedback);
  displayTrends(trends);
  
  // Generate actionable recommendations
  const recommendations = generateRecommendations(insights, trends);
  displayRecommendations(recommendations);
  
  // Update dashboards
  updateFeedbackDashboard(insights, trends);
}

/**
 * Collect feedback from various sources
 */
function collectFeedback() {
  const feedback = [];
  
  // 1. Email surveys
  const surveyEmails = Email.searchEmails({
    query: 'subject:(survey OR feedback OR review OR satisfaction)',
    label: 'feedback',
    excludeLabel: 'processed',
    limit: 50
  });
  
  surveyEmails.forEach(email => {
    feedback.push({
      id: email.messageId,
      type: 'email_survey',
      source: email.from,
      date: email.date,
      subject: email.subject,
      content: email.body,
      threadId: email.threadId
    });
  });
  
  // 2. Google Forms responses
  const formResponses = collectFormResponses();
  feedback.push(...formResponses);
  
  // 3. In-app feedback
  const inAppFeedback = collectInAppFeedback();
  feedback.push(...inAppFeedback);
  
  // 4. Support ticket feedback
  const ticketFeedback = collectTicketFeedback();
  feedback.push(...ticketFeedback);
  
  return feedback;
}

/**
 * Analyze individual feedback
 */
function analyzeFeedback(feedback) {
  console.log(`\n📝 Analyzing: ${feedback.subject || feedback.type}`);
  
  const analysis = {
    id: feedback.id,
    type: feedback.type,
    date: feedback.date,
    source: feedback.source,
    content: feedback.content,
    sentiment: analyzeSentiment(feedback.content),
    categories: categorizeFeeback(feedback.content),
    keywords: extractKeywords(feedback.content),
    urgent: false,
    actionRequired: false,
    insights: []
  };
  
  // Calculate sentiment score
  console.log(`   😊 Sentiment: ${analysis.sentiment.label} (${analysis.sentiment.score.toFixed(2)})`);
  
  // Check for urgent indicators
  analysis.urgent = checkUrgency(feedback.content, analysis.sentiment);
  if (analysis.urgent) {
    console.log('   🚨 Marked as URGENT');
  }
  
  // Extract specific feedback points
  const points = extractFeedbackPoints(feedback.content);
  analysis.points = points;
  console.log(`   📍 Feedback points: ${points.length}`);
  
  // Determine if action required
  if (analysis.sentiment.score < FEEDBACK_CONFIG.sentimentThresholds.negative || 
      analysis.urgent) {
    analysis.actionRequired = true;
  }
  
  // Extract NPS if present
  const nps = extractNPS(feedback.content);
  if (nps !== null) {
    analysis.nps = nps;
    analysis.npsCategory = categorizeNPS(nps);
    console.log(`   📈 NPS: ${nps} (${analysis.npsCategory})`);
  }
  
  return analysis;
}

/**
 * Analyze sentiment
 */
function analyzeSentiment(text) {
  // Use AI for sentiment analysis
  const aiAnalysis = AI.analyzeSentiment(text);
  
  // Enhanced sentiment with emotion detection
  const emotions = detectEmotions(text);
  
  let score = aiAnalysis.score;
  let label = 'neutral';
  
  if (score >= FEEDBACK_CONFIG.sentimentThresholds.positive) {
    label = 'positive';
  } else if (score <= FEEDBACK_CONFIG.sentimentThresholds.negative) {
    label = 'negative';
  }
  
  return {
    score: score,
    label: label,
    confidence: aiAnalysis.confidence,
    emotions: emotions
  };
}

/**
 * Categorize feedback
 */
function categorizeFeeback(content) {
  const categories = [];
  const contentLower = content.toLowerCase();
  
  // Check each category
  const categoryKeywords = {
    product_quality: ['quality', 'defect', 'broken', 'durable', 'build'],
    customer_service: ['support', 'service', 'help', 'agent', 'response'],
    pricing: ['price', 'cost', 'expensive', 'value', 'worth'],
    features: ['feature', 'functionality', 'capability', 'missing', 'need'],
    usability: ['easy', 'difficult', 'confusing', 'intuitive', 'user-friendly'],
    performance: ['slow', 'fast', 'speed', 'performance', 'lag'],
    documentation: ['documentation', 'docs', 'manual', 'guide', 'instructions'],
    delivery: ['shipping', 'delivery', 'arrived', 'package', 'late']
  };
  
  Object.entries(categoryKeywords).forEach(([category, keywords]) => {
    if (keywords.some(keyword => contentLower.includes(keyword))) {
      categories.push(category);
    }
  });
  
  // Use AI for better categorization
  const aiCategories = AI.categorizeFeedback(content);
  categories.push(...aiCategories.filter(c => !categories.includes(c)));
  
  return categories;
}

/**
 * Extract keywords
 */
function extractKeywords(content) {
  // Simple keyword extraction
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4);
  
  // Count frequency
  const frequency = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  // Get top keywords
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Check urgency
 */
function checkUrgency(content, sentiment) {
  const contentLower = content.toLowerCase();
  
  // Check urgent keywords
  if (FEEDBACK_CONFIG.alertThresholds.urgentKeywords.some(keyword => 
    contentLower.includes(keyword))) {
    return true;
  }
  
  // Very negative sentiment
  if (sentiment.score < -0.7) {
    return true;
  }
  
  // Threat indicators
  const threatPatterns = [
    /going to (sue|report|escalate)/i,
    /contact (lawyer|attorney|media)/i,
    /social media/i,
    /viral/i
  ];
  
  return threatPatterns.some(pattern => pattern.test(content));
}

/**
 * Extract feedback points
 */
function extractFeedbackPoints(content) {
  const points = [];
  
  // Split into sentences
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
  
  sentences.forEach(sentence => {
    const sentiment = analyzeSentiment(sentence);
    
    // Extract specific feedback
    if (Math.abs(sentiment.score) > 0.3) {
      points.push({
        text: sentence.trim(),
        sentiment: sentiment.label,
        score: sentiment.score
      });
    }
  });
  
  return points;
}

/**
 * Extract NPS score
 */
function extractNPS(content) {
  // Look for NPS pattern (0-10 rating)
  const npsMatch = content.match(/(?:rate|rating|score|nps)[^\d]*(\d+)(?:\/10|\s*out\s*of\s*10)?/i);
  
  if (npsMatch) {
    const score = parseInt(npsMatch[1]);
    if (score >= 0 && score <= 10) {
      return score;
    }
  }
  
  return null;
}

/**
 * Categorize NPS
 */
function categorizeNPS(score) {
  if (score >= FEEDBACK_CONFIG.npsCategories.promoter.min) {
    return 'promoter';
  } else if (score >= FEEDBACK_CONFIG.npsCategories.passive.min) {
    return 'passive';
  } else {
    return 'detractor';
  }
}

/**
 * Handle urgent feedback
 */
function handleUrgentFeedback(analysis) {
  console.log(`\n🚨 Handling urgent feedback: ${analysis.id}`);
  
  // Create high-priority ticket
  const ticket = Tickets.createTicket({
    customerEmail: analysis.source,
    subject: `Urgent Feedback: ${analysis.sentiment.label}`,
    description: analysis.content,
    priority: 'urgent',
    category: 'feedback',
    customFields: {
      sentiment: analysis.sentiment.score,
      urgentReason: analysis.urgent,
      feedbackCategories: analysis.categories
    }
  });
  
  // Notify management
  const notification = `Urgent Customer Feedback Alert

Customer: ${analysis.source}
Sentiment: ${analysis.sentiment.label} (${analysis.sentiment.score.toFixed(2)})
Categories: ${analysis.categories.join(', ')}

Key Points:
${analysis.points.slice(0, 3).map(p => `- ${p.text}`).join('\n')}

Ticket Created: ${ticket.id}

Please review immediately.`;
  
  Email.sendEmail(
    'feedback-alerts@company.com',
    '🚨 Urgent Customer Feedback',
    notification,
    { importance: 'high' }
  );
  
  // If detractor, trigger win-back campaign
  if (analysis.npsCategory === 'detractor') {
    triggerWinBackCampaign(analysis);
  }
}

/**
 * Generate insights from analyzed feedback
 */
function generateInsights(analyzedFeedback) {
  const insights = {
    totalFeedback: analyzedFeedback.length,
    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
    avgSentiment: 0,
    nps: { score: 0, promoters: 0, passives: 0, detractors: 0 },
    topCategories: {},
    topPositive: [],
    topNegative: [],
    commonKeywords: {},
    urgentItems: 0,
    actionRequired: 0
  };
  
  let totalSentiment = 0;
  let npsCount = 0;
  let npsSum = 0;
  
  analyzedFeedback.forEach(feedback => {
    // Sentiment
    insights.sentimentBreakdown[feedback.sentiment.label]++;
    totalSentiment += feedback.sentiment.score;
    
    // Categories
    feedback.categories.forEach(category => {
      insights.topCategories[category] = (insights.topCategories[category] || 0) + 1;
    });
    
    // Keywords
    feedback.keywords.forEach(keyword => {
      insights.commonKeywords[keyword.word] = 
        (insights.commonKeywords[keyword.word] || 0) + keyword.count;
    });
    
    // NPS
    if (feedback.nps !== undefined) {
      npsCount++;
      npsSum += feedback.nps;
      insights.nps[feedback.npsCategory + 's']++;
    }
    
    // Urgent and action items
    if (feedback.urgent) insights.urgentItems++;
    if (feedback.actionRequired) insights.actionRequired++;
    
    // Collect top feedback
    if (feedback.sentiment.score > 0.7) {
      insights.topPositive.push({
        content: feedback.content.substring(0, 200),
        score: feedback.sentiment.score
      });
    } else if (feedback.sentiment.score < -0.5) {
      insights.topNegative.push({
        content: feedback.content.substring(0, 200),
        score: feedback.sentiment.score
      });
    }
  });
  
  // Calculate averages
  insights.avgSentiment = totalSentiment / analyzedFeedback.length;
  
  // Calculate NPS
  if (npsCount > 0) {
    const promoterPct = (insights.nps.promoters / npsCount) * 100;
    const detractorPct = (insights.nps.detractors / npsCount) * 100;
    insights.nps.score = Math.round(promoterPct - detractorPct);
  }
  
  // Sort and limit
  insights.topCategories = Object.entries(insights.topCategories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});
  
  insights.commonKeywords = Object.entries(insights.commonKeywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});
  
  insights.topPositive = insights.topPositive
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  
  insights.topNegative = insights.topNegative
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  
  return insights;
}

/**
 * Detect trends
 */
function detectTrends(analyzedFeedback) {
  // Get historical data
  const historicalData = getHistoricalFeedbackData();
  
  const trends = {
    sentimentTrend: calculateSentimentTrend(analyzedFeedback, historicalData),
    npsTrend: calculateNPSTrend(analyzedFeedback, historicalData),
    categoryTrends: {},
    emergingIssues: [],
    improvingAreas: []
  };
  
  // Calculate category trends
  const currentCategories = {};
  const historicalCategories = {};
  
  analyzedFeedback.forEach(f => {
    f.categories.forEach(c => {
      currentCategories[c] = (currentCategories[c] || 0) + 1;
    });
  });
  
  historicalData.forEach(f => {
    f.categories.forEach(c => {
      historicalCategories[c] = (historicalCategories[c] || 0) + 1;
    });
  });
  
  // Compare categories
  Object.keys(currentCategories).forEach(category => {
    const current = currentCategories[category] / analyzedFeedback.length;
    const historical = (historicalCategories[category] || 0) / Math.max(historicalData.length, 1);
    const change = current - historical;
    
    trends.categoryTrends[category] = {
      current: current,
      historical: historical,
      change: change,
      trend: change > 0.1 ? 'increasing' : change < -0.1 ? 'decreasing' : 'stable'
    };
    
    // Identify emerging issues
    if (change > 0.2 && current > 0.1) {
      trends.emergingIssues.push({
        category: category,
        increase: (change * 100).toFixed(1) + '%'
      });
    }
    
    // Identify improving areas
    if (change < -0.1 && historical > 0.1) {
      trends.improvingAreas.push({
        category: category,
        decrease: (Math.abs(change) * 100).toFixed(1) + '%'
      });
    }
  });
  
  return trends;
}

/**
 * Generate recommendations
 */
function generateRecommendations(insights, trends) {
  const recommendations = [];
  
  // Sentiment-based recommendations
  if (insights.avgSentiment < 0) {
    recommendations.push({
      priority: 'high',
      category: 'sentiment',
      title: 'Overall Negative Sentiment',
      description: `Average sentiment is ${insights.avgSentiment.toFixed(2)}. Immediate action needed.`,
      actions: [
        'Review top negative feedback items',
        'Implement quick wins to address common complaints',
        'Launch customer satisfaction improvement initiative'
      ]
    });
  }
  
  // NPS recommendations
  if (insights.nps.score < 0) {
    recommendations.push({
      priority: 'high',
      category: 'nps',
      title: 'Negative Net Promoter Score',
      description: `NPS is ${insights.nps.score}. More detractors than promoters.`,
      actions: [
        'Launch detractor recovery program',
        'Analyze detractor feedback for common themes',
        'Implement loyalty program for promoters'
      ]
    });
  }
  
  // Category-specific recommendations
  Object.entries(insights.topCategories).forEach(([category, count]) => {
    const percentage = (count / insights.totalFeedback * 100).toFixed(1);
    
    if (percentage > 20) {
      recommendations.push({
        priority: 'medium',
        category: category,
        title: `High feedback volume for ${category}`,
        description: `${percentage}% of feedback relates to ${category}`,
        actions: generateCategoryActions(category, insights, trends)
      });
    }
  });
  
  // Trend-based recommendations
  trends.emergingIssues.forEach(issue => {
    recommendations.push({
      priority: 'high',
      category: issue.category,
      title: `Emerging Issue: ${issue.category}`,
      description: `${issue.increase} increase in ${issue.category} feedback`,
      actions: [
        `Investigate root cause of ${issue.category} issues`,
        'Set up monitoring dashboard',
        'Create action plan to address'
      ]
    });
  });
  
  // Positive reinforcement
  if (insights.sentimentBreakdown.positive > insights.sentimentBreakdown.negative * 2) {
    recommendations.push({
      priority: 'low',
      category: 'positive',
      title: 'Leverage Positive Sentiment',
      description: 'Strong positive sentiment detected',
      actions: [
        'Create case studies from happy customers',
        'Launch referral program',
        'Collect testimonials for marketing'
      ]
    });
  }
  
  return recommendations;
}

/**
 * Display functions
 */
function displayInsights(insights) {
  console.log('\n📊 Feedback Insights');
  console.log('===================');
  console.log(`Total Feedback: ${insights.totalFeedback}`);
  console.log(`Average Sentiment: ${insights.avgSentiment.toFixed(2)}`);
  console.log(`\nSentiment Breakdown:`);
  console.log(`  Positive: ${insights.sentimentBreakdown.positive} (${(insights.sentimentBreakdown.positive / insights.totalFeedback * 100).toFixed(1)}%)`);
  console.log(`  Neutral: ${insights.sentimentBreakdown.neutral} (${(insights.sentimentBreakdown.neutral / insights.totalFeedback * 100).toFixed(1)}%)`);
  console.log(`  Negative: ${insights.sentimentBreakdown.negative} (${(insights.sentimentBreakdown.negative / insights.totalFeedback * 100).toFixed(1)}%)`);
  
  if (insights.nps.score !== 0) {
    console.log(`\nNet Promoter Score: ${insights.nps.score}`);
    console.log(`  Promoters: ${insights.nps.promoters}`);
    console.log(`  Passives: ${insights.nps.passives}`);
    console.log(`  Detractors: ${insights.nps.detractors}`);
  }
  
  console.log(`\nTop Categories:`);
  Object.entries(insights.topCategories).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });
  
  console.log(`\nUrgent Items: ${insights.urgentItems}`);
  console.log(`Action Required: ${insights.actionRequired}`);
}

function displayTrends(trends) {
  console.log('\n📈 Trends Analysis');
  console.log('==================');
  console.log(`Sentiment Trend: ${trends.sentimentTrend.direction} (${trends.sentimentTrend.change > 0 ? '+' : ''}${(trends.sentimentTrend.change * 100).toFixed(1)}%)`);
  
  if (trends.npsTrend.available) {
    console.log(`NPS Trend: ${trends.npsTrend.direction} (${trends.npsTrend.change > 0 ? '+' : ''}${trends.npsTrend.change} points)`);
  }
  
  if (trends.emergingIssues.length > 0) {
    console.log(`\n⚠️  Emerging Issues:`);
    trends.emergingIssues.forEach(issue => {
      console.log(`  - ${issue.category}: ${issue.increase} increase`);
    });
  }
  
  if (trends.improvingAreas.length > 0) {
    console.log(`\n✅ Improving Areas:`);
    trends.improvingAreas.forEach(area => {
      console.log(`  - ${area.category}: ${area.decrease} decrease`);
    });
  }
}

function displayRecommendations(recommendations) {
  console.log('\n💡 Recommendations');
  console.log('==================');
  
  const byPriority = { high: [], medium: [], low: [] };
  recommendations.forEach(rec => {
    byPriority[rec.priority].push(rec);
  });
  
  ['high', 'medium', 'low'].forEach(priority => {
    if (byPriority[priority].length > 0) {
      console.log(`\n${priority.toUpperCase()} Priority:`);
      byPriority[priority].forEach(rec => {
        console.log(`\n  📌 ${rec.title}`);
        console.log(`     ${rec.description}`);
        console.log(`     Actions:`);
        rec.actions.forEach(action => {
          console.log(`     • ${action}`);
        });
      });
    }
  });
}

/**
 * Helper functions
 */
function detectEmotions(text) {
  const emotions = {
    joy: 0,
    anger: 0,
    sadness: 0,
    fear: 0,
    surprise: 0
  };
  
  // Simple emotion detection (in production, use proper NLP)
  const emotionKeywords = {
    joy: ['happy', 'delighted', 'pleased', 'satisfied', 'love', 'excellent'],
    anger: ['angry', 'furious', 'annoyed', 'frustrated', 'hate', 'terrible'],
    sadness: ['sad', 'disappointed', 'unhappy', 'depressed'],
    fear: ['worried', 'concerned', 'afraid', 'anxious'],
    surprise: ['surprised', 'amazed', 'shocked', 'unexpected']
  };
  
  const textLower = text.toLowerCase();
  
  Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
    keywords.forEach(keyword => {
      if (textLower.includes(keyword)) {
        emotions[emotion]++;
      }
    });
  });
  
  return emotions;
}

function collectFormResponses() {
  // In production, connect to Google Forms API
  return [];
}

function collectInAppFeedback() {
  // In production, connect to app database
  return [];
}

function collectTicketFeedback() {
  // Get resolved tickets with feedback
  const resolvedTickets = Tickets.searchTickets('', {
    status: 'resolved',
    hasCustomerFeedback: true,
    limit: 50
  }).tickets;
  
  return resolvedTickets.map(ticket => ({
    id: `ticket_${ticket.id}`,
    type: 'ticket_feedback',
    source: ticket.customerEmail,
    date: ticket.resolvedAt,
    content: ticket.customerFeedback,
    ticketId: ticket.id
  }));
}

function getHistoricalFeedbackData() {
  // In production, retrieve from database
  // For now, return empty array
  return [];
}

function calculateSentimentTrend(current, historical) {
  const currentAvg = current.reduce((sum, f) => sum + f.sentiment.score, 0) / current.length;
  const historicalAvg = historical.length > 0 ? 
    historical.reduce((sum, f) => sum + f.sentiment.score, 0) / historical.length : currentAvg;
  
  const change = currentAvg - historicalAvg;
  
  return {
    current: currentAvg,
    historical: historicalAvg,
    change: change,
    direction: change > 0.1 ? 'improving' : change < -0.1 ? 'declining' : 'stable'
  };
}

function calculateNPSTrend(current, historical) {
  // Calculate current NPS
  const currentNPS = current.filter(f => f.nps !== undefined);
  if (currentNPS.length === 0) {
    return { available: false };
  }
  
  const currentScore = calculateNPSScore(currentNPS);
  const historicalScore = historical.length > 0 ? calculateNPSScore(historical.filter(f => f.nps !== undefined)) : currentScore;
  
  const change = currentScore - historicalScore;
  
  return {
    available: true,
    current: currentScore,
    historical: historicalScore,
    change: change,
    direction: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable'
  };
}

function calculateNPSScore(feedbackWithNPS) {
  if (feedbackWithNPS.length === 0) return 0;
  
  const counts = { promoters: 0, detractors: 0 };
  
  feedbackWithNPS.forEach(f => {
    if (f.npsCategory === 'promoter') counts.promoters++;
    else if (f.npsCategory === 'detractor') counts.detractors++;
  });
  
  const promoterPct = (counts.promoters / feedbackWithNPS.length) * 100;
  const detractorPct = (counts.detractors / feedbackWithNPS.length) * 100;
  
  return Math.round(promoterPct - detractorPct);
}

function generateCategoryActions(category, insights, trends) {
  const actions = {
    product_quality: [
      'Review quality control processes',
      'Analyze defect reports',
      'Implement additional testing'
    ],
    customer_service: [
      'Review support team performance',
      'Implement additional training',
      'Analyze response times'
    ],
    pricing: [
      'Conduct competitive pricing analysis',
      'Consider value-based pricing adjustments',
      'Create ROI calculator for customers'
    ],
    features: [
      'Prioritize feature requests',
      'Update product roadmap',
      'Communicate upcoming features'
    ]
  };
  
  return actions[category] || ['Analyze feedback details', 'Create improvement plan', 'Monitor progress'];
}

function triggerWinBackCampaign(analysis) {
  console.log(`   🎯 Triggering win-back campaign for ${analysis.source}`);
  
  // In production, trigger automated campaign
  // For now, just log
}

function updateFeedbackDashboard(insights, trends) {
  // Create dashboard HTML
  const dashboardHtml = generateFeedbackDashboard(insights, trends);
  
  // Save to Drive
  const file = DriveApp.createFile(
    `Feedback_Dashboard_${new Date().toISOString().split('T')[0]}.html`,
    dashboardHtml,
    MimeType.HTML
  );
  
  console.log(`\n📊 Dashboard saved: ${file.getUrl()}`);
}

function generateFeedbackDashboard(insights, trends) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Customer Feedback Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .metric { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .positive { color: #28a745; }
    .negative { color: #dc3545; }
    .neutral { color: #6c757d; }
  </style>
</head>
<body>
  <h1>Customer Feedback Dashboard</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  
  <div class="metric">
    <h3>Overall Metrics</h3>
    <p>Total Feedback: <strong>${insights.totalFeedback}</strong></p>
    <p>Average Sentiment: <strong class="${insights.avgSentiment > 0 ? 'positive' : 'negative'}">${insights.avgSentiment.toFixed(2)}</strong></p>
    <p>NPS Score: <strong>${insights.nps.score}</strong></p>
  </div>
  
  <div class="metric">
    <h3>Sentiment Distribution</h3>
    <p class="positive">Positive: ${insights.sentimentBreakdown.positive}</p>
    <p class="neutral">Neutral: ${insights.sentimentBreakdown.neutral}</p>
    <p class="negative">Negative: ${insights.sentimentBreakdown.negative}</p>
  </div>
  
  <div class="metric">
    <h3>Top Issues</h3>
    ${Object.entries(insights.topCategories).map(([cat, count]) => 
      `<p>${cat}: ${count}</p>`
    ).join('')}
  </div>
</body>
</html>`;
}

// Run feedback analyzer
function runFeedbackAnalyzer() {
  feedbackAnalyzer();
}