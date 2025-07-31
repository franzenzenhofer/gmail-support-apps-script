/**
 * 🎉 Improved Welcome Email Template
 * 
 * Modern, engaging welcome email with better formatting and clearer CTAs
 */

function sendImprovedWelcomeEmail(webAppUrl) {
  console.log('📬 Sending improved welcome email...');
  
  const email = Session.getActiveUser().getEmail();
  const userName = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const kbUrl = getKnowledgeBaseUrl();
  const currentTime = new Date().toLocaleString();
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      line-height: 1.6;
      color: #202124;
      background-color: #f8f9fa;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .header {
      background: linear-gradient(135deg, #4285f4 0%, #1a73e8 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 300;
    }
    
    .header .emoji {
      font-size: 48px;
      display: block;
      margin-bottom: 10px;
    }
    
    .content {
      padding: 30px;
    }
    
    .status-banner {
      background: #34a853;
      color: white;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 30px;
      font-weight: 500;
    }
    
    .status-banner .icon {
      display: inline-block;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      margin-right: 10px;
      position: relative;
      top: 3px;
    }
    
    h2 {
      color: #1a73e8;
      font-size: 20px;
      margin-top: 30px;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
    }
    
    h2 .icon {
      font-size: 24px;
      margin-right: 10px;
    }
    
    .card {
      background: #f8f9fa;
      border: 1px solid #e8eaed;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .test-box {
      background: #fef7e0;
      border: 1px solid #feefc3;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .test-box pre {
      background: white;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      margin: 10px 0;
      border: 1px solid #dadce0;
    }
    
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #1a73e8;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
      margin: 10px 10px 10px 0;
      transition: background 0.3s;
    }
    
    .button:hover {
      background: #1557b0;
    }
    
    .button.secondary {
      background: white;
      color: #1a73e8;
      border: 1px solid #dadce0;
    }
    
    .button.secondary:hover {
      background: #f8f9fa;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 20px 0;
    }
    
    .metric {
      background: white;
      border: 1px solid #e8eaed;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    
    .metric .value {
      font-size: 24px;
      font-weight: 500;
      color: #1a73e8;
    }
    
    .metric .label {
      font-size: 14px;
      color: #5f6368;
      margin-top: 5px;
    }
    
    .feature-list {
      list-style: none;
      padding: 0;
      margin: 15px 0;
    }
    
    .feature-list li {
      padding: 10px 0 10px 35px;
      position: relative;
      border-bottom: 1px solid #f1f3f4;
    }
    
    .feature-list li:last-child {
      border-bottom: none;
    }
    
    .feature-list li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #34a853;
      font-weight: bold;
      font-size: 18px;
    }
    
    .label-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin: 15px 0;
    }
    
    .label {
      display: inline-block;
      padding: 6px 12px;
      background: #e8f0fe;
      color: #1967d2;
      border-radius: 16px;
      font-size: 14px;
      text-align: center;
    }
    
    .label.urgent {
      background: #fce8e6;
      color: #d33b3b;
    }
    
    .label.success {
      background: #e6f4ea;
      color: #137333;
    }
    
    .tip-box {
      background: #e8f0fe;
      border-left: 4px solid #1a73e8;
      padding: 15px;
      margin: 20px 0;
    }
    
    .tip-box h3 {
      margin: 0 0 10px 0;
      color: #1a73e8;
      font-size: 16px;
    }
    
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e8eaed;
    }
    
    .footer p {
      margin: 5px 0;
      color: #5f6368;
      font-size: 14px;
    }
    
    .footer a {
      color: #1a73e8;
      text-decoration: none;
    }
    
    code {
      background: #f1f3f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
    }
    
    @media (max-width: 600px) {
      .content {
        padding: 20px;
      }
      
      .metrics-grid {
        grid-template-columns: 1fr;
      }
      
      .button {
        display: block;
        text-align: center;
        margin: 10px 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="emoji">🎉</span>
      <h1>Your Gmail Support System is Live!</h1>
    </div>
    
    <div class="content">
      <div class="status-banner">
        <span class="icon" style="background: #34a853;"></span>
        STATUS: ACTIVE - System is processing emails
      </div>
      
      <p style="font-size: 18px;">Hi ${userName}! 👋</p>
      
      <p>Great news! Your AI-powered support system is now active and monitoring your Gmail. 
      It's already set up to handle customer emails automatically.</p>
      
      <div class="metrics-grid">
        <div class="metric">
          <div class="value">5 min</div>
          <div class="label">Check Interval</div>
        </div>
        <div class="metric">
          <div class="value">< 2 min</div>
          <div class="label">Avg Response Time</div>
        </div>
        <div class="metric">
          <div class="value">24/7</div>
          <div class="label">Availability</div>
        </div>
        <div class="metric">
          <div class="value">∞</div>
          <div class="label">Emails/Day</div>
        </div>
      </div>
      
      <h2><span class="icon">🧪</span>Test Your System</h2>
      
      <div class="test-box">
        <p><strong>Send yourself this test email:</strong></p>
        <pre>To: ${email}
Subject: Test - Password Reset Help
Body: 
Hi, I forgot my password and need help resetting it. 
My username is testuser123. 
Thanks!</pre>
        <p>⏱️ <strong>Expected result:</strong> AI response within 5 minutes</p>
      </div>
      
      <h2><span class="icon">🎮</span>Your Control Center</h2>
      
      <div class="card">
        <h3 style="margin-top: 0;">🌐 Web Dashboard</h3>
        <p>Monitor tickets, view metrics, and manage your support system.</p>
        <a href="${webAppUrl}" class="button">Open Dashboard</a>
        
        <h3 style="margin-top: 25px;">📚 Knowledge Base</h3>
        <p>Add FAQs and common answers to improve AI responses.</p>
        <a href="${kbUrl}" class="button secondary">Edit Knowledge Base</a>
        
        <h3 style="margin-top: 25px;">🎨 AI Customization</h3>
        <p>Change response tone, categories, and behavior.</p>
        <p><code>Extensions → Gmail Support → Edit AI Prompts</code></p>
      </div>
      
      <h2><span class="icon">🏷️</span>Your Gmail Labels</h2>
      
      <p>We've organized your Gmail with these labels:</p>
      
      <div class="label-grid">
        <span class="label success">✅ Support</span>
        <span class="label">📥 New</span>
        <span class="label">🔄 In-Progress</span>
        <span class="label success">✓ Resolved</span>
        <span class="label urgent">⚡ Escalated</span>
        <span class="label">💻 Technical</span>
        <span class="label">💰 Billing</span>
        <span class="label">🤖 AI-Processed</span>
      </div>
      
      <h2><span class="icon">✅</span>What's Working Now</h2>
      
      <ul class="feature-list">
        <li><strong>Email Monitoring:</strong> Checking every 5 minutes for new support emails</li>
        <li><strong>AI Analysis:</strong> Understanding intent, urgency, and sentiment</li>
        <li><strong>Smart Responses:</strong> Generating helpful replies using your knowledge base</li>
        <li><strong>Ticket Creation:</strong> Tracking every conversation with unique IDs</li>
        <li><strong>SLA Tracking:</strong> Monitoring response and resolution times</li>
        <li><strong>Auto-Escalation:</strong> Flagging complex issues for human review</li>
      </ul>
      
      <div class="tip-box">
        <h3>💡 Pro Tip: Make it Smarter</h3>
        <p>The more knowledge base articles you add, the better your AI becomes. 
        Start by adding your top 10 most common customer questions.</p>
      </div>
      
      <h2><span class="icon">📈</span>Next Steps</h2>
      
      <div class="card">
        <h3 style="margin-top: 0;">Your First Week Checklist:</h3>
        <ul class="feature-list">
          <li><strong>Day 1:</strong> Send test emails to verify everything works</li>
          <li><strong>Day 2-3:</strong> Add 10+ knowledge base articles</li>
          <li><strong>Day 4-5:</strong> Customize AI prompts for your tone</li>
          <li><strong>Day 6-7:</strong> Review metrics and optimize</li>
        </ul>
      </div>
      
      <h2><span class="icon">🆘</span>Need Help?</h2>
      
      <p>We're here to help you succeed:</p>
      
      <div style="margin: 20px 0;">
        <a href="https://github.com/franzenzenhofer/gmail-support-apps-script/blob/main/GETTING_STARTED.md" class="button secondary">📖 Documentation</a>
        <a href="https://github.com/franzenzenhofer/gmail-support-apps-script/blob/main/PROMPT_CUSTOMIZATION_GUIDE.md" class="button secondary">🎨 Customization Guide</a>
        <a href="https://github.com/franzenzenhofer/gmail-support-apps-script/issues" class="button secondary">🐛 Report Issue</a>
      </div>
      
      <p>Or simply reply to this email with any questions!</p>
      
      <div class="card" style="background: #e8f5e9; border-color: #34a853;">
        <p style="margin: 0; text-align: center; font-size: 18px;">
          <strong>🚀 Your first customer email could arrive any moment!</strong><br>
          <span style="font-size: 16px; color: #5f6368;">The system is ready and waiting.</span>
        </p>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Gmail Support System v1.0</strong></p>
      <p>Powered by Google Apps Script & Gemini AI</p>
      <p>Installed on ${currentTime}</p>
      <p><a href="https://github.com/franzenzenhofer/gmail-support-apps-script">GitHub</a> • 
         <a href="mailto:${email}">Support</a></p>
    </div>
  </div>
</body>
</html>
  `;
  
  // Send the email
  GmailApp.sendEmail(
    email,
    '🎉 Your Gmail Support System is Live! - Welcome & Setup Guide',
    `Your AI-powered support system is now active! 
    
    View this email in HTML format for the complete setup guide and next steps.
    
    Quick Test: Send yourself an email with a support question and watch the magic happen!
    
    Dashboard: ${webAppUrl}
    Knowledge Base: ${kbUrl}
    
    Need help? Just reply to this email!`,
    {
      htmlBody: htmlBody,
      name: 'Gmail Support System',
      replyTo: email
    }
  );
  
  console.log('✅ Welcome email sent to: ' + email);
}

/**
 * Replace the old sendWelcomeEmail with the improved version
 */
function upgradeWelcomeEmail() {
  // Backup old function
  const oldSendWelcomeEmail = sendWelcomeEmail;
  
  // Replace with new version
  sendWelcomeEmail = sendImprovedWelcomeEmail;
  
  console.log('✅ Welcome email upgraded to improved version');
}