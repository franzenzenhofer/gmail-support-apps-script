/**
 * MetricsService.gs - Analytics and Reporting
 * 
 * Comprehensive analytics for support system performance
 * Real-time metrics with business intelligence
 */

class MetricsService {
  constructor() {
    this.config = Config.get('metrics');
    this.cache = CacheService.getScriptCache();
    this.sheets = this.initializeSheets();
  }

  /**
   * Record support metrics
   */
  recordMetric(type, data) {
    try {
      const metric = {
        id: Utilities.getUuid(),
        type: type,
        timestamp: new Date().toISOString(),
        data: data,
        session: this.getSessionId()
      };
      
      // Store in properties
      const props = PropertiesService.getScriptProperties();
      props.setProperty(`metric_${metric.id}`, JSON.stringify(metric));
      
      // Update real-time counters
      this.updateCounters(type, data);
      
      // Cache for dashboard
      this.updateDashboardCache(type, data);
      
      logDebug('Metric recorded', { type, id: metric.id });
      
      return metric.id;
      
    } catch (error) {
      logError('Failed to record metric', { type, error: error.message });
    }
  }

  /**
   * Get comprehensive dashboard metrics
   */
  getDashboardMetrics(timeRange = '24h') {
    profile('metrics_dashboard');
    
    try {
      const metrics = {
        overview: this.getOverviewMetrics(timeRange),
        tickets: this.getTicketMetrics(timeRange),
        performance: this.getPerformanceMetrics(timeRange),
        ai: this.getAIMetrics(timeRange),
        customer: this.getCustomerMetrics(timeRange),
        trends: this.getTrendMetrics(timeRange)
      };
      
      profileEnd('metrics_dashboard');
      return metrics;
      
    } catch (error) {
      profileEnd('metrics_dashboard');
      throw handleError(error, { operation: 'getDashboardMetrics' });
    }
  }

  /**
   * Get overview metrics
   */
  getOverviewMetrics(timeRange) {
    const tickets = this.getTicketsInRange(timeRange);
    
    return {
      totalTickets: tickets.length,
      openTickets: tickets.filter(t => ['new', 'open', 'in_progress'].includes(t.status)).length,
      resolvedTickets: tickets.filter(t => t.status === 'resolved').length,
      avgResponseTime: this.calculateAvgResponseTime(tickets),
      avgResolutionTime: this.calculateAvgResolutionTime(tickets),
      customerSatisfaction: this.calculateSatisfactionScore(tickets),
      slaCompliance: this.calculateSLACompliance(tickets),
      currentLoad: this.getCurrentSystemLoad()
    };
  }

