/**
 * Support Manager Dashboard
 * 
 * Use Case: Team leaders monitoring performance and SLAs
 * Features: Team metrics, SLA monitoring, workload distribution, escalations
 */

// Configuration for Managers
const MANAGER_CONFIG = {
  teamSize: 10,
  slaWarningThreshold: 0.8, // 80% of SLA time
  workloadBalanceThreshold: 1.5, // 50% more than average
  reportingInterval: 'daily',
  criticalMetrics: ['responseTime', 'resolutionTime', 'satisfaction', 'slaCompliance']
};

/**
 * Main dashboard for support managers
 */
function managerDashboard() {
  console.log('👔 Support Manager Dashboard');
  console.log('===========================\n');
  
  // Get team overview
  const teamStats = getTeamStatistics();
  displayTeamOverview(teamStats);
  
  // Check SLA compliance
  const slaStatus = checkSLACompliance();
  displaySLAStatus(slaStatus);
  
  // Monitor workload distribution
  const workload = analyzeWorkloadDistribution();
  displayWorkloadAnalysis(workload);
  
  // Review escalations
  const escalations = getRecentEscalations();
  displayEscalations(escalations);
  
  // Generate recommendations
  const recommendations = generateManagerRecommendations(teamStats, slaStatus, workload);
  displayRecommendations(recommendations);
}

/**
 * Get team statistics
 */
function getTeamStatistics() {
  const agents = Config.get('support.agents') || [];
  const stats = {
    totalAgents: agents.length,
    totalTickets: 0,
    openTickets: 0,
    resolvedToday: 0,
    avgResponseTime: 0,
    avgResolutionTime: 0,
    customerSatisfaction: 0,
    agentPerformance: []
  };
  
  // Get stats for each agent
  agents.forEach(agentEmail => {
    const agentTickets = Tickets.searchTickets('', {
      assignedTo: agentEmail,
      limit: 100
    }).tickets;
    
    const agentStats = {
      email: agentEmail,
      name: agentEmail.split('@')[0],
      totalTickets: agentTickets.length,
      openTickets: agentTickets.filter(t => t.status === 'open').length,
      resolvedToday: agentTickets.filter(t => 
        t.resolvedAt && 
        new Date(t.resolvedAt).toDateString() === new Date().toDateString()
      ).length,
      avgResponseTime: calculateAvgResponseTime(agentTickets),
      satisfaction: calculateSatisfactionScore(agentTickets)
    };
    
    stats.agentPerformance.push(agentStats);
    stats.totalTickets += agentStats.totalTickets;
    stats.openTickets += agentStats.openTickets;
    stats.resolvedToday += agentStats.resolvedToday;
  });
  
  // Calculate team averages
  if (stats.agentPerformance.length > 0) {
    stats.avgResponseTime = Math.round(
      stats.agentPerformance.reduce((sum, a) => sum + a.avgResponseTime, 0) / 
      stats.agentPerformance.length
    );
    stats.customerSatisfaction = 
      stats.agentPerformance.reduce((sum, a) => sum + a.satisfaction, 0) / 
      stats.agentPerformance.length;
  }
  
  return stats;
}

/**
 * Check SLA compliance
 */
function checkSLACompliance() {
  const allTickets = Tickets.getAllTickets();
  const now = new Date();
  
  const slaStatus = {
    total: allTickets.length,
    compliant: 0,
    breached: 0,
    atRisk: 0,
    byPriority: {
      urgent: { total: 0, breached: 0 },
      high: { total: 0, breached: 0 },
      medium: { total: 0, breached: 0 },
      low: { total: 0, breached: 0 }
    }
  };
  
  allTickets.forEach(ticket => {
    const priority = ticket.priority || 'medium';
    slaStatus.byPriority[priority].total++;
    
    if (ticket.sla.breached) {
      slaStatus.breached++;
      slaStatus.byPriority[priority].breached++;
    } else if (ticket.sla.responseTarget) {
      const target = new Date(ticket.sla.responseTarget);
      const timeRemaining = (target - now) / (target - new Date(ticket.createdAt));
      
      if (timeRemaining < (1 - MANAGER_CONFIG.slaWarningThreshold)) {
        slaStatus.atRisk++;
      } else {
        slaStatus.compliant++;
      }
    }
  });
  
  slaStatus.complianceRate = 
    slaStatus.total > 0 ? 
      ((slaStatus.compliant / slaStatus.total) * 100).toFixed(1) : 100;
  
  return slaStatus;
}

/**
 * Analyze workload distribution
 */
