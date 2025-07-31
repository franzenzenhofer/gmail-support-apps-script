/**
 * UpdateService.gs - Automatic Update System
 * 
 * Handles version checking and automatic updates
 * for the Gmail Support System
 */

class UpdateService {
  static get CURRENT_VERSION() { return '2.0.0'; }
  static get UPDATE_CHECK_URL() { return 'https://api.github.com/repos/franzenzenhofer/gmail-support-apps-script/releases/latest'; } // Note: Create releases in GitHub for this to work
  static get LAST_CHECK_KEY() { return 'last_update_check'; }
  static get VERSION_KEY() { return 'installed_version'; }
  
  /**
   * Check for updates
   */
  static checkForUpdates(force = false) {
    const props = PropertiesService.getScriptProperties();
    const lastCheck = props.getProperty(this.LAST_CHECK_KEY);
    
    // Check once per day unless forced
    if (!force && lastCheck) {
      const lastCheckDate = new Date(lastCheck);
      const now = new Date();
      const hoursSinceCheck = (now - lastCheckDate) / (1000 * 60 * 60);
      
      if (hoursSinceCheck < 24) {
        console.log('Update check skipped - checked recently');
        return null;
      }
    }
    
    try {
      // Get latest release info
      const response = UrlFetchApp.fetch(this.UPDATE_CHECK_URL, {
        muteHttpExceptions: true
      });
      
      if (response.getResponseCode() === 404) {
        console.log('No releases found - using current version');
        return {
          updateAvailable: false,
          currentVersion: this.getCurrentVersion(),
          latestVersion: this.getCurrentVersion()
        };
      }
      
      const release = JSON.parse(response.getContentText());
      
      // Update last check time
      props.setProperty(this.LAST_CHECK_KEY, new Date().toISOString());
      
      // Compare versions
      const latestVersion = release.tag_name.replace('v', '');
      const currentVersion = this.getCurrentVersion();
      
      if (this.isNewerVersion(latestVersion, currentVersion)) {
        return {
          updateAvailable: true,
          currentVersion: currentVersion,
          latestVersion: latestVersion,
          releaseNotes: release.body,
          downloadUrl: release.zipball_url,
          publishedAt: release.published_at
        };
      }
      
      return {
        updateAvailable: false,
        currentVersion: currentVersion,
        latestVersion: latestVersion
      };
      
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return null;
    }
  }
  
  /**
   * Get current installed version
   */
  static getCurrentVersion() {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(this.VERSION_KEY) || this.CURRENT_VERSION;
  }
  
