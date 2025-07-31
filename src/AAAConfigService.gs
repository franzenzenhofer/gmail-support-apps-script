/**
 * AAAConfigService.gs - Centralized Configuration Management
 * 
 * IMPORTANT: This file is named with AAA prefix to ensure it loads BEFORE AIService
 * This ensures ConfigService class is available when AIService tries to use it
 * 
 * This service manages all configuration settings for the support system.
 * Provides a single source of truth for all modules.
 */

class ConfigService {
  constructor() {
    this.cache = CacheService.getScriptCache();
    this.props = PropertiesService.getScriptProperties();
    this.configKey = 'support_system_config';
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      // API Keys
      gemini: {
        apiKey: 'YOUR_GEMINI_API_KEY_HERE',
        model: 'gemini-2.0-flash-exp',
        temperature: 0.3,
        maxTokens: 1024
      },
      
      // Support Settings
      support: {
        enabled: true,
        autoReply: true,
        maxAutoReplies: 3,
        escalationThreshold: 0.7,
        sentimentEscalation: true,
        priorityEscalation: ['urgent', 'high'],
        businessHours: {
          timezone: Session.getScriptTimeZone(),
          start: 9,
          end: 17,
          days: [1, 2, 3, 4, 5] // Mon-Fri
        }
      },
      
      // Email Settings
      email: {
        supportLabel: 'Support',
        processedLabel: 'Support/Processed',
        escalatedLabel: 'Support/Escalated',
        autoRepliedLabel: 'Support/Auto-Replied',
        resolvedLabel: 'Support/Resolved',
        maxEmailsPerBatch: 10,
        replySignature: 'Best regards,\nCustomer Support Team'
      },
      
      // Categorization Rules
      categories: {
        technical: {
          keywords: ['error', 'bug', 'crash', 'not working', 'broken', 'issue', 'problem'],
          priority: 'high',
          autoReply: true
        },
        billing: {
          keywords: ['payment', 'invoice', 'charge', 'refund', 'subscription', 'price', 'cost'],
          priority: 'high',
          autoReply: false,
          escalate: true
        },
        account: {
          keywords: ['password', 'login', 'access', 'security', '2fa', 'account', 'username'],
          priority: 'medium',
          autoReply: true
        },
        feature: {
          keywords: ['feature', 'request', 'add', 'implement', 'suggestion', 'improve', 'enhancement'],
          priority: 'low',
          autoReply: true
        },
        complaint: {
          keywords: ['complaint', 'unhappy', 'disappointed', 'angry', 'frustrated', 'worst', 'terrible'],
          priority: 'urgent',
          autoReply: false,
          escalate: true
        }
      },
      
      // Knowledge Base
      knowledgeBase: {
        sheetId: 'YOUR_KNOWLEDGE_BASE_SHEET_ID',
        cacheExpiry: 3600, // 1 hour
        maxResults: 5,
        minConfidence: 0.6
      },
      
      // Notifications
      notifications: {
        escalationEmail: '',
        slackWebhook: '',
        discordWebhook: '',
        urgentAlertEmail: ''
      },
      
      // Performance
      performance: {
        cacheEnabled: true,
        cacheExpiry: 1800, // 30 minutes
        batchSize: 50,
        maxRetries: 3,
        retryDelay: 1000 // milliseconds
      },
      
      // Loop Prevention
      loopPrevention: {
        enabled: true,
        maxSimilarEmails: 3,
        similarityWindow: 3600, // 1 hour
        blacklistPatterns: ['auto-reply', 'automatic response', 'out of office', 'do not reply'],
        whitelistDomains: []
      },
      
      // SLA Settings
      sla: {
        enabled: true,
        responseTargets: {
          urgent: 60,    // minutes
          high: 240,     // 4 hours
          medium: 480,   // 8 hours
          low: 1440      // 24 hours
        },
        resolutionTargets: {
          urgent: 240,   // 4 hours
          high: 1440,    // 24 hours
          medium: 2880,  // 48 hours
          low: 5760      // 96 hours
        }
      },
      
      // Analytics
      analytics: {
        enabled: true,
        retentionDays: 90,
        dashboardRefresh: 300 // 5 minutes
      },
      
      // Plugins
      plugins: {
        enabled: true,
        allowedDomains: [],
        maxExecutionTime: 30000 // 30 seconds
      }
    };
  }

  /**
   * Get configuration value
   */
  get(path = null) {
    // Try cache first
    const cached = this.cache.get(this.configKey);
    let config;
    
    if (cached) {
      config = JSON.parse(cached);
    } else {
      // Try properties
      const stored = this.props.getProperty(this.configKey);
      if (stored) {
        config = JSON.parse(stored);
      } else {
        // Use defaults
        config = this.getDefaultConfig();
        this.save(config);
      }
      
      // Cache for performance
      this.cache.put(this.configKey, JSON.stringify(config), 300);
    }
    
    // Return specific path if requested
    if (path) {
      return this.getValueByPath(config, path);
    }
    
    return config;
  }

  /**
   * Set configuration value
   */
  set(path, value) {
    const config = this.get();
    this.setValueByPath(config, path, value);
    this.save(config);
    return config;
  }

  /**
   * Update multiple configuration values
   */
  update(updates) {
    const config = this.get();
    
    Object.keys(updates).forEach(key => {
      this.setValueByPath(config, key, updates[key]);
    });
    
    this.save(config);
    return config;
  }

  /**
   * Reset to default configuration
   */
  reset() {
    const config = this.getDefaultConfig();
    this.save(config);
    return config;
  }

  /**
   * Save configuration
   */
  save(config) {
    const configString = JSON.stringify(config);
    this.props.setProperty(this.configKey, configString);
    this.cache.put(this.configKey, configString, 300);
  }

  /**
   * Get value by dot notation path
   */
  getValueByPath(obj, path) {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  /**
   * Set value by dot notation path
   */
  setValueByPath(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((curr, prop) => {
      if (!curr[prop]) curr[prop] = {};
      return curr[prop];
    }, obj);
    target[last] = value;
  }

  /**
   * Validate configuration
   */
  validate() {
    const config = this.get();
    const errors = [];
    
    // Validate API keys
    if (!config.gemini.apiKey || config.gemini.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      errors.push('Gemini API key not configured');
    }
    
    // Validate knowledge base
    if (config.knowledgeBase.sheetId === 'YOUR_KNOWLEDGE_BASE_SHEET_ID') {
      errors.push('Knowledge base sheet ID not configured');
    }
    
    // Validate business hours
    if (config.support.businessHours.start >= config.support.businessHours.end) {
      errors.push('Invalid business hours configuration');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Export configuration
   */
  export() {
    return JSON.stringify(this.get(), null, 2);
  }

  /**
   * Import configuration
   */
  import(configString) {
    try {
      const config = JSON.parse(configString);
      this.save(config);
      return { success: true, config };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get configuration for specific module
   */
  getModuleConfig(moduleName) {
    const config = this.get();
    return config[moduleName] || {};
  }

  /**
   * Check if feature is enabled
   */
  isEnabled(feature) {
    const config = this.get();
    
    switch (feature) {
      case 'support':
        return config.support.enabled;
      case 'autoReply':
        return config.support.enabled && config.support.autoReply;
      case 'analytics':
        return config.analytics.enabled;
      case 'plugins':
        return config.plugins.enabled;
      case 'sla':
        return config.sla.enabled;
      case 'loopPrevention':
        return config.loopPrevention.enabled;
      default:
        return false;
    }
  }

  /**
   * Get environment info
   */
  getEnvironment() {
    return {
      timezone: Session.getScriptTimeZone(),
      locale: Session.getActiveUserLocale(),
      email: Session.getEffectiveUser().getEmail(),
      scriptId: ScriptApp.getScriptId(),
      deploymentId: ScriptApp.getService().getUrl() ? 'webapp' : 'addon'
    };
  }
}

// Create singleton instance
const Config = new ConfigService();

// Utility functions for easy access
function getConfig(path) {
  return Config.get(path);
}

function setConfig(path, value) {
  return Config.set(path, value);
}

function updateConfig(updates) {
  return Config.update(updates);
}

function validateConfig() {
  return Config.validate();
}

function isFeatureEnabled(feature) {
  return Config.isEnabled(feature);
}