/**
 * IT Helpdesk Specialist
 * 
 * Use Case: Internal IT support for password resets, access requests, technical issues
 * Features: Automated password resets, asset tracking, software provisioning
 */

// IT Helpdesk Configuration
const IT_CONFIG = {
  categories: ['password_reset', 'access_request', 'hardware', 'software', 'network'],
  autoActions: {
    password_reset: true,
    software_install: true,
    access_provisioning: false // Requires approval
  },
  commonIssues: {
    password: ['forgot password', 'locked out', 'reset password', 'can\'t login'],
    vpn: ['vpn not working', 'cannot connect', 'remote access'],
    email: ['email not working', 'outlook issues', 'can\'t send email'],
    printer: ['printer not working', 'cannot print', 'printer offline']
  },
  assetDatabase: 'IT_Assets_Sheet_ID', // Google Sheets ID
  ldapEnabled: false // Set to true if using LDAP/AD
};

/**
 * IT Helpdesk main function
 */
function itHelpdeskProcessor() {
  console.log('🔧 IT Helpdesk Ticket Processor');
  console.log('================================\n');
  
  // Process IT support emails
  const itTickets = getITSupportTickets();
  
  itTickets.forEach(ticket => {
    try {
      processITTicket(ticket);
    } catch (error) {
      logError('IT ticket processing failed', {
        ticketId: ticket.id,
        error: error.message
      });
    }
  });
  
  // Check for automated actions
  runAutomatedITActions();
  
  // Generate IT metrics
  displayITMetrics();
}

/**
 * Get IT support tickets
 */
function getITSupportTickets() {
  return Tickets.searchTickets('', {
    category: 'technical',
    status: 'new',
    limit: 50
  }).tickets.filter(ticket => isITRelated(ticket));
}

/**
 * Check if ticket is IT-related
 */
function isITRelated(ticket) {
  const content = `${ticket.subject} ${ticket.description}`.toLowerCase();
  
  // Check against common IT issues
  for (const [category, keywords] of Object.entries(IT_CONFIG.commonIssues)) {
    if (keywords.some(keyword => content.includes(keyword))) {
      return true;
    }
  }
  
  // Check for IT-specific terms
  const itTerms = ['computer', 'laptop', 'software', 'hardware', 'network', 
                   'server', 'database', 'application', 'system', 'IT'];
  
  return itTerms.some(term => content.includes(term));
}

/**
 * Process IT ticket with automated solutions
 */
function processITTicket(ticket) {
  console.log(`\n🎫 Processing IT Ticket: ${ticket.id}`);
  console.log(`User: ${ticket.customerEmail}`);
  console.log(`Issue: ${ticket.subject}`);
  
  // Categorize the issue
  const category = categorizeITIssue(ticket);
  console.log(`Category: ${category}`);
  
  // Check for automated solution
  if (IT_CONFIG.autoActions[category]) {
    const result = executeAutomatedSolution(ticket, category);
    if (result.success) {
      console.log(`✅ Automated solution applied: ${result.action}`);
      
      // Send confirmation email
      sendITResolutionEmail(ticket, result);
      
      // Update and close ticket
      Tickets.updateTicket(ticket.id, {
        status: 'resolved',
        resolution: result.action,
        category: `it_${category}`
      }, 'it_automation');
      
      return;
    }
  }
  
  // Manual intervention needed
  handleManualITTicket(ticket, category);
}

/**
 * Categorize IT issue
 */
function categorizeITIssue(ticket) {
  const content = `${ticket.subject} ${ticket.description}`.toLowerCase();
  
  if (IT_CONFIG.commonIssues.password.some(kw => content.includes(kw))) {
    return 'password_reset';
  }
  
  if (content.includes('install') || content.includes('software')) {
    return 'software_install';
  }
  
  if (content.includes('access') || content.includes('permission')) {
    return 'access_request';
  }
  
  if (content.includes('hardware') || content.includes('computer') || content.includes('laptop')) {
    return 'hardware';
  }
  
  if (content.includes('network') || content.includes('internet') || content.includes('wifi')) {
    return 'network';
  }
  
  return 'general_it';
}

/**
 * Execute automated IT solution
 */
