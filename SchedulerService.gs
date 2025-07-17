/**
 * SchedulerService.gs - Advanced Scheduling System
 * 
 * Flexible scheduling with adaptive intervals, business hours, and maintenance windows
 * Supports cron-like expressions and dynamic scheduling based on system load
 */

class SchedulerService {
  constructor() {
    this.config = Config.get('scheduling');
    this.cache = CacheService.getScriptCache();
    this.jobs = new Map();
    this.triggers = new Map();
    this.loadHistory = [];
  }

  /**
   * Initialize scheduler with all jobs
   */
  initializeScheduler() {
    profile('scheduler_init');
    
    try {
      // Clear existing triggers
      this.clearAllTriggers();
      
      // Set up core jobs
      this.setupCoreJobs();
      
      // Set up adaptive scheduling if enabled
      if (this.config.adaptive) {
        this.setupAdaptiveScheduling();
      }
      
      // Set up maintenance windows
      this.setupMaintenanceWindows();
      
      // Set up business hours monitoring
      this.setupBusinessHoursMonitoring();
      
      profileEnd('scheduler_init');
      
      logInfo('Scheduler initialized', {
        totalJobs: this.jobs.size,
        adaptiveEnabled: this.config.adaptive,
        businessHoursEnabled: this.config.businessHours?.enabled
      });
      
    } catch (error) {
      profileEnd('scheduler_init');
      throw handleError(error, { operation: 'initializeScheduler' });
    }
  }

  /**
   * Set up core system jobs
   */
  setupCoreJobs() {
    const jobs = [
      {
        name: 'emailProcessing',
        function: 'processNewSupportEmails',
        type: 'interval',
        interval: this.getInterval('emailProcessing'),
        businessHoursOnly: true,
        priority: 'high',
        description: 'Process new support emails'
      },
      {
        name: 'knowledgeSync',
        function: 'syncKnowledgeBase',
        type: 'interval',
        interval: this.getInterval('knowledgeSync'),
        businessHoursOnly: false,
        priority: 'medium',
        description: 'Sync knowledge base from all sources'
      },
      {
        name: 'driveSync',
        function: 'syncDriveKnowledgeBase',
        type: 'interval',
        interval: this.getInterval('driveSync') || 60,
        businessHoursOnly: false,
        priority: 'medium',
        description: 'Sync Google Drive knowledge base'
      },
      {
        name: 'metricsUpdate',
        function: 'updateMetrics',
        type: 'interval',
        interval: this.getInterval('metricsUpdate'),
        businessHoursOnly: false,
        priority: 'low',
        description: 'Update system metrics'
      },
      {
        name: 'healthCheck',
        function: 'performHealthCheck',
        type: 'interval',
        interval: this.getInterval('healthCheck'),
        businessHoursOnly: false,
        priority: 'high',
        description: 'Perform system health check'
      },
      {
        name: 'slaMonitoring',
        function: 'checkSLACompliance',
        type: 'interval',
        interval: this.getInterval('slaMonitoring') || 10,
        businessHoursOnly: true,
        priority: 'high',
        description: 'Monitor SLA compliance'
      },
      {
        name: 'escalationCheck',
        function: 'checkEscalations',
        type: 'interval',
        interval: this.getInterval('escalationCheck') || 15,
        businessHoursOnly: true,
        priority: 'high',
        description: 'Check for escalation requirements'
      },
      {
        name: 'cleanupOldData',
        function: 'cleanupOldData',
        type: 'daily',
        time: '02:00',
        businessHoursOnly: false,
        priority: 'low',
        description: 'Clean up old data and logs'
      },
      {
        name: 'generateReports',
        function: 'generateDailyReports',
        type: 'daily',
        time: '08:00',
        businessHoursOnly: false,
        priority: 'medium',
        description: 'Generate daily reports'
      },
      {
        name: 'backupData',
        function: 'backupSystemData',
        type: 'daily',
        time: '23:00',
        businessHoursOnly: false,
        priority: 'medium',
        description: 'Backup system data'
      }
    ];

    // Register all jobs
    jobs.forEach(job => this.registerJob(job));
  }

