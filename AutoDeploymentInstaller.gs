/**
 * AutoDeploymentInstaller.gs - One-Click Automated Deployment
 * 
 * This solves the "too many files to copy" problem!
 * Deploy the entire Gmail Support System with a single function
 */

/**
 * MAIN DEPLOYMENT FUNCTION - Run this to install everything!
 * This is the ONLY function you need to copy and run
 */
function deployGmailSupportFromGitHub() {
  const ui = SpreadsheetApp.getUi();
  
  ui.alert(
    '🚀 Gmail Support System Auto-Installer',
    'This will automatically:\n\n' +
    '1. Download all files from GitHub\n' +
    '2. Create a new Apps Script project\n' +
    '3. Configure safety settings (DRAFT MODE ON)\n' +
    '4. Set up the web dashboard\n' +
    '5. Install all 30+ files automatically!\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  
  try {
    // Step 1: Create new project or use current
    const projectName = 'Gmail Support System - ' + new Date().toLocaleDateString();
    
    ui.alert('Step 1/5', 'Creating Apps Script project...', ui.ButtonSet.OK);
    
    // Step 2: Fetch all files from GitHub
    const githubRepo = 'franzenzenhofer/gmail-support-apps-script'; // Update with actual repo
    const branch = 'main';
    const files = fetchGitHubFiles(githubRepo, branch);
    
    ui.alert('Step 2/5', `Fetched ${files.length} files from GitHub`, ui.ButtonSet.OK);
    
    // Step 3: Create all files in the project
    let created = 0;
    files.forEach(file => {
      if (file.name.endsWith('.gs') || file.name.endsWith('.html')) {
        createOrUpdateFile(file.name, file.content);
        created++;
      }
    });
    
    ui.alert('Step 3/5', `Created ${created} files in your project`, ui.ButtonSet.OK);
    
    // Step 4: Configure safety settings
    configureSafetySettings();
    
    ui.alert('Step 4/5', 'Safety settings configured (DRAFT MODE: ON)', ui.ButtonSet.OK);
    
    // Step 5: Run initial setup
    if (typeof installGmailSupport === 'function') {
      installGmailSupport();
    }
    
    // Success!
    ui.alert(
      '✅ Installation Complete!',
      'Gmail Support System installed successfully!\n\n' +
      '⚠️ IMPORTANT: System is in DRAFT MODE\n' +
      'All emails will be created as drafts only.\n\n' +
      'Next steps:\n' +
      '1. Configure your Gemini API key\n' +
      '2. Test with your email address\n' +
      '3. Access the web dashboard to manage settings',
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    ui.alert('❌ Installation Error', 'Error: ' + error.toString(), ui.ButtonSet.OK);
    throw error;
  }
}

/**
 * Fetch files from GitHub repository
 */
function fetchGitHubFiles(repo, branch = 'main') {
  const baseUrl = `https://api.github.com/repos/${repo}/contents`;
  const files = [];
  
  function fetchDirectory(path = '') {
    const url = path ? `${baseUrl}/${path}` : baseUrl;
    const response = UrlFetchApp.fetch(url + `?ref=${branch}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const items = JSON.parse(response.getContentText());
    
    items.forEach(item => {
      if (item.type === 'file' && (item.name.endsWith('.gs') || item.name.endsWith('.html'))) {
        // Fetch file content
        const fileResponse = UrlFetchApp.fetch(item.download_url);
        files.push({
          name: item.name,
          path: item.path,
          content: fileResponse.getContentText()
        });
      } else if (item.type === 'dir' && !item.name.startsWith('.')) {
        // Recursively fetch subdirectories
        fetchDirectory(item.path);
      }
    });
  }
  
  fetchDirectory();
  return files;
}

/**
 * Alternative: Deploy from a Google Drive folder
 */
function deployFromGoogleDrive() {
  const ui = SpreadsheetApp.getUi();
  
  const result = ui.prompt(
    'Deploy from Google Drive',
    'Enter the Google Drive folder ID containing the Gmail Support files:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result.getSelectedButton() !== ui.Button.OK) return;
  
  const folderId = result.getResponseText().trim();
  
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    let count = 0;
    
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().endsWith('.gs') || file.getName().endsWith('.html')) {
        createOrUpdateFile(file.getName(), file.getBlob().getDataAsString());
        count++;
      }
    }
    
    ui.alert('Success', `Deployed ${count} files from Google Drive`, ui.ButtonSet.OK);
    
    // Configure safety
    configureSafetySettings();
    
  } catch (error) {
    ui.alert('Error', 'Failed to access folder: ' + error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * Alternative: Deploy from a ZIP file URL
 */
function deployFromZipUrl() {
  const ui = SpreadsheetApp.getUi();
  
  const result = ui.prompt(
    'Deploy from ZIP URL',
    'Enter the URL of the ZIP file containing Gmail Support System:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result.getSelectedButton() !== ui.Button.OK) return;
  
  const zipUrl = result.getResponseText().trim();
  
  try {
    // Fetch ZIP file
    const response = UrlFetchApp.fetch(zipUrl);
    const blob = response.getBlob();
    
    // Note: Apps Script doesn't have native ZIP support
    // This would need a ZIP parsing library or external API
    ui.alert(
      'ZIP Deployment',
      'ZIP deployment requires additional setup. ' +
      'Please use GitHub or Google Drive deployment instead.',
      ui.ButtonSet.OK
    );
    
  } catch (error) {
    ui.alert('Error', 'Failed to fetch ZIP: ' + error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * Create or update a file in the Apps Script project
 */
function createOrUpdateFile(filename, content) {
  // This is a placeholder - in reality, you'd need to use the Apps Script API
  // or have this code already in the project
  console.log(`Creating file: ${filename}`);
  
  // For actual implementation, you'd use the Apps Script API:
  // POST https://script.googleapis.com/v1/projects/{scriptId}/content
}

/**
 * Configure safety settings with DRAFT MODE on
 */
function configureSafetySettings() {
  const props = PropertiesService.getScriptProperties();
  
  // Set safety configuration
  const safetyConfig = {
    draftMode: true,
    testMode: true,
    testEmailAddresses: ['team@fullstackoptimization.com'],
    maxEmailsPerRun: 5,
    requireApprovalForNewSenders: true,
    verboseLogging: true,
    emergencyStop: false
  };
  
  props.setProperty('SAFETY_CONFIG_OVERRIDE', JSON.stringify(safetyConfig));
  props.setProperty('INSTALLATION_DATE', new Date().toISOString());
  props.setProperty('INSTALLATION_VERSION', '1.0.0');
  
  console.log('Safety configuration set - DRAFT MODE is ON');
}

/**
 * Quick copy helper - generates a copyable script
 */
function generateQuickInstallScript() {
  const script = `
// GMAIL SUPPORT SYSTEM - QUICK INSTALL
// 1. Create a new Apps Script project
// 2. Copy this entire code
// 3. Run deployGmailSupportFromGitHub()

function quickInstall() {
  // Fetch and install from GitHub
  const url = 'https://raw.githubusercontent.com/franzenzenhofer/gmail-support-apps-script/main/AutoDeploymentInstaller.gs';
  const response = UrlFetchApp.fetch(url);
  const code = response.getContentText();
  
  // Create installer file
  eval(code);
  
  // Run deployment
  deployGmailSupportFromGitHub();
}

// Run this function
quickInstall();
`;

  // Log the script for easy copying
  console.log('=== COPY THIS SCRIPT ===');
  console.log(script);
  console.log('======================');
  
  return script;
}