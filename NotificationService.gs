/**
 * NotificationService.gs - Multi-Channel Alerts
 * 
 * Send notifications via email, Slack, Discord, SMS, webhooks
 * Intelligent routing and delivery confirmation
 */

class NotificationService {
  constructor() {
    this.config = Config.get('notifications');
    this.channels = this.initializeChannels();
    this.templates = this.loadNotificationTemplates();
    this.cache = CacheService.getScriptCache();
  }

  /**
   * Send notification via multiple channels
   */
  async sendNotification(type, data, options = {}) {
    profile('notification_send');
    
    try {
      const notification = {
        id: Utilities.getUuid(),
        type: type,
        data: data,
        timestamp: new Date().toISOString(),
        channels: options.channels || this.getDefaultChannels(type),
        priority: options.priority || 'medium',
        retry: options.retry !== false
      };
      
      const results = {};
      
      // Send to each channel
      for (const channel of notification.channels) {
        try {
          const result = await this.sendToChannel(channel, notification);
          results[channel] = result;
          
          logDebug(`Notification sent via ${channel}`, {
            notificationId: notification.id,
            success: result.success
          });
          
        } catch (error) {
          results[channel] = { 
            success: false, 
            error: error.message 
          };
          
          logError(`Notification failed via ${channel}`, {
            notificationId: notification.id,
            error: error.message
          });
        }
      }
      
      // Store notification record
      this.storeNotificationRecord(notification, results);
      
      profileEnd('notification_send');
      
      return {
        notificationId: notification.id,
        results: results,
        successCount: Object.values(results).filter(r => r.success).length,
        totalChannels: notification.channels.length
      };
      
    } catch (error) {
      profileEnd('notification_send');
      throw handleError(error, { operation: 'sendNotification' });
    }
  }