  /**
   * Register a job with the scheduler
   */
  registerJob(job) {
    try {
      // Validate job configuration
      if (!this.validateJobConfig(job)) {
        throw new Error(`Invalid job configuration: ${job.name}`);
      }

      // Store job configuration
      this.jobs.set(job.name, {
        ...job,
        id: Utilities.getUuid(),
        createdAt: new Date().toISOString(),
        lastRun: null,
        nextRun: null,
        runCount: 0,
        errorCount: 0,
        avgExecutionTime: 0,
        status: 'registered'
      });

      // Create trigger based on job type
      this.createTrigger(job);

      logInfo('Job registered', {
        jobName: job.name,
        type: job.type,
        interval: job.interval
      });

    } catch (error) {
      logError('Failed to register job', {
        jobName: job.name,
        error: error.message
      });
    }
  }

  /**
   * Create trigger for job
   */
  createTrigger(job) {
    let trigger;

    switch (job.type) {
      case 'interval':
        trigger = this.createIntervalTrigger(job);
        break;
      case 'daily':
        trigger = this.createDailyTrigger(job);
        break;
      case 'weekly':
        trigger = this.createWeeklyTrigger(job);
        break;
      case 'cron':
        trigger = this.createCronTrigger(job);
        break;
      default:
        throw new Error(`Unsupported job type: ${job.type}`);
    }

    if (trigger) {
      this.triggers.set(job.name, trigger);
      
      // Update job with trigger info
      const jobData = this.jobs.get(job.name);
      jobData.triggerId = trigger.getUniqueId();
      jobData.nextRun = this.calculateNextRun(job);
      jobData.status = 'scheduled';
    }
  }

  /**
   * Create interval trigger
   */
  createIntervalTrigger(job) {
    const interval = this.getEffectiveInterval(job);
    
    return ScriptApp.newTrigger(job.function)
      .timeBased()
      .everyMinutes(interval)
      .create();
  }

  /**
   * Create daily trigger
   */
  createDailyTrigger(job) {
    const [hour, minute] = job.time.split(':').map(Number);
    
    return ScriptApp.newTrigger(job.function)
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .nearMinute(minute)
      .create();
  }

  /**
   * Create weekly trigger
   */
  createWeeklyTrigger(job) {
    const [hour, minute] = job.time.split(':').map(Number);
    const day = job.day || ScriptApp.WeekDay.MONDAY;
    
    return ScriptApp.newTrigger(job.function)
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(day)
      .atHour(hour)
      .nearMinute(minute)
      .create();
  }

  /**
   * Create cron trigger (simplified cron support)
   */
  createCronTrigger(job) {
    // Parse cron expression (simplified)
    const cronParts = job.cron.split(' ');
    
    if (cronParts.length !== 5) {
      throw new Error('Invalid cron expression format');
    }

    const [minute, hour, day, month, dayOfWeek] = cronParts;
    
    // For now, support basic daily scheduling
    if (hour !== '*' && minute !== '*') {
      return ScriptApp.newTrigger(job.function)
        .timeBased()
        .everyDays(1)
        .atHour(parseInt(hour))
        .nearMinute(parseInt(minute))
        .create();
    }
    
    throw new Error('Complex cron expressions not yet supported');
  }

  /**
   * Get effective interval considering business hours and adaptive scheduling
   */
  getEffectiveInterval(job) {
    let baseInterval = job.interval;
    
    // Apply adaptive scheduling
    if (this.config.adaptive && job.adaptiveInterval) {
      const load = this.getCurrentSystemLoad();
      const timeOfDay = this.getTimeOfDay();
      
      if (timeOfDay === 'peak' && job.adaptiveInterval.peak) {
        baseInterval = job.adaptiveInterval.peak;
      } else if (timeOfDay === 'off' && job.adaptiveInterval.off) {
        baseInterval = job.adaptiveInterval.off;
      }
      
      // Adjust based on system load
      if (load > 0.8) {
        baseInterval = Math.max(baseInterval * 1.5, job.interval);
      } else if (load < 0.3) {
        baseInterval = Math.max(baseInterval * 0.8, 1);
      }
    }
    
    return Math.max(Math.round(baseInterval), 1);
  }

  /**
   * Get current time of day category
   */
  getTimeOfDay() {
    const now = new Date();
    const hour = now.getHours();
    const peakHours = this.config.peakHours || { start: 9, end: 17 };
    
    if (hour >= peakHours.start && hour < peakHours.end) {
      return 'peak';
    } else if (hour >= 22 || hour < 6) {
      return 'off';
    }
    
    return 'normal';
  }