function executeAutomatedSolution(ticket, category) {
  switch (category) {
    case 'password_reset':
      return automatedPasswordReset(ticket);
    
    case 'software_install':
      return automatedSoftwareProvisioning(ticket);
    
    case 'access_request':
      return processAccessRequest(ticket);
    
    default:
      return { success: false };
  }
}

/**
 * Automated password reset
 */
function automatedPasswordReset(ticket) {
  const userEmail = ticket.customerEmail;
  
  // Generate temporary password
  const tempPassword = generateSecurePassword();
  
  // In real implementation, this would integrate with your identity provider
  // For demo, we'll simulate the process
  const resetResult = {
    success: true,
    action: 'Password reset completed',
    tempPassword: tempPassword,
    expiresIn: '24 hours',
    nextSteps: [
      'Check your email for the temporary password',
      'Login at https://portal.company.com',
      'You will be prompted to create a new password',
      'Password must be at least 12 characters with mixed case, numbers, and symbols'
    ]
  };
  
  // Log the action
  logSecurityAction('password_reset', {
    user: userEmail,
    ticketId: ticket.id,
    timestamp: new Date().toISOString()
  });
  
  return resetResult;
}

/**
 * Automated software provisioning
 */
function automatedSoftwareProvisioning(ticket) {
  // Extract software name from request
  const softwareRequest = extractSoftwareRequest(ticket);
  
  if (!softwareRequest) {
    return { success: false, reason: 'Could not identify software requested' };
  }
  
  // Check if software is in approved list
  const approvedSoftware = getApprovedSoftwareList();
  const software = approvedSoftware.find(s => 
    s.name.toLowerCase() === softwareRequest.toLowerCase()
  );
  
  if (!software) {
    return { success: false, reason: 'Software not in approved list' };
  }
  
  // Simulate provisioning
  const provisioningResult = {
    success: true,
    action: `${software.name} provisioning initiated`,
    software: software.name,
    version: software.version,
    license: generateLicenseKey(),
    installInstructions: software.installUrl || 'Check software portal',
    estimatedTime: '15-30 minutes'
  };
  
  // Update asset database
  updateAssetDatabase({
    user: ticket.customerEmail,
    software: software.name,
    licenseKey: provisioningResult.license,
    provisionedDate: new Date().toISOString()
  });
  
  return provisioningResult;
}

/**
 * Process access request
 */
function processAccessRequest(ticket) {
  const accessDetails = extractAccessDetails(ticket);
  
  if (!accessDetails) {
    return { success: false, reason: 'Could not parse access request details' };
  }
  
  // Check if auto-approval is allowed for this resource
  if (isAutoApprovable(accessDetails.resource)) {
    return {
      success: true,
      action: `Access granted to ${accessDetails.resource}`,
      accessLevel: accessDetails.level || 'read',
      effectiveDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      notes: 'Auto-approved based on policy'
    };
  }
  
  // Requires manual approval
  return {
    success: false,
    reason: 'Manual approval required',
    escalateTo: 'it_manager@company.com'
  };
}

/**
 * Handle manual IT ticket
 */
function handleManualITTicket(ticket, category) {
  console.log(`ℹ️  Manual intervention required for ${category}`);
  
  // Assign to appropriate IT staff
  const assignee = getITSpecialist(category);
  
  // Create detailed IT ticket
  const itDetails = gatherITDetails(ticket);
  
  // Update ticket with IT information
  Tickets.updateTicket(ticket.id, {
    assignedTo: assignee,
    category: `it_${category}`,
    customFields: {
      deviceInfo: itDetails.device,
      osVersion: itDetails.os,
      browserInfo: itDetails.browser,
      errorMessages: itDetails.errors,
      troubleshootingSteps: generateTroubleshootingSteps(category)
    }
  }, 'it_system');
  
  // Send initial response
  sendITAcknowledgment(ticket, category, assignee);
}

/**
 * Run automated IT actions
 */
function runAutomatedITActions() {
  console.log('\n🤖 Running Automated IT Actions...');
  
  // Check for expired passwords
  checkPasswordExpiry();
  
  // Monitor system health
  monitorSystemHealth();
  
  // Update software inventory
  updateSoftwareInventory();
  
  // Check license compliance
  checkLicenseCompliance();
}

/**
 * IT Metrics Display
 */