  /**
   * Send to specific channel
   */
  async sendToChannel(channel, notification) {
    const channelConfig = this.config[channel];
    if (!channelConfig?.enabled) {
      return { success: false, error: 'Channel not enabled' };
    }
    
    const template = this.getTemplate(notification.type, channel);
    const message = this.formatMessage(template, notification);
    
    switch (channel) {
      case 'email':
        return await this.sendEmail(message, notification);
      case 'slack':
        return await this.sendSlack(message, notification);
      case 'discord':
        return await this.sendDiscord(message, notification);
      case 'teams':
        return await this.sendTeams(message, notification);
      case 'webhook':
        return await this.sendWebhook(message, notification);
      case 'sms':
        return await this.sendSMS(message, notification);
      default:
        return { success: false, error: 'Unknown channel' };
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(message, notification) {
    try {
      const config = this.config.email;
      
      const emailOptions = {
        to: message.to || config.defaultRecipient,
        cc: message.cc,
        bcc: message.bcc,
        replyTo: config.replyTo,
        name: config.senderName || 'Support System',
        htmlBody: message.htmlBody,
        attachments: message.attachments
      };
      
      GmailApp.sendEmail(
        emailOptions.to,
        message.subject,
        message.body,
        emailOptions
      );
      
      return { 
        success: true, 
        messageId: `email_${Date.now()}`,
        sentAt: new Date().toISOString()
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Send Slack notification
   */
  async sendSlack(message, notification) {
    try {
      const config = this.config.slack;
      if (!config.webhookUrl) {
        throw new Error('Slack webhook URL not configured');
      }
      
      const payload = {
        text: message.text,
        channel: message.channel || config.defaultChannel,
        username: config.username || 'Support Bot',
        icon_emoji: config.icon || ':robot_face:',
        ...message.slackOptions
      };
      
      if (message.blocks) {
        payload.blocks = message.blocks;
      }
      
      if (message.attachments) {
        payload.attachments = message.attachments;
      }
      
      const response = UrlFetchApp.fetch(config.webhookUrl, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(payload)
      });
      
      return {
        success: response.getResponseCode() === 200,
        messageId: `slack_${Date.now()}`,
        sentAt: new Date().toISOString()
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Send Discord notification
   */
  async sendDiscord(message, notification) {
    try {
      const config = this.config.discord;
      if (!config.webhookUrl) {
        throw new Error('Discord webhook URL not configured');
      }
      
      const payload = {
        content: message.content,
        username: config.username || 'Support Bot',
        avatar_url: config.avatarUrl,
        embeds: message.embeds
      };
      
      const response = UrlFetchApp.fetch(config.webhookUrl, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(payload)
      });
      
      return {
        success: response.getResponseCode() === 204,
        messageId: `discord_${Date.now()}`,
        sentAt: new Date().toISOString()
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Send Teams notification
   */
  async sendTeams(message, notification) {
    try {
      const config = this.config.teams;
      if (!config.webhookUrl) {
        throw new Error('Teams webhook URL not configured');
      }
      
      const payload = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: message.summary,
        themeColor: message.color || '0078D4',
        title: message.title,
        text: message.text,
        sections: message.sections,
        potentialAction: message.actions
      };
      
      const response = UrlFetchApp.fetch(config.webhookUrl, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(payload)
      });
      
      return {
        success: response.getResponseCode() === 200,
        messageId: `teams_${Date.now()}`,
        sentAt: new Date().toISOString()
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Send custom webhook
   */
  async sendWebhook(message, notification) {
    try {
      const config = this.config.webhook;
      if (!config.url) {
        throw new Error('Webhook URL not configured');
      }
      
      const payload = {
        notification: notification,
        message: message,
        timestamp: new Date().toISOString(),
        source: 'gmail-support-system'
      };
      
      const headers = {
        'Content-Type': 'application/json',
        ...config.headers
      };
      
      if (config.authToken) {
        headers['Authorization'] = `Bearer ${config.authToken}`;
      }
      
      const response = UrlFetchApp.fetch(config.url, {
        method: config.method || 'POST',
        headers: headers,
        payload: JSON.stringify(payload)
      });
      
      return {
        success: response.getResponseCode() < 300,
        messageId: `webhook_${Date.now()}`,
        sentAt: new Date().toISOString(),
        responseCode: response.getResponseCode()
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(message, notification) {
    try {
      const config = this.config.sms;
      if (!config.enabled) {
        throw new Error('SMS not configured');
      }
      
      // Integration with SMS provider (Twilio, etc.)
      // This is a placeholder implementation
      
      logInfo('SMS notification would be sent', {
        to: message.to,
        content: message.content
      });
      
      return {
        success: true,
        messageId: `sms_${Date.now()}`,
        sentAt: new Date().toISOString(),
        provider: config.provider
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Load notification templates
   */
  loadNotificationTemplates() {
    return {
      // Ticket notifications
      ticket_created: {
        email: {
          subject: 'New Support Ticket: {{ticketId}}',
          body: `A new support ticket has been created:

Ticket ID: {{ticketId}}
Customer: {{customerName}} ({{customerEmail}})
Subject: {{subject}}
Priority: {{priority}}
Category: {{category}}

Customer Message:
{{description}}

Action Required: Review and respond to the customer.`,
          htmlBody: `<h2>New Support Ticket</h2>
<p><strong>Ticket ID:</strong> {{ticketId}}</p>
<p><strong>Customer:</strong> {{customerName}} ({{customerEmail}})</p>
<p><strong>Subject:</strong> {{subject}}</p>
<p><strong>Priority:</strong> {{priority}}</p>
<p><strong>Category:</strong> {{category}}</p>
<h3>Customer Message:</h3>
<p>{{description}}</p>`
        },
        
        slack: {
          text: '🎫 New Support Ticket: {{ticketId}}',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*New Support Ticket Created*\n*Ticket:* {{ticketId}}\n*Customer:* {{customerName}} ({{customerEmail}})\n*Priority:* {{priority}}\n*Category:* {{category}}'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Subject:* {{subject}}\n*Message:* {{description}}'
              }
            }
          ]
        }
      },
      
      // Escalation notifications
      ticket_escalated: {
        email: {
          subject: '🚨 Escalated Ticket: {{ticketId}}',
          body: `A ticket has been escalated:

Ticket ID: {{ticketId}}
Customer: {{customerName}}
Escalation Reasons: {{reasons}}
Assigned To: {{assignedTo}}
Priority: {{priority}}

Please review and take appropriate action.`
        },
        
        slack: {
          text: '🚨 Ticket Escalated: {{ticketId}}',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Ticket Escalated*\n*Ticket:* {{ticketId}}\n*Customer:* {{customerName}}\n*Reasons:* {{reasons}}\n*Assigned To:* {{assignedTo}}'
              }
            }
          ]
        }
      },
      
      // SLA breach notifications
      sla_breach: {
        email: {
          subject: '⚠️ SLA Breach Alert: {{ticketId}}',
          body: `SLA target has been breached:

Ticket ID: {{ticketId}}
Customer: {{customerName}}
SLA Type: {{slaType}}
Target: {{slaTarget}}
Breach Time: {{breachTime}}

Immediate action required.`
        },
        
        slack: {
          text: '⚠️ SLA Breach: {{ticketId}}',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*SLA Breach Alert*\n*Ticket:* {{ticketId}}\n*Customer:* {{customerName}}\n*SLA Type:* {{slaType}}\n*Target:* {{slaTarget}}\n*Breach Time:* {{breachTime}}'
              }
            }
          ]
        }
      },
      
      // System alerts
      system_error: {
        email: {
          subject: '❌ System Error Alert',
          body: `A system error has occurred:

Error: {{error}}
Location: {{location}}
Time: {{timestamp}}
Severity: {{severity}}

Please investigate immediately.`
        },
        
        slack: {
          text: '❌ System Error: {{error}}',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*System Error Alert*\n*Error:* {{error}}\n*Location:* {{location}}\n*Severity:* {{severity}}\n*Time:* {{timestamp}}'
              }
            }
          ]
        }
      }
    };
  }

  /**
   * Get template for notification type and channel
   */
  getTemplate(type, channel) {
    return this.templates[type]?.[channel] || this.templates.default?.[channel];
  }

  /**
   * Format message using template
   */
  formatMessage(template, notification) {
    if (!template) {
      return { 
        subject: `Notification: ${notification.type}`,
        body: JSON.stringify(notification.data),
        text: `${notification.type}: ${JSON.stringify(notification.data)}`
      };
    }
    
    const data = notification.data;
    let formatted = JSON.parse(JSON.stringify(template));
    
    // Replace variables in all text fields
    this.replaceVariables(formatted, data);
    
    return formatted;
  }

  /**
   * Replace template variables recursively
   */
  replaceVariables(obj, data) {
    if (typeof obj === 'string') {
      return this.interpolateString(obj, data);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceVariables(item, data));
    }
    
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        obj[key] = this.replaceVariables(obj[key], data);
      });
    }
    
    return obj;
  }

