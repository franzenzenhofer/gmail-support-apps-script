/**
 * DeploymentService.gs - Automated Deployment and Version Control
 * 
 * Manages deployment, versioning, and environment configuration
 * Integrates with clasp for CI/CD workflows
 */

class DeploymentService {
  constructor() {
    this.environments = ['development', 'staging', 'production'];
    this.currentEnvironment = this.getCurrentEnvironment();
    this.version = this.getCurrentVersion();
    this.deploymentHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * Get current environment
   */
  getCurrentEnvironment() {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('ENVIRONMENT') || 'development';
  }

  /**
   * Get current version
   */
  getCurrentVersion() {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('VERSION') || '1.0.0';
  }

  /**
   * Deploy to environment
   */
  async deploy(targetEnvironment, options = {}) {
    profile(`deployment_${targetEnvironment}`);
    
    try {
      // Validate environment
      if (!this.environments.includes(targetEnvironment)) {
        throw new Error(`Invalid environment: ${targetEnvironment}`);
      }
      
      // Pre-deployment checks
      const checks = await this.runPreDeploymentChecks(targetEnvironment);
      if (!checks.passed) {
        throw new Error(`Pre-deployment checks failed: ${checks.errors.join(', ')}`);
      }
      
      // Create deployment record
      const deployment = {
        id: Utilities.getUuid(),
        timestamp: new Date().toISOString(),
        fromVersion: this.version,
        toVersion: options.version || this.incrementVersion(),
        environment: targetEnvironment,
        user: Session.getActiveUser().getEmail(),
        changes: options.changes || [],
        status: 'in_progress'
      };
      
      this.addToHistory(deployment);
      
      // Backup current state
      if (options.backup !== false) {
        await this.createBackup(deployment.id);
      }
      
      // Deploy configuration
      await this.deployConfiguration(targetEnvironment);
      
      // Deploy code
      await this.deployCode(targetEnvironment, deployment);
      
      // Run migrations
      if (options.runMigrations !== false) {
        await this.runMigrations(targetEnvironment);
      }
      
      // Post-deployment validation
      const validation = await this.runPostDeploymentValidation(targetEnvironment);
      if (!validation.passed) {
        // Rollback if validation fails
        await this.rollback(deployment.id);
        throw new Error(`Post-deployment validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Update deployment status
      deployment.status = 'completed';
      deployment.completedAt = new Date().toISOString();
      this.updateDeployment(deployment);
      
      // Update current version
      this.setVersion(deployment.toVersion);
      
      // Send notifications
      if (options.notify !== false) {
        await this.sendDeploymentNotification(deployment);
      }
      
      profileEnd(`deployment_${targetEnvironment}`);
      
      logInfo('Deployment completed', {
        deployment: deployment,
        duration: Date.now() - new Date(deployment.timestamp).getTime()
      });
      
      return deployment;
      
    } catch (error) {
      profileEnd(`deployment_${targetEnvironment}`);
      
      logError('Deployment failed', {
        environment: targetEnvironment,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Run pre-deployment checks
   */
  async runPreDeploymentChecks(environment) {
    const checks = {
      passed: true,
      errors: [],
      warnings: []
    };
    
    // Check system health
    try {
      const health = await this.checkSystemHealth();
      if (!health.healthy) {
        checks.errors.push(`System unhealthy: ${health.message}`);
        checks.passed = false;
      }
    } catch (error) {
      checks.errors.push(`Health check failed: ${error.message}`);
      checks.passed = false;
    }
    
    // Check dependencies
    const deps = this.checkDependencies();
    if (!deps.satisfied) {
      checks.errors.push(`Missing dependencies: ${deps.missing.join(', ')}`);
      checks.passed = false;
    }
    
    // Check permissions
    const perms = this.checkPermissions(environment);
    if (!perms.granted) {
      checks.errors.push(`Insufficient permissions for ${environment}`);
      checks.passed = false;
    }
    
    // Check for pending migrations
    const migrations = this.checkPendingMigrations();
    if (migrations.pending > 0) {
      checks.warnings.push(`${migrations.pending} pending migrations`);
    }
    
    // Run tests if in production
    if (environment === 'production') {
      const tests = await this.runTests();
      if (!tests.passed) {
        checks.errors.push(`Tests failed: ${tests.failed} of ${tests.total}`);
        checks.passed = false;
      }
    }
    
    return checks;
  }

  /**
   * Deploy configuration to environment
   */
  async deployConfiguration(environment) {
    const config = Config.get();
    const envConfig = this.getEnvironmentConfig(environment);
    
    // Merge configurations
    const deployConfig = this.mergeConfigs(config, envConfig);
    
    // Validate configuration
    const validation = Config.validate();
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }
    
    // Deploy to environment
    const props = PropertiesService.getScriptProperties();
    props.setProperty('ENVIRONMENT', environment);
    props.setProperty('DEPLOYED_CONFIG', JSON.stringify(deployConfig));
    props.setProperty('DEPLOYMENT_TIME', new Date().toISOString());
    
    logInfo('Configuration deployed', {
      environment: environment,
      configSize: JSON.stringify(deployConfig).length
    });
  }

  /**
   * Deploy code to environment
   */
  async deployCode(environment, deployment) {
    // In Apps Script, code deployment is handled by clasp
    // This method manages deployment metadata
    
    const props = PropertiesService.getScriptProperties();
    props.setProperty('DEPLOYMENT_ID', deployment.id);
    props.setProperty('DEPLOYMENT_ENV', environment);
    props.setProperty('DEPLOYMENT_VERSION', deployment.toVersion);
    
    // Create deployment manifest
    const manifest = {
      deploymentId: deployment.id,
      version: deployment.toVersion,
      environment: environment,
      timestamp: deployment.timestamp,
      files: this.getFileList(),
      checksums: this.calculateChecksums()
    };
    
    props.setProperty('DEPLOYMENT_MANIFEST', JSON.stringify(manifest));
  }

  /**
   * Run migrations
   */
  async runMigrations(environment) {
    // Get pending migrations
    const migrations = this.getPendingMigrations();
    
    if (migrations.length === 0) {
      logInfo('No migrations to run');
      return;
    }
    
    logInfo(`Running ${migrations.length} migrations`);
    
    for (const migration of migrations) {
      try {
        await this.runMigration(migration, environment);
        this.markMigrationComplete(migration);
      } catch (error) {
        logError(`Migration failed: ${migration.name}`, { error: error.message });
        throw error;
      }
    }
  }

  /**
   * Run post-deployment validation
   */
  async runPostDeploymentValidation(environment) {
    const validation = {
      passed: true,
      errors: [],
      checks: []
    };
    
    // Check service availability
    const services = ['EmailService', 'AIService', 'KnowledgeBase'];
    for (const service of services) {
      try {
        const available = this.checkServiceAvailability(service);
        validation.checks.push({
          service: service,
          available: available
        });
        if (!available) {
          validation.errors.push(`${service} not available`);
          validation.passed = false;
        }
      } catch (error) {
        validation.errors.push(`${service} check failed: ${error.message}`);
        validation.passed = false;
      }
    }
    
    // Verify configuration
    try {
      const config = Config.get();
      if (!config || Object.keys(config).length === 0) {
        validation.errors.push('Configuration not loaded');
        validation.passed = false;
      }
    } catch (error) {
      validation.errors.push(`Configuration error: ${error.message}`);
      validation.passed = false;
    }
    
    // Test critical functionality
    if (environment === 'production') {
      try {
        await this.runSmokeTests();
        validation.checks.push({
          test: 'smoke_tests',
          passed: true
        });
      } catch (error) {
        validation.errors.push(`Smoke tests failed: ${error.message}`);
        validation.passed = false;
      }
    }
    
    return validation;
  }

  /**
   * Rollback deployment
   */
  async rollback(deploymentId) {
    logWarn('Starting rollback', { deploymentId });
    
    try {
      // Get deployment record
      const deployment = this.getDeployment(deploymentId);
      if (!deployment) {
        throw new Error(`Deployment ${deploymentId} not found`);
      }
      
      // Restore from backup
      const backup = this.getBackup(deploymentId);
      if (backup) {
        await this.restoreFromBackup(backup);
      }
      
      // Revert version
      this.setVersion(deployment.fromVersion);
      
      // Update deployment status
      deployment.status = 'rolled_back';
      deployment.rolledBackAt = new Date().toISOString();
      this.updateDeployment(deployment);
      
      logInfo('Rollback completed', { deploymentId });
      
    } catch (error) {
      logError('Rollback failed', {
        deploymentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create backup
   */
  async createBackup(deploymentId) {
    const backup = {
      id: deploymentId,
      timestamp: new Date().toISOString(),
      environment: this.currentEnvironment,
      version: this.version,
      config: Config.export(),
      properties: this.exportProperties(),
      data: this.exportData()
    };
    
    // Store backup
    const props = PropertiesService.getScriptProperties();
    props.setProperty(`backup_${deploymentId}`, JSON.stringify(backup));
    
    logInfo('Backup created', {
      backupId: deploymentId,
      size: JSON.stringify(backup).length
    });
    
    return backup;
  }

  /**
   * Increment version
   */
  incrementVersion(type = 'patch') {
    const parts = this.version.split('.');
    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1]);
    const patch = parseInt(parts[2]);
    
    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  /**
   * Set version
   */
  setVersion(version) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('VERSION', version);
    this.version = version;
  }

  /**
   * Get environment configuration
   */
  getEnvironmentConfig(environment) {
    const configs = {
      development: {
        debug: true,
        logging: { level: 'DEBUG' },
        cache: { enabled: false },
        rateLimit: { enabled: false }
      },
      staging: {
        debug: false,
        logging: { level: 'INFO' },
        cache: { enabled: true },
        rateLimit: { enabled: true, limit: 100 }
      },
      production: {
        debug: false,
        logging: { level: 'WARN' },
        cache: { enabled: true, ttl: 3600 },
        rateLimit: { enabled: true, limit: 50 }
      }
    };
    
    return configs[environment] || {};
  }

  /**
   * Merge configurations
   */
  mergeConfigs(base, override) {
    const merged = JSON.parse(JSON.stringify(base)); // Deep clone
    
    const merge = (target, source) => {
      Object.keys(source).forEach(key => {
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      });
    };
    
    merge(merged, override);
    return merged;
  }

  /**
   * Check system health
   */
  async checkSystemHealth() {
    // Simulate health check
    return {
      healthy: true,
      services: {
        gmail: 'operational',
        gemini: 'operational',
        storage: 'operational'
      }
    };
  }

  /**
   * Check dependencies
   */
  checkDependencies() {
    const required = ['Config', 'Logger', 'ErrorHandler'];
    const missing = [];
    
    required.forEach(dep => {
      if (!global[dep]) {
        missing.push(dep);
      }
    });
    
    return {
      satisfied: missing.length === 0,
      missing: missing
    };
  }

  /**
   * Check permissions
   */
  checkPermissions(environment) {
    const user = Session.getActiveUser().getEmail();
    const admins = Config.get('deployment.admins') || [];
    
    if (environment === 'production' && !admins.includes(user)) {
      return { granted: false };
    }
    
    return { granted: true };
  }

  /**
   * Get file list
   */
  getFileList() {
    // In Apps Script, we can't directly access files
    // Return a list of known service files
    return [
      'Code.gs',
      'ConfigService.gs',
      'KnowledgeBaseService.gs',
      'DebugService.gs',
      'LoggingService.gs',
      'ErrorService.gs',
      'DeploymentService.gs',
      'Dashboard.html'
    ];
  }

  /**
   * Calculate checksums
   */
  calculateChecksums() {
    // Simplified checksum calculation
    const files = this.getFileList();
    const checksums = {};
    
    files.forEach(file => {
      // In real implementation, would calculate actual file checksum
      checksums[file] = Utilities.computeDigest(
        Utilities.DigestAlgorithm.MD5,
        file + this.version
      ).map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
    });
    
    return checksums;
  }

  /**
   * Get deployment history
   */
  getHistory(options = {}) {
    let history = this.deploymentHistory;
    
    if (options.environment) {
      history = history.filter(d => d.environment === options.environment);
    }
    
    if (options.status) {
      history = history.filter(d => d.status === options.status);
    }
    
    if (options.limit) {
      history = history.slice(0, options.limit);
    }
    
    return history;
  }

  /**
   * Add to deployment history
   */
  addToHistory(deployment) {
    this.deploymentHistory.unshift(deployment);
    if (this.deploymentHistory.length > this.maxHistorySize) {
      this.deploymentHistory.pop();
    }
    
    // Persist to properties
    const props = PropertiesService.getScriptProperties();
    props.setProperty('deployment_history', JSON.stringify(this.deploymentHistory));
  }

  /**
   * Generate deployment report
   */
  generateReport(options = {}) {
    const report = {
      currentVersion: this.version,
      currentEnvironment: this.currentEnvironment,
      lastDeployment: this.deploymentHistory[0] || null,
      deploymentStats: this.getDeploymentStats(),
      environmentStatus: this.getEnvironmentStatus()
    };
    
    if (options.includeHistory) {
      report.history = this.getHistory({ limit: 10 });
    }
    
    return report;
  }

  /**
   * Get deployment statistics
   */
  getDeploymentStats() {
    const stats = {
      total: this.deploymentHistory.length,
      byEnvironment: {},
      byStatus: {},
      averageDuration: 0
    };
    
    let totalDuration = 0;
    let completedCount = 0;
    
    this.deploymentHistory.forEach(deployment => {
      // By environment
      stats.byEnvironment[deployment.environment] = 
        (stats.byEnvironment[deployment.environment] || 0) + 1;
      
      // By status
      stats.byStatus[deployment.status] = 
        (stats.byStatus[deployment.status] || 0) + 1;
      
      // Duration
      if (deployment.completedAt) {
        const duration = new Date(deployment.completedAt) - new Date(deployment.timestamp);
        totalDuration += duration;
        completedCount++;
      }
    });
    
    if (completedCount > 0) {
      stats.averageDuration = Math.round(totalDuration / completedCount / 1000); // seconds
    }
    
    return stats;
  }

  /**
   * Get environment status
   */
  getEnvironmentStatus() {
    const status = {};
    
    this.environments.forEach(env => {
      const lastDeployment = this.deploymentHistory.find(d => d.environment === env);
      status[env] = {
        version: lastDeployment ? lastDeployment.toVersion : 'unknown',
        lastDeployed: lastDeployment ? lastDeployment.timestamp : null,
        status: lastDeployment ? lastDeployment.status : 'never_deployed'
      };
    });
    
    return status;
  }
}

// Create singleton instance
const Deployment = new DeploymentService();

// Convenience functions
function deploy(environment, options) {
  return Deployment.deploy(environment, options);
}

function rollback(deploymentId) {
  return Deployment.rollback(deploymentId);
}

function getDeploymentHistory(options) {
  return Deployment.getHistory(options);
}

function getDeploymentReport(options) {
  return Deployment.generateReport(options);
}

function getCurrentVersion() {
  return Deployment.version;
}

function getCurrentEnvironment() {
  return Deployment.currentEnvironment;
}