function displayITMetrics() {
  const metrics = calculateITMetrics();
  
  console.log('\n📊 IT Helpdesk Metrics');
  console.log('======================');
  console.log(`Total IT Tickets: ${metrics.totalTickets}`);
  console.log(`Automated Resolutions: ${metrics.automatedCount} (${metrics.automationRate}%)`);
  console.log(`Avg Resolution Time: ${metrics.avgResolutionTime} minutes`);
  console.log('\nTop Issues:');
  
  Object.entries(metrics.topIssues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([issue, count]) => {
      console.log(`  - ${issue}: ${count}`);
    });
}

/**
 * Helper Functions
 */

function generateSecurePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return password;
}

function generateLicenseKey() {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(
      Math.random().toString(36).substring(2, 6).toUpperCase()
    );
  }
  return segments.join('-');
}

function extractSoftwareRequest(ticket) {
  const content = ticket.description.toLowerCase();
  const commonSoftware = ['microsoft office', 'adobe creative', 'slack', 'zoom', 
                         'visual studio', 'intellij', 'photoshop', 'autocad'];
  
  for (const software of commonSoftware) {
    if (content.includes(software.toLowerCase())) {
      return software;
    }
  }
  
  // Try to extract from "install [software]" pattern
  const match = content.match(/install\s+(\w+(?:\s+\w+)?)/);
  return match ? match[1] : null;
}

function getApprovedSoftwareList() {
  return [
    { name: 'Microsoft Office', version: '365', installUrl: 'https://portal.office.com' },
    { name: 'Slack', version: 'Latest', installUrl: 'https://slack.com/downloads' },
    { name: 'Zoom', version: 'Latest', installUrl: 'https://zoom.us/download' },
    { name: 'Visual Studio Code', version: 'Latest', installUrl: 'https://code.visualstudio.com' },
    { name: 'Adobe Creative Cloud', version: '2024', requiresApproval: true }
  ];
}

function extractAccessDetails(ticket) {
  const content = ticket.description;
  
  // Look for common patterns
  const patterns = [
    /access to (.+?)(?:\s|$)/i,
    /permission for (.+?)(?:\s|$)/i,
    /need access to (.+?)(?:\s|$)/i
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return {
        resource: match[1].trim(),
        level: content.includes('admin') ? 'admin' : 'user'
      };
    }
  }
  
  return null;
}

function isAutoApprovable(resource) {
  const autoApprovable = ['sharepoint', 'teams', 'company wiki', 'training portal'];
  return autoApprovable.some(r => resource.toLowerCase().includes(r));
}

function getITSpecialist(category) {
  const specialists = {
    hardware: 'hardware-support@company.com',
    network: 'network-admin@company.com',
    software: 'software-support@company.com',
    access_request: 'it-security@company.com',
    general_it: 'it-helpdesk@company.com'
  };
  
  return specialists[category] || specialists.general_it;
}

function gatherITDetails(ticket) {
  // In real implementation, this would parse system information from the email
  return {
    device: 'Unknown',
    os: 'Unknown',
    browser: 'Unknown',
    errors: [],
    lastLogin: 'Unknown'
  };
}

function generateTroubleshootingSteps(category) {
  const steps = {
    password_reset: [
      'Verify user identity',
      'Check account status in AD',
      'Reset password',
      'Test login',
      'Confirm MFA setup'
    ],
    network: [
      'Check network connectivity',
      'Verify IP configuration',
      'Test DNS resolution',
      'Check firewall rules',
      'Verify VPN settings'
    ],
    software: [
      'Verify system requirements',
      'Check license availability',
      'Uninstall previous version',
      'Install latest version',
      'Verify functionality'
    ]
  };
  
  return steps[category] || ['Gather more information', 'Diagnose issue', 'Apply solution'];
}

function sendITResolutionEmail(ticket, result) {
  let emailBody = `Hello,

Your IT support request has been processed automatically.

${result.action}

`;

  if (result.tempPassword) {
    emailBody += `Temporary Password: ${result.tempPassword}
This password expires in: ${result.expiresIn}

`;
  }

  if (result.nextSteps) {
    emailBody += 'Next Steps:\n';
    result.nextSteps.forEach((step, index) => {
      emailBody += `${index + 1}. ${step}\n`;
    });
  }

  emailBody += `

If you need further assistance, please reply to this email.

Best regards,
IT Support Team`;

  Email.sendEmail(
    ticket.customerEmail,
    `Re: ${ticket.subject} [Resolved]`,
    emailBody
  );
}