  /**
   * Get ticket metrics
   */
  getTicketMetrics(timeRange) {
    const tickets = this.getTicketsInRange(timeRange);
    
    const byStatus = this.groupBy(tickets, 'status');
    const byPriority = this.groupBy(tickets, 'priority');
    const byCategory = this.groupBy(tickets, 'category');
    const byAgent = this.groupBy(tickets, 'assignedTo');
    
    return {
      byStatus: this.countGroups(byStatus),
      byPriority: this.countGroups(byPriority),
      byCategory: this.countGroups(byCategory),
      byAgent: this.countGroups(byAgent),
      escalated: tickets.filter(t => t.reopenedCount > 0).length,
      autoResolved: tickets.filter(t => t.metrics?.autoResolved).length,
      avgInteractions: this.calculateAvgInteractions(tickets)
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(timeRange) {
    const perfData = this.getPerformanceData(timeRange);
    
    return {
      emailProcessingTime: this.calculateAvgProcessingTime(perfData, 'email_processing'),
      aiAnalysisTime: this.calculateAvgProcessingTime(perfData, 'ai_analysis'),
      knowledgeSearchTime: this.calculateAvgProcessingTime(perfData, 'knowledge_search'),
      autoReplyTime: this.calculateAvgProcessingTime(perfData, 'auto_reply'),
      systemHealth: this.getSystemHealth(),
      errorRate: this.calculateErrorRate(timeRange),
      throughput: this.calculateThroughput(timeRange),
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Get AI metrics
   */
  getAIMetrics(timeRange) {
    const aiData = this.getAIData(timeRange);
    
    return {
      totalRequests: aiData.length,
      avgConfidence: this.calculateAvgConfidence(aiData),
      byOperation: this.groupAIByOperation(aiData),
      sentimentDistribution: this.getSentimentDistribution(aiData),
      categoryAccuracy: this.getCategoryAccuracy(aiData),
      tokenUsage: this.getTokenUsage(aiData),
      costEstimate: this.calculateAICost(aiData),
      errorRate: this.calculateAIErrorRate(aiData)
    };
  }

  /**
   * Get customer metrics
   */
  getCustomerMetrics(timeRange) {
    const tickets = this.getTicketsInRange(timeRange);
    const customers = this.getUniqueCustomers(tickets);
    
    return {
      uniqueCustomers: customers.length,
      newCustomers: this.getNewCustomers(tickets, timeRange).length,
      returningCustomers: this.getReturningCustomers(tickets, timeRange).length,
      vipCustomers: customers.filter(c => c.vip).length,
      avgTicketsPerCustomer: tickets.length / customers.length,
      topCustomers: this.getTopCustomers(tickets, 10),
      satisfactionBySegment: this.getSatisfactionBySegment(tickets),
      churnRisk: this.identifyChurnRisk(customers)
    };
  }

  /**
   * Get trend metrics
   */
  getTrendMetrics(timeRange) {
    const currentPeriod = this.getTicketsInRange(timeRange);
    const previousPeriod = this.getTicketsInRange(this.getPreviousPeriod(timeRange));
    
    return {
      ticketGrowth: this.calculateGrowth(currentPeriod.length, previousPeriod.length),
      responseTimeGrowth: this.calculateGrowth(
        this.calculateAvgResponseTime(currentPeriod),
        this.calculateAvgResponseTime(previousPeriod)
      ),
      resolutionTimeGrowth: this.calculateGrowth(
        this.calculateAvgResolutionTime(currentPeriod),
        this.calculateAvgResolutionTime(previousPeriod)
      ),
      satisfactionGrowth: this.calculateGrowth(
        this.calculateSatisfactionScore(currentPeriod),
        this.calculateSatisfactionScore(previousPeriod)
      ),
      hourlyDistribution: this.getHourlyDistribution(currentPeriod),
      dailyDistribution: this.getDailyDistribution(currentPeriod),
      predictions: this.generatePredictions(currentPeriod)
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(options = {}) {
    const {
      timeRange = '7d',
      format = 'html',
      includeCharts = true,
      sections = ['overview', 'tickets', 'performance', 'ai', 'customer']
    } = options;
    
    const metrics = this.getDashboardMetrics(timeRange);
    
    let report = '';
    
    if (format === 'html') {
      report = this.generateHTMLReport(metrics, sections, includeCharts);
    } else if (format === 'csv') {
      report = this.generateCSVReport(metrics, sections);
    } else {
      report = this.generateTextReport(metrics, sections);
    }
    
    return {
      report: report,
      format: format,
      generated: new Date().toISOString(),
      timeRange: timeRange,
      sections: sections
    };
  }

  /**
   * Get real-time system health
   */
  getSystemHealth() {
    return {
      status: 'healthy',
      uptime: this.getUptime(),
      lastCheck: new Date().toISOString(),
      services: {
        email: this.checkEmailService(),
        ai: this.checkAIService(),
        knowledgeBase: this.checkKnowledgeBaseService(),
        database: this.checkDatabaseService()
      },
      performance: {
        avgResponseTime: this.getAvgResponseTime(),
        errorRate: this.getErrorRate(),
        throughput: this.getThroughput()
      }
    };
  }

  /**
   * Export metrics data
   */
  exportMetrics(format = 'json', timeRange = '30d') {
    const data = {
      overview: this.getDashboardMetrics(timeRange),
      rawData: this.getRawMetrics(timeRange),
      metadata: {
        exported: new Date().toISOString(),
        timeRange: timeRange,
        totalRecords: this.getRawMetrics(timeRange).length
      }
    };
    
    switch (format) {
      case 'csv':
        return this.convertToCSV(data);
      case 'xml':
        return this.convertToXML(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Helper methods
   */
  
  getTicketsInRange(timeRange) {
    const { start, end } = this.parseTimeRange(timeRange);
    return Tickets.searchTickets('', {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      limit: 1000
    }).tickets;
  }

  parseTimeRange(timeRange) {
    const now = new Date();
    const end = new Date(now);
    let start;
    
    if (timeRange.endsWith('h')) {
      const hours = parseInt(timeRange);
      start = new Date(now.getTime() - hours * 60 * 60 * 1000);
    } else if (timeRange.endsWith('d')) {
      const days = parseInt(timeRange);
      start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    } else if (timeRange.endsWith('w')) {
      const weeks = parseInt(timeRange);
      start = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    } else {
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default 24h
    }
    
    return { start, end };
  }

  calculateAvgResponseTime(tickets) {
    const responseTimes = tickets
      .filter(t => t.metrics.responseTime)
      .map(t => t.metrics.responseTime);
    
    return responseTimes.length > 0 
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;
  }

  calculateAvgResolutionTime(tickets) {
    const resolutionTimes = tickets
      .filter(t => t.metrics.resolutionTime)
      .map(t => t.metrics.resolutionTime);
    
    return resolutionTimes.length > 0
      ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
      : 0;
  }

  calculateSatisfactionScore(tickets) {
    const scores = tickets
      .filter(t => t.metrics.satisfactionScore)
      .map(t => t.metrics.satisfactionScore);
    
    return scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0;
  }

  calculateSLACompliance(tickets) {
    const compliant = tickets.filter(t => !t.sla.breached).length;
    return tickets.length > 0 ? Math.round((compliant / tickets.length) * 100) : 100;
  }

  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const value = item[key] || 'unassigned';
      groups[value] = groups[value] || [];
      groups[value].push(item);
      return groups;
    }, {});
  }

  countGroups(groups) {
    const result = {};
    Object.keys(groups).forEach(key => {
      result[key] = groups[key].length;
    });
    return result;
  }

  calculateGrowth(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  updateCounters(type, data) {
    const key = `counter_${type}_${this.getDateKey()}`;
    const current = parseInt(this.cache.get(key) || '0');
    this.cache.put(key, (current + 1).toString(), 86400); // 24 hours
  }

  getDateKey() {
    return new Date().toISOString().split('T')[0];
  }

  getSessionId() {
    let sessionId = this.cache.get('session_id');
    if (!sessionId) {
      sessionId = Utilities.getUuid();
      this.cache.put('session_id', sessionId, 86400);
    }
    return sessionId;
  }

  initializeSheets() {
    // Initialize Google Sheets for metrics storage if configured
    if (this.config.useSheets) {
      // Implementation for Sheets integration
    }
    return null;
  }
}

// Create singleton instance
const Metrics = new MetricsService();

// Convenience functions
function recordMetric(type, data) {
  return Metrics.recordMetric(type, data);
}

function getDashboardMetrics(timeRange) {
  return Metrics.getDashboardMetrics(timeRange);
}

function generatePerformanceReport(options) {
  return Metrics.generatePerformanceReport(options);
}

function getSystemHealth() {
  return Metrics.getSystemHealth();
}

function exportMetrics(format, timeRange) {
  return Metrics.exportMetrics(format, timeRange);
}