function analyzeWorkloadDistribution() {
  const teamStats = getTeamStatistics();
  const avgWorkload = teamStats.openTickets / teamStats.totalAgents;
  
  const distribution = {
    avgTicketsPerAgent: avgWorkload,
    overloaded: [],
    underutilized: [],
    balanced: [],
    recommendations: []
  };
  
  teamStats.agentPerformance.forEach(agent => {
    const workloadRatio = agent.openTickets / avgWorkload;
    
    if (workloadRatio > MANAGER_CONFIG.workloadBalanceThreshold) {
      distribution.overloaded.push({
        ...agent,
        workloadRatio: workloadRatio.toFixed(2)
      });
    } else if (workloadRatio < 0.5) {
      distribution.underutilized.push({
        ...agent,
        workloadRatio: workloadRatio.toFixed(2)
      });
    } else {
      distribution.balanced.push(agent);
    }
  });
  
  // Generate redistribution recommendations
  if (distribution.overloaded.length > 0 && distribution.underutilized.length > 0) {
    distribution.recommendations.push({
      action: 'redistribute',
      from: distribution.overloaded.map(a => a.name),
      to: distribution.underutilized.map(a => a.name),
      ticketsToMove: Math.ceil(
        (distribution.overloaded[0].openTickets - avgWorkload) / 2
      )
    });
  }
  
  return distribution;
}

/**
 * Get recent escalations
 */
function getRecentEscalations() {
  const escalatedTickets = Tickets.searchTickets('', {
    status: 'escalated',
    limit: 20
  }).tickets;
  
  const escalations = {
    total: escalatedTickets.length,
    byReason: {},
    byCategory: {},
    avgTimeToEscalation: 0,
    tickets: []
  };
  
  let totalEscalationTime = 0;
  
  escalatedTickets.forEach(ticket => {
    // Count by category
    const category = ticket.category || 'general';
    escalations.byCategory[category] = (escalations.byCategory[category] || 0) + 1;
    
    // Calculate time to escalation
    const escalationTime = 
      (new Date(ticket.updatedAt) - new Date(ticket.createdAt)) / (1000 * 60 * 60);
    totalEscalationTime += escalationTime;
    
    // Get escalation reasons from history
    const escalationEntry = ticket.history.find(h => h.action === 'escalated');
    if (escalationEntry?.details?.reasons) {
      escalationEntry.details.reasons.forEach(reason => {
        escalations.byReason[reason] = (escalations.byReason[reason] || 0) + 1;
      });
    }
    
    escalations.tickets.push({
      id: ticket.id,
      customer: ticket.customerEmail,
      subject: ticket.subject,
      category: category,
      timeToEscalation: escalationTime.toFixed(1) + ' hours',
      assignedTo: ticket.assignedTo
    });
  });
  
  if (escalations.total > 0) {
    escalations.avgTimeToEscalation = 
      (totalEscalationTime / escalations.total).toFixed(1);
  }
  
  return escalations;
}

/**
 * Generate manager recommendations
 */
function generateManagerRecommendations(teamStats, slaStatus, workload) {
  const recommendations = [];
  
  // SLA recommendations
  if (slaStatus.complianceRate < 90) {
    recommendations.push({
      priority: 'high',
      type: 'sla',
      message: `SLA compliance at ${slaStatus.complianceRate}% - immediate action needed`,
      actions: [
        'Review tickets at risk of breaching SLA',
        'Consider reassigning urgent tickets from overloaded agents',
        'Enable auto-escalation for high-priority tickets'
      ]
    });
  }
  
  // Workload recommendations
  if (workload.overloaded.length > 0) {
    recommendations.push({
      priority: 'medium',
      type: 'workload',
      message: `${workload.overloaded.length} agents are overloaded`,
      actions: workload.recommendations.map(r => 
        `Move ${r.ticketsToMove} tickets from ${r.from.join(', ')} to ${r.to.join(', ')}`
      )
    });
  }
  
  // Performance recommendations
  const lowPerformers = teamStats.agentPerformance.filter(a => 
    a.satisfaction < 3.5 || a.avgResponseTime > 120
  );
  
  if (lowPerformers.length > 0) {
    recommendations.push({
      priority: 'medium',
      type: 'performance',
      message: `${lowPerformers.length} agents need performance coaching`,
      actions: lowPerformers.map(a => 
        `Review ${a.name}'s tickets - Satisfaction: ${a.satisfaction}, Response time: ${a.avgResponseTime}min`
      )
    });
  }
  
  // Staffing recommendations
  if (teamStats.openTickets / teamStats.totalAgents > 15) {
    recommendations.push({
      priority: 'low',
      type: 'staffing',
      message: 'Consider adding more agents to the team',
      actions: [
        `Current ratio: ${(teamStats.openTickets / teamStats.totalAgents).toFixed(1)} tickets per agent`,
        'Recommended ratio: 10-12 tickets per agent',
        `Additional agents needed: ${Math.ceil((teamStats.openTickets / 12) - teamStats.totalAgents)}`
      ]
    });
  }
  
  return recommendations;
}