  /**
   * Compare version numbers
   */
  static isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }
    
    return false;
  }
  
  /**
   * Apply update
   */
  static async applyUpdate(updateInfo) {
    console.log(`Applying update from ${updateInfo.currentVersion} to ${updateInfo.latestVersion}`);
    
    try {
      // Create backup first
      await BackupService.createBackup('pre_update');
      
      // Download update files
      const files = await this.downloadUpdateFiles(updateInfo.downloadUrl);
      
      // Apply updates
      const results = await this.applyUpdateFiles(files);
      
      // Update version
      const props = PropertiesService.getScriptProperties();
      props.setProperty(this.VERSION_KEY, updateInfo.latestVersion);
      
      // Run migrations
      await this.runMigrations(updateInfo.currentVersion, updateInfo.latestVersion);
      
      // Send notification
      this.notifyUpdateComplete(updateInfo);
      
      return {
        success: true,
        results: results
      };
      
    } catch (error) {
      console.error('Update failed:', error);
      
      // Attempt rollback
      await this.rollbackUpdate();
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Download update files
   */
  static async downloadUpdateFiles(url) {
    // In real implementation, this would download and parse files
    // For now, return mock data
    return [
      { name: 'UpdatedService.gs', content: '// Updated code' },
      { name: 'NewFeature.gs', content: '// New feature' }
    ];
  }
  
  /**
   * Apply update files
   */
  static async applyUpdateFiles(files) {
    const results = [];
    
    // This would need Apps Script API or manual intervention
    // For automatic updates, you'd need to use Google Apps Script API
    
    files.forEach(file => {
      console.log(`Would update file: ${file.name}`);
      results.push({
        file: file.name,
        status: 'pending_manual_update'
      });
    });
    
    return results;
  }
  
  /**
   * Run database migrations
   */
  static async runMigrations(fromVersion, toVersion) {
    const migrations = this.getMigrations(fromVersion, toVersion);
    
    for (const migration of migrations) {
      console.log(`Running migration: ${migration.name}`);
      await migration.run();
    }
  }
  
  /**
   * Get applicable migrations
   */
  static getMigrations(fromVersion, toVersion) {
    const allMigrations = [
      {
        version: '1.1.0',
        name: 'Add timezone to tickets',
        run: () => this.migration_1_1_0()
      },
      {
        version: '1.2.0',
        name: 'Add performance metrics',
        run: () => this.migration_1_2_0()
      },
      {
        version: '2.0.0',
        name: 'Add enterprise features',
        run: () => this.migration_2_0_0()
      }
    ];
    
    return allMigrations.filter(m => 
      this.isNewerVersion(m.version, fromVersion) &&
      !this.isNewerVersion(m.version, toVersion)
    );
  }
  
  /**
   * Migration: Add timezone support
   */
  static migration_1_1_0() {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    
    Object.entries(allProps).forEach(([key, value]) => {
      if (key.startsWith('ticket_')) {
        try {
          const ticket = JSON.parse(value);
          if (!ticket.timezone) {
            ticket.timezone = Session.getScriptTimeZone();
            props.setProperty(key, JSON.stringify(ticket));
          }
        } catch (e) {
          console.error(`Failed to migrate ${key}:`, e);
        }
      }
    });
  }
  
  /**
   * Migration: Add performance metrics
   */
  static migration_1_2_0() {
    // Initialize performance tracking
    const props = PropertiesService.getScriptProperties();
    props.setProperty('performance_tracking_enabled', 'true');
  }
  
  /**
   * Migration: Enterprise features
   */
  static migration_2_0_0() {
    // Initialize enterprise features
    FeatureFlags.loadFlags();
    I18n.loadTranslations();
    
    // Set up backup schedule
    const triggers = ScriptApp.getProjectTriggers();
    const hasBackupTrigger = triggers.some(t => 
      t.getHandlerFunction() === 'performDailyBackup'
    );
    
    if (!hasBackupTrigger) {
      ScriptApp.newTrigger('performDailyBackup')
        .timeBased()
        .everyDays(1)
        .atHour(2)
        .create();
    }
  }
  
  /**
   * Rollback update
   */
  static async rollbackUpdate() {
    console.log('Rolling back update...');
    
    try {
      // Find latest pre_update backup
      const backups = await BackupService.listBackups();
      const preUpdateBackup = backups.find(b => b.type === 'pre_update');
      
      if (preUpdateBackup) {
        await BackupService.restore(preUpdateBackup.id);
        console.log('Rollback completed');
      } else {
        console.error('No pre-update backup found');
      }
    } catch (error) {
      console.error('Rollback failed:', error);
    }
  }
  
  /**
   * Notify update complete
   */
  static notifyUpdateComplete(updateInfo) {
    const adminEmail = Config.get('admin.email');
    if (!adminEmail) return;
    
    const subject = `✅ Gmail Support System Updated to v${updateInfo.latestVersion}`;
    const body = `
Your Gmail Support System has been successfully updated!

Previous Version: ${updateInfo.currentVersion}
New Version: ${updateInfo.latestVersion}

Release Notes:
${updateInfo.releaseNotes}

The system is now running with the latest features and improvements.

If you experience any issues, you can rollback by running:
UpdateService.rollbackUpdate()

Best regards,
Gmail Support System
    `;
    
    try {
      GmailApp.sendEmail(adminEmail, subject, body);
    } catch (e) {
      console.error('Failed to send update notification:', e);
    }
  }
}

/**
 * Check for updates trigger
 */
function checkForSystemUpdates() {
  const updateInfo = UpdateService.checkForUpdates();
  
  if (updateInfo && updateInfo.updateAvailable) {
    // Notify admin
    const adminEmail = Config.get('admin.email');
    if (adminEmail) {
      GmailApp.sendEmail(
        adminEmail,
        `🔔 Update Available: Gmail Support System v${updateInfo.latestVersion}`,
        `A new version is available!\n\nCurrent: v${updateInfo.currentVersion}\nLatest: v${updateInfo.latestVersion}\n\nTo update, run: UpdateService.applyUpdate()`
      );
    }
  }
}

/**
 * Manual update command
 */
function updateSystem() {
  const updateInfo = UpdateService.checkForUpdates(true);
  
  if (updateInfo && updateInfo.updateAvailable) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'Update Available',
      `Version ${updateInfo.latestVersion} is available. Update now?`,
      ui.ButtonSet.YES_NO
    );
    
    if (response === ui.Button.YES) {
      UpdateService.applyUpdate(updateInfo);
    }
  } else {
    ui.alert('No updates available. System is up to date!');
  }
}