  /**
   * Interpolate string with variables
   */
  interpolateString(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  /**
   * Get default channels for notification type
   */
  getDefaultChannels(type) {
    const channelConfig = {
      ticket_created: ['email', 'slack'],
      ticket_escalated: ['email', 'slack'],
      sla_breach: ['email', 'slack', 'webhook'],
      system_error: ['email', 'slack'],
      system_alert: ['slack'],
      customer_feedback: ['email'],
      performance_alert: ['slack', 'webhook']
    };
    
    return channelConfig[type] || ['email'];
  }

  /**
   * Initialize notification channels
   */
  initializeChannels() {
    const enabledChannels = [];
    
    Object.keys(this.config).forEach(channel => {
      if (this.config[channel]?.enabled) {
        enabledChannels.push(channel);
      }
    });
    
    logInfo('Notification channels initialized', { 
      channels: enabledChannels 
    });
    
    return enabledChannels;
  }

  /**
   * Store notification record
   */
  storeNotificationRecord(notification, results) {
    const record = {
      ...notification,
      results: results,
      completedAt: new Date().toISOString()
    };
    
    const props = PropertiesService.getScriptProperties();
    props.setProperty(`notification_${notification.id}`, JSON.stringify(record));
    
    // Update notification stats
    this.updateNotificationStats(notification.type, results);
  }

  /**
   * Update notification statistics
   */
  updateNotificationStats(type, results) {
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.values(results).length;
    
    Metrics.recordMetric('notification_sent', {
      type: type,
      successCount: successCount,
      totalCount: totalCount,
      successRate: totalCount > 0 ? successCount / totalCount : 0
    });
  }

  /**
   * Get notification history
   */
  getNotificationHistory(options = {}) {
    const { limit = 50, type, channel, startDate } = options;
    
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    
    const notifications = [];
    
    Object.keys(allProps).forEach(key => {
      if (key.startsWith('notification_')) {
        try {
          const notification = JSON.parse(allProps[key]);
          
          // Apply filters
          if (type && notification.type !== type) return;
          if (channel && !notification.channels.includes(channel)) return;
          if (startDate && new Date(notification.timestamp) < new Date(startDate)) return;
          
          notifications.push(notification);
          
        } catch (error) {
          logError(`Failed to parse notification ${key}`, { error: error.message });
        }
      }
    });
    
    // Sort by timestamp (newest first)
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return notifications.slice(0, limit);
  }
}

// Create singleton instance
const Notifications = new NotificationService();

// Convenience functions
function sendNotification(type, data, options) {
  return Notifications.sendNotification(type, data, options);
}

function getNotificationHistory(options) {
  return Notifications.getNotificationHistory(options);
}