/**
 * Display functions
 */
function displayTeamOverview(stats) {
  console.log('📊 Team Overview');
  console.log('================');
  console.log(`Total Agents: ${stats.totalAgents}`);
  console.log(`Open Tickets: ${stats.openTickets}`);
  console.log(`Resolved Today: ${stats.resolvedToday}`);
  console.log(`Avg Response Time: ${stats.avgResponseTime} minutes`);
  console.log(`Customer Satisfaction: ${stats.customerSatisfaction.toFixed(1)}/5`);
  console.log('');
}

function displaySLAStatus(slaStatus) {
  console.log('⏱️  SLA Compliance');
  console.log('==================');
  console.log(`Overall Compliance: ${slaStatus.complianceRate}%`);
  console.log(`Breached: ${slaStatus.breached}`);
  console.log(`At Risk: ${slaStatus.atRisk}`);
  console.log('\nBy Priority:');
  Object.keys(slaStatus.byPriority).forEach(priority => {
    const stats = slaStatus.byPriority[priority];
    if (stats.total > 0) {
      console.log(`  ${priority}: ${stats.breached}/${stats.total} breached`);
    }
  });
  console.log('');
}

function displayWorkloadAnalysis(workload) {
  console.log('⚖️  Workload Distribution');
  console.log('========================');
  console.log(`Average tickets/agent: ${workload.avgTicketsPerAgent.toFixed(1)}`);
  console.log(`Overloaded agents: ${workload.overloaded.length}`);
  console.log(`Underutilized agents: ${workload.underutilized.length}`);
  
  if (workload.overloaded.length > 0) {
    console.log('\nOverloaded:');
    workload.overloaded.forEach(agent => {
      console.log(`  - ${agent.name}: ${agent.openTickets} tickets (${agent.workloadRatio}x average)`);
    });
  }
  console.log('');
}

function displayEscalations(escalations) {
  console.log('🚨 Recent Escalations');
  console.log('====================');
  console.log(`Total: ${escalations.total}`);
  console.log(`Avg time to escalation: ${escalations.avgTimeToEscalation} hours`);
  
  if (Object.keys(escalations.byReason).length > 0) {
    console.log('\nTop reasons:');
    Object.entries(escalations.byReason)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([reason, count]) => {
        console.log(`  - ${reason}: ${count}`);
      });
  }
  console.log('');
}

function displayRecommendations(recommendations) {
  if (recommendations.length === 0) {
    console.log('✅ No critical issues detected\n');
    return;
  }
  
  console.log('💡 Recommendations');
  console.log('==================');
  
  recommendations
    .sort((a, b) => {
      const priority = { high: 3, medium: 2, low: 1 };
      return priority[b.priority] - priority[a.priority];
    })
    .forEach(rec => {
      console.log(`\n[${rec.priority.toUpperCase()}] ${rec.message}`);
      rec.actions.forEach(action => {
        console.log(`  • ${action}`);
      });
    });
}

/**
 * Manager actions
 */
const managerActions = {
  // Redistribute tickets
  redistributeTickets: function(fromAgent, toAgent, count) {
    const tickets = Tickets.searchTickets('', {
      assignedTo: fromAgent,
      status: 'open',
      limit: count
    }).tickets;
    
    tickets.forEach(ticket => {
      Tickets.updateTicket(ticket.id, {
        assignedTo: toAgent
      }, 'manager');
    });
    
    console.log(`Redistributed ${tickets.length} tickets from ${fromAgent} to ${toAgent}`);
  },
  
  // Generate team report
  generateTeamReport: function() {
    const report = Metrics.generatePerformanceReport({
      timeRange: '7d',
      format: 'html',
      sections: ['overview', 'tickets', 'performance', 'customer']
    });
    
    // Save to Drive
    const file = DriveApp.createFile(
      `Team_Report_${new Date().toISOString().split('T')[0]}.html`,
      report.report,
      MimeType.HTML
    );
    
    console.log(`Report saved: ${file.getUrl()}`);
    return file;
  },
  
  // Set team goals
  setTeamGoals: function(goals) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('team_goals', JSON.stringify({
      ...goals,
      setDate: new Date().toISOString(),
      setBy: Session.getActiveUser().getEmail()
    }));
    
    console.log('Team goals updated');
  }
};

// Run the manager dashboard
function runManagerDashboard() {
  managerDashboard();
  
  console.log('\n🛠️  Available Actions:');
  console.log('- managerActions.redistributeTickets(fromAgent, toAgent, count)');
  console.log('- managerActions.generateTeamReport()');
  console.log('- managerActions.setTeamGoals({responseTime: 30, satisfaction: 4.5})');
}