function sendITAcknowledgment(ticket, category, assignee) {
  const emailBody = `Hello,

We've received your IT support request and it has been assigned to our ${category} specialist.

Ticket ID: ${ticket.id}
Category: ${category}
Assigned to: ${assignee}

We'll work on resolving your issue as quickly as possible. You can expect an update within 2-4 hours during business hours.

In the meantime, you might find these resources helpful:
- IT Self-Service Portal: https://it.company.com
- Knowledge Base: https://kb.company.com
- Status Page: https://status.company.com

Best regards,
IT Support Team`;

  Email.sendEmail(
    ticket.customerEmail,
    `Re: ${ticket.subject} [${ticket.id}]`,
    emailBody
  );
}

function calculateITMetrics() {
  const itTickets = Tickets.searchTickets('', {
    category: 'technical',
    limit: 1000
  }).tickets.filter(t => t.category?.startsWith('it_'));
  
  const metrics = {
    totalTickets: itTickets.length,
    automatedCount: itTickets.filter(t => t.resolution?.includes('Automated')).length,
    automationRate: 0,
    avgResolutionTime: 0,
    topIssues: {}
  };
  
  if (metrics.totalTickets > 0) {
    metrics.automationRate = Math.round(
      (metrics.automatedCount / metrics.totalTickets) * 100
    );
    
    // Calculate average resolution time
    const resolvedTickets = itTickets.filter(t => t.metrics.resolutionTime);
    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((sum, t) => sum + t.metrics.resolutionTime, 0);
      metrics.avgResolutionTime = Math.round(totalTime / resolvedTickets.length);
    }
    
    // Count top issues
    itTickets.forEach(ticket => {
      const category = ticket.category.replace('it_', '');
      metrics.topIssues[category] = (metrics.topIssues[category] || 0) + 1;
    });
  }
  
  return metrics;
}

function logSecurityAction(action, details) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action: action,
    ...details
  };
  
  // In production, this would write to a secure audit log
  console.log('[SECURITY LOG]', JSON.stringify(logEntry));
}

function updateAssetDatabase(assetInfo) {
  // In production, this would update your asset management system
  console.log('[ASSET UPDATE]', assetInfo);
}

// Additional monitoring functions
function checkPasswordExpiry() {
  // Check for passwords expiring in next 7 days
  console.log('Checking password expiry...');
}

function monitorSystemHealth() {
  // Monitor critical systems
  console.log('Monitoring system health...');
}

function updateSoftwareInventory() {
  // Update software inventory
  console.log('Updating software inventory...');
}

function checkLicenseCompliance() {
  // Verify license compliance
  console.log('Checking license compliance...');
}

/**
 * IT Actions for manual intervention
 */
const itActions = {
  // Remote assistance
  initiateRemoteSession: function(ticketId) {
    const ticket = Tickets.getTicket(ticketId);
    console.log(`Initiating remote session for ${ticket.customerEmail}`);
    // In production, this would create a remote support session
    return `Remote session link: https://remote.company.com/session/${ticketId}`;
  },
  
  // Asset assignment
  assignAsset: function(userEmail, assetType, assetId) {
    console.log(`Assigning ${assetType} (${assetId}) to ${userEmail}`);
    updateAssetDatabase({
      user: userEmail,
      assetType: assetType,
      assetId: assetId,
      assignedDate: new Date().toISOString()
    });
  },
  
  // Create service account
  createServiceAccount: function(purpose, owner) {
    const accountName = `svc_${purpose.toLowerCase().replace(/\s+/g, '_')}`;
    console.log(`Creating service account: ${accountName}`);
    return {
      accountName: accountName,
      owner: owner,
      created: new Date().toISOString(),
      expiresIn: '365 days'
    };
  }
};

// Run IT Helpdesk
function runITHelpdesk() {
  itHelpdeskProcessor();
  
  console.log('\n🛠️  IT Actions Available:');
  console.log('- itActions.initiateRemoteSession(ticketId)');
  console.log('- itActions.assignAsset(userEmail, assetType, assetId)');
  console.log('- itActions.createServiceAccount(purpose, owner)');
}