  /**
   * Get current system load
   */
  getCurrentSystemLoad() {
    try {
      // Calculate load based on various factors
      const factors = {
        executionTime: this.getAvgExecutionTime(),
        errorRate: this.getErrorRate(),
        queueSize: this.getQueueSize(),
        memoryUsage: this.getMemoryUsage()
      };
      
      // Weighted average of load factors
      const load = (
        factors.executionTime * 0.3 +
        factors.errorRate * 0.2 +
        factors.queueSize * 0.3 +
        factors.memoryUsage * 0.2
      );
      
      // Store load history
      this.loadHistory.push({
        timestamp: new Date(),
        load: load,
        factors: factors
      });
      
      // Keep only last 100 measurements
      if (this.loadHistory.length > 100) {
        this.loadHistory.shift();
      }
      
      return Math.min(Math.max(load, 0), 1);
      
    } catch (error) {
      logError('Failed to calculate system load', {
        error: error.message
      });
      return 0.5; // Default to medium load
    }
  }

  /**
   * Check if job should run based on business hours
   */
  shouldRunJob(job) {
    if (!job.businessHoursOnly) {
      return true;
    }
    
    if (!this.config.businessHours?.enabled) {
      return true;
    }
    
    const now = new Date();
    const businessHours = this.config.businessHours;
    
    // Check day of week
    const dayOfWeek = now.getDay();
    if (!businessHours.days.includes(dayOfWeek)) {
      return false;
    }
    
    // Check time of day
    const hour = now.getHours();
    if (hour < businessHours.start || hour >= businessHours.end) {
      return false;
    }
    
    // Check for maintenance windows
    if (this.isMaintenanceWindow()) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if currently in maintenance window
   */
  isMaintenanceWindow() {
    if (!this.config.maintenance?.enabled) {
      return false;
    }
    
    const now = new Date();
    const maintenance = this.config.maintenance;
    
    // Parse maintenance time
    const [maintenanceHour, maintenanceMinute] = maintenance.time.split(':').map(Number);
    const maintenanceStart = new Date();
    maintenanceStart.setHours(maintenanceHour, maintenanceMinute, 0, 0);
    
    const maintenanceEnd = new Date(maintenanceStart);
    maintenanceEnd.setMinutes(maintenanceEnd.getMinutes() + maintenance.duration);
    
    return now >= maintenanceStart && now <= maintenanceEnd;
  }

  /**
   * Execute job wrapper
   */
  executeJob(jobName, context = {}) {
    const job = this.jobs.get(jobName);
    if (!job) {
      logError('Job not found', { jobName });
      return;
    }
    
    // Check if job should run
    if (!this.shouldRunJob(job)) {
      logDebug('Job skipped - outside business hours', { jobName });
      return;
    }
    
    const startTime = Date.now();
    
    try {
      // Update job status
      job.status = 'running';
      job.lastRun = new Date().toISOString();
      job.runCount++;
      
      // Execute the job function
      const result = this.callJobFunction(job.function, context);
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      job.avgExecutionTime = (job.avgExecutionTime + executionTime) / 2;
      
      // Update job status
      job.status = 'completed';
      job.lastResult = result;
      job.nextRun = this.calculateNextRun(job);
      
      // Record metrics
      Metrics.recordMetric('job_executed', {
        jobName: jobName,
        executionTime: executionTime,
        success: true
      });
      
      logInfo('Job executed successfully', {
        jobName: jobName,
        executionTime: executionTime
      });
      
    } catch (error) {
      // Handle job failure
      job.status = 'failed';
      job.errorCount++;
      job.lastError = error.message;
      
      // Record error metrics
      Metrics.recordMetric('job_failed', {
        jobName: jobName,
        error: error.message,
        executionTime: Date.now() - startTime
      });
      
      logError('Job execution failed', {
        jobName: jobName,
        error: error.message,
        executionTime: Date.now() - startTime
      });
      
      // Handle job failure based on configuration
      this.handleJobFailure(job, error);
    }
  }

  /**
   * Call job function dynamically
   */
  callJobFunction(functionName, context) {
    // Get function from global scope
    const fn = this[functionName] || globalThis[functionName];
    
    if (typeof fn !== 'function') {
      throw new Error(`Function not found: ${functionName}`);
    }
    
    // Call function with context
    return fn.call(this, context);
  }

  /**
   * Handle job failure
   */
  handleJobFailure(job, error) {
    // Implement retry logic
    if (job.retryCount < (job.maxRetries || 3)) {
      job.retryCount = (job.retryCount || 0) + 1;
      
      // Schedule retry with exponential backoff
      const retryDelay = Math.min(job.retryCount * 2, 60); // Max 60 minutes
      
      setTimeout(() => {
        this.executeJob(job.name);
      }, retryDelay * 60 * 1000);
      
      logInfo('Job scheduled for retry', {
        jobName: job.name,
        retryCount: job.retryCount,
        retryDelay: retryDelay
      });
    }
    
    // Send notification for critical job failures
    if (job.priority === 'high' && job.errorCount > 5) {
      this.sendJobFailureNotification(job, error);
    }
  }

  /**
   * Send job failure notification
   */
  sendJobFailureNotification(job, error) {
    const notification = {
      type: 'job_failure',
      data: {
        jobName: job.name,
        error: error.message,
        errorCount: job.errorCount,
        lastRun: job.lastRun,
        description: job.description
      }
    };
    
    // Send notification via NotificationService
    if (typeof sendNotification === 'function') {
      sendNotification('job_failure', notification.data);
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobName) {
    const job = this.jobs.get(jobName);
    if (!job) {
      return null;
    }
    
    return {
      name: job.name,
      status: job.status,
      lastRun: job.lastRun,
      nextRun: job.nextRun,
      runCount: job.runCount,
      errorCount: job.errorCount,
      avgExecutionTime: job.avgExecutionTime,
      priority: job.priority,
      description: job.description
    };
  }

  /**
   * Get all job statuses
   */
  getAllJobStatuses() {
    const statuses = [];
    
    for (const [name, job] of this.jobs.entries()) {
      statuses.push(this.getJobStatus(name));
    }
    
    return statuses.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Pause job
   */
  pauseJob(jobName) {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Job not found: ${jobName}`);
    }
    
    const trigger = this.triggers.get(jobName);
    if (trigger) {
      ScriptApp.deleteTrigger(trigger);
      this.triggers.delete(jobName);
    }
    
    job.status = 'paused';
    
    logInfo('Job paused', { jobName });
  }

  /**
   * Resume job
   */
  resumeJob(jobName) {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Job not found: ${jobName}`);
    }
    
    if (job.status === 'paused') {
      this.createTrigger(job);
      job.status = 'scheduled';
      
      logInfo('Job resumed', { jobName });
    }
  }

  /**
   * Remove job
   */
  removeJob(jobName) {
    const job = this.jobs.get(jobName);
    if (!job) {
      return;
    }
    
    // Delete trigger
    const trigger = this.triggers.get(jobName);
    if (trigger) {
      ScriptApp.deleteTrigger(trigger);
      this.triggers.delete(jobName);
    }
    
    // Remove job
    this.jobs.delete(jobName);
    
    logInfo('Job removed', { jobName });
  }

  /**
   * Clear all triggers
   */
  clearAllTriggers() {
    const triggers = ScriptApp.getProjectTriggers();
    
    triggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
    });
    
    this.triggers.clear();
    
    logInfo('All triggers cleared');
  }

  /**
   * Helper methods
   */
  
  getInterval(jobName) {
    return this.config.intervals?.[jobName] || 60;
  }

  calculateNextRun(job) {
    const now = new Date();
    
    switch (job.type) {
      case 'interval':
        return new Date(now.getTime() + job.interval * 60000);
      case 'daily':
        const [hour, minute] = job.time.split(':').map(Number);
        const nextRun = new Date(now);
        nextRun.setHours(hour, minute, 0, 0);
        
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        
        return nextRun;
      default:
        return null;
    }
  }

  validateJobConfig(job) {
    const required = ['name', 'function', 'type'];
    
    for (const field of required) {
      if (!job[field]) {
        return false;
      }
    }
    
    if (job.type === 'interval' && !job.interval) {
      return false;
    }
    
    if ((job.type === 'daily' || job.type === 'weekly') && !job.time) {
      return false;
    }
    
    return true;
  }

  getAvgExecutionTime() {
    const times = Array.from(this.jobs.values()).map(job => job.avgExecutionTime);
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  getErrorRate() {
    const jobs = Array.from(this.jobs.values());
    const totalRuns = jobs.reduce((sum, job) => sum + job.runCount, 0);
    const totalErrors = jobs.reduce((sum, job) => sum + job.errorCount, 0);
    
    return totalRuns > 0 ? totalErrors / totalRuns : 0;
  }

  getQueueSize() {
    // Placeholder for queue size calculation
    return 0;
  }

  getMemoryUsage() {
    // Placeholder for memory usage calculation
    return 0.5;
  }

  setupAdaptiveScheduling() {
    // Set up adaptive scheduling monitor
    const monitorJob = {
      name: 'adaptiveSchedulingMonitor',
      function: 'updateAdaptiveScheduling',
      type: 'interval',
      interval: 10,
      businessHoursOnly: false,
      priority: 'low',
      description: 'Monitor system load and adjust scheduling'
    };
    
    this.registerJob(monitorJob);
  }

  setupMaintenanceWindows() {
    if (!this.config.maintenance?.enabled) {
      return;
    }
    
    const maintenanceJob = {
      name: 'maintenanceWindow',
      function: 'performMaintenance',
      type: 'daily',
      time: this.config.maintenance.time,
      businessHoursOnly: false,
      priority: 'high',
      description: 'Perform system maintenance'
    };
    
    this.registerJob(maintenanceJob);
  }

  setupBusinessHoursMonitoring() {
    if (!this.config.businessHours?.enabled) {
      return;
    }
    
    const monitorJob = {
      name: 'businessHoursMonitor',
      function: 'updateBusinessHoursScheduling',
      type: 'interval',
      interval: 15,
      businessHoursOnly: false,
      priority: 'medium',
      description: 'Monitor business hours and adjust scheduling'
    };
    
    this.registerJob(monitorJob);
  }

  /**
   * Job functions (to be called by triggers)
   */
  
  updateAdaptiveScheduling() {
    // Update scheduling based on current load
    const load = this.getCurrentSystemLoad();
    
    for (const [name, job] of this.jobs.entries()) {
      if (job.type === 'interval' && job.adaptiveInterval) {
        const newInterval = this.getEffectiveInterval(job);
        
        if (newInterval !== job.interval) {
          // Recreate trigger with new interval
          this.pauseJob(name);
          job.interval = newInterval;
          this.resumeJob(name);
          
          logInfo('Adaptive scheduling updated', {
            jobName: name,
            oldInterval: job.interval,
            newInterval: newInterval,
            systemLoad: load
          });
        }
      }
    }
  }

  updateBusinessHoursScheduling() {
    // Update job scheduling based on business hours
    const isBusinessHours = this.shouldRunJob({ businessHoursOnly: true });
    
    for (const [name, job] of this.jobs.entries()) {
      if (job.businessHoursOnly && !isBusinessHours) {
        if (job.status === 'scheduled') {
          this.pauseJob(name);
        }
      } else if (job.businessHoursOnly && isBusinessHours) {
        if (job.status === 'paused') {
          this.resumeJob(name);
        }
      }
    }
  }

  performMaintenance() {
    logInfo('Starting maintenance window');
    
    // Pause non-critical jobs
    for (const [name, job] of this.jobs.entries()) {
      if (job.priority !== 'high') {
        this.pauseJob(name);
      }
    }
    
    // Perform maintenance tasks
    try {
      if (typeof cleanupOldData === 'function') {
        cleanupOldData();
      }
      
      if (typeof optimizeDatabase === 'function') {
        optimizeDatabase();
      }
      
      if (typeof clearCaches === 'function') {
        clearCaches();
      }
      
    } catch (error) {
      logError('Maintenance failed', { error: error.message });
    }
    
    // Resume paused jobs
    setTimeout(() => {
      for (const [name, job] of this.jobs.entries()) {
        if (job.status === 'paused' && job.priority !== 'high') {
          this.resumeJob(name);
        }
      }
      
      logInfo('Maintenance window completed');
    }, this.config.maintenance.duration * 60000);
  }
}

// Create singleton instance
const Scheduler = new SchedulerService();

// Convenience functions
function initializeScheduler() {
  return Scheduler.initializeScheduler();
}

function getJobStatus(jobName) {
  return Scheduler.getJobStatus(jobName);
}

function getAllJobStatuses() {
  return Scheduler.getAllJobStatuses();
}

function pauseJob(jobName) {
  return Scheduler.pauseJob(jobName);
}

function resumeJob(jobName) {
  return Scheduler.resumeJob(jobName);
}

function executeJob(jobName, context) {
  return Scheduler.executeJob(jobName, context);
}