# 🚀 Getting Started - Gmail Support System Setup

**Complete step-by-step guide to deploy your Gmail support system in 15 minutes!**

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Google account with Gmail access
- ✅ Google Apps Script access ([script.google.com](https://script.google.com))
- ✅ Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))
- ✅ Basic understanding of Gmail labels

## 🎯 Quick Setup (5 Minutes)

### Method 1: One-Click Deploy (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/franzenzenhofer/gmail-support-apps-script
   cd gmail-support-apps-script
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup clasp (Google Apps Script CLI):**
   ```bash
   npm run setup
   ```

4. **Deploy to Apps Script:**
   ```bash
   npm run deploy:production
   ```

### Method 2: Manual Setup (10 Minutes)

#### Step 1: Create Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **"New project"**
3. Name it **"Gmail Support System"**
4. Delete the default `myFunction()` code

#### Step 2: Copy All Files

Copy each `.gs` file from this repository into your Apps Script project:

**Core Files (Required):**
- `Code.gs` - Main system orchestrator
- `ConfigService.gs` - Configuration management
- `EmailService.gs` - Gmail operations
- `AIService.gs` - Gemini AI integration
- `KnowledgeBaseService.gs` - Knowledge base with Drive support
- `TicketService.gs` - Ticket management
- `LoopPreventionService.gs` - Email loop prevention

**Advanced Services (Optional but Recommended):**
- `AutoReplyService.gs` - Intelligent auto-replies
- `EscalationService.gs` - Smart escalation
- `MetricsService.gs` - Analytics
- `NotificationService.gs` - Multi-channel alerts
- `DebugService.gs` - Debugging tools
- `LoggingService.gs` - Advanced logging
- `ErrorService.gs` - Error handling
- `DeploymentService.gs` - CI/CD automation

**Testing & Documentation:**
- `TestRunner.gs` - Testing framework
- `ComprehensiveTests.gs` - Test suite
- `DocumentationGenerator.gs` - Auto-documentation

**UI Files:**
- `Dashboard.html` - Main dashboard
- `appsscript.json` - Manifest file

#### Step 3: Configure Your System

1. **Set up your Gemini API key:**
   - In Apps Script, go to **Settings** (gear icon)
   - Click **"Script Properties"**
   - Add property: `GEMINI_API_KEY` = `your_api_key_here`

2. **Configure the system:**
   - Open `ConfigService.gs`
   - Update the configuration:

```javascript
// In ConfigService.gs, update getDefaultConfig()
gemini: {
  apiKey: 'YOUR_GEMINI_API_KEY_HERE', // Will use Script Properties if not set
  model: 'gemini-1.5-flash',
  temperature: 0.3
},
support: {
  supportLabel: 'Support',        // Gmail label for support emails
  processedLabel: 'Processed',    // Label for processed emails
  maxEmailsPerBatch: 10,          // Emails to process per run
  autoReply: true,                // Enable auto-replies
  maxAutoReplies: 3,              // Max auto-replies per ticket
  escalationThreshold: 0.7        // Confidence threshold for escalation
},
knowledgeBase: {
  driveEnabled: true,             // Enable Google Drive integration
  driveFolder: 'Knowledge Base',  // Drive folder name
  sheetsEnabled: true,            // Enable Google Sheets KB
  sheetId: 'YOUR_SHEET_ID',       // Optional: Knowledge base sheet ID
  sources: [
    {
      type: 'drive',
      name: 'Drive Knowledge Base',
      config: {
        folderId: 'YOUR_DRIVE_FOLDER_ID', // Optional: specific folder
        includeSubfolders: true,
        fileTypes: ['docs', 'pdf', 'txt', 'md'],
        autoSync: true,
        syncInterval: 60 // minutes
      }
    }
  ]
},
scheduling: {
  enabled: true,
  intervals: {
    emailProcessing: 5,    // minutes
    knowledgeSync: 60,     // minutes
    metricsUpdate: 30,     // minutes
    healthCheck: 15        // minutes
  },
  businessHours: {
    enabled: true,
    timezone: 'America/New_York',
    start: 9,              // 9 AM
    end: 17,               // 5 PM
    days: [1, 2, 3, 4, 5]  // Monday-Friday
  }
},
languages: {
  primary: 'en',           // Primary language
  supported: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ru'],
  autoDetect: true,        // Auto-detect email language
  autoTranslate: true,     // Auto-translate responses
  useWildcards: true,      // Support wildcard language matching
  fallbackLanguage: 'en'  // Fallback for unsupported languages
}
```

#### Step 4: Set Up Gmail Labels

1. **Create Gmail labels:**
   - Go to [Gmail](https://mail.google.com)
   - Click **Settings** (gear icon) > **See all settings**
   - Go to **Labels** tab
   - Create these labels:
     - `Support` (for incoming support emails)
     - `Processed` (for processed emails)
     - `Escalated` (for escalated tickets)
     - `Auto-Reply` (for auto-replied emails)

2. **Create email filters (Optional):**
   - Go to **Filters and Blocked Addresses** tab
   - Create filter: **To: support@yourdomain.com** → **Apply label: Support**

#### Step 5: Set Up Knowledge Base

Choose one or more knowledge sources:

**Option A: Google Drive (Recommended)**
1. Create a **"Knowledge Base"** folder in Google Drive
2. Add your support documents (Google Docs, PDFs, text files)
3. Get the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID`
4. Add the folder ID to your configuration

**Option B: Google Sheets**
1. Create a new Google Sheet
2. Set up columns: `id`, `title`, `content`, `category`, `tags`, `solution`
3. Add sample knowledge articles
4. Get the sheet ID from the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID`
5. Add the sheet ID to your configuration

**Option C: External Sources**
```javascript
// Add to knowledgeBase.sources array
// Example: Replace with your actual API endpoint
{
  type: 'api',
  name: 'Your Company API',
  config: {
    endpoint: 'https://your-api-endpoint.com/kb/search',  // Replace with your API URL
    apiKey: 'your_api_key',  // Replace with your API key
    headers: {
      'Authorization': 'Bearer your_token'  // Optional: Add auth headers if needed
    }
  }
}
```

#### Step 6: Initialize the System

1. **Run the setup function:**
   - In Apps Script editor, select `setup` function
   - Click **Run** (you'll need to authorize permissions)
   - This creates triggers and initializes the system

2. **Test the system:**
   - Select `testSystemSetup` function
   - Click **Run**
   - Check the execution log for any errors

#### Step 7: Deploy as Web App (Optional)

1. **Deploy the dashboard:**
   - Click **Deploy** > **New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (or restrict as needed)
   - Click **Deploy**

2. **Save the web app URL** for accessing the dashboard

## 🔧 Advanced Configuration

### Scheduling Configuration

```javascript
// In ConfigService.gs
scheduling: {
  enabled: true,
  adaptive: true,              // Adjust intervals based on load
  intervals: {
    emailProcessing: {
      peak: 2,                 // Peak hours (minutes)
      normal: 5,               // Normal hours
      off: 15                  // Off hours
    },
    knowledgeSync: 60,
    metricsUpdate: 30
  },
  peakHours: {
    start: 9,
    end: 17,
    days: [1, 2, 3, 4, 5]
  },
  maintenance: {
    enabled: true,
    schedule: 'daily',         // daily, weekly, monthly
    time: '02:00',             // 2 AM
    duration: 30               // 30 minutes
  }
}
```

### Multi-Language Support

```javascript
languages: {
  primary: 'en',
  supported: [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ru',
    'ar', 'hi', 'th', 'vi', 'tr', 'pl', 'nl', 'sv', 'da', 'no'
  ],
  autoDetect: true,
  autoTranslate: true,
  useWildcards: true,
  wildcardPatterns: {
    'en-*': 'en',              // en-US, en-GB, etc.
    'es-*': 'es',              // es-ES, es-MX, etc.
    'zh-*': 'zh'               // zh-CN, zh-TW, etc.
  },
  responseLanguage: 'match',   // 'match', 'primary', 'auto'
  fallbackLanguage: 'en'
}
```

### Drive Integration

```javascript
knowledgeBase: {
  driveEnabled: true,
  driveConfig: {
    rootFolder: 'Knowledge Base',
    monitorFolders: [
      'Knowledge Base/FAQ',
      'Knowledge Base/Troubleshooting',
      'Knowledge Base/Policies'
    ],
    fileTypes: ['docs', 'pdf', 'txt', 'md', 'docx'],
    includeSubfolders: true,
    autoSync: true,
    syncInterval: 60,          // minutes
    extractImages: true,       // Extract images from docs
    indexContent: true,        // Full-text indexing
    versionControl: true,      // Track document versions
    permissions: {
      read: ['anyone'],
      write: ['domain']
    }
  }
}
```

## 📊 Testing Your Setup

### 1. Send Test Email

1. **Send an email to your support address**
2. **Apply the "Support" label**
3. **Wait 5 minutes** (or trigger manually)
4. **Check the logs** in Apps Script > Execution

### 2. Check Dashboard

1. **Visit your web app URL**
2. **Verify metrics are showing**
3. **Check ticket creation**

### 3. Test Knowledge Base

1. **Run the test function:**
   ```javascript
   // In Apps Script editor
   function testKnowledgeBase() {
     const results = searchKnowledgeBase('password reset');
     console.log('Knowledge base results:', results);
   }
   ```

### 4. Verify Triggers

1. **Go to Apps Script > Triggers**
2. **Verify these triggers exist:**
   - `processNewSupportEmails` (every 5 minutes)
   - `syncKnowledgeBase` (every hour)
   - `updateMetrics` (every 30 minutes)

## 🚨 Troubleshooting

### Common Issues

**1. "Gemini API key not configured"**
- Solution: Add `GEMINI_API_KEY` to Script Properties

**2. "Permission denied accessing Gmail"**
- Solution: Re-run setup() and grant permissions

**3. "No emails being processed"**
- Solution: Check Gmail labels and filters

**4. "Knowledge base not found"**
- Solution: Verify Drive folder permissions and ID

**5. "Triggers not working"**
- Solution: Delete and recreate triggers via setup()

### Debug Commands

```javascript
// Check system status
getSystemStatus();

// Test email processing
testEmailProcessing();

// Validate configuration
validateConfig();

// Generate debug report
generateDebugReport();
```

## 📈 Next Steps

1. **Monitor the system** via dashboard
2. **Add more knowledge articles** to Drive/Sheets
3. **Configure notifications** (Slack, Discord, etc.)
4. **Set up escalation rules** for complex issues
5. **Customize auto-reply templates**
6. **Add more languages** as needed

## 🎯 Pro Tips

- **Start small** - Process 5-10 emails first
- **Monitor logs** - Check execution logs regularly
- **Update knowledge base** - Add new articles weekly
- **Review metrics** - Check response times and accuracy
- **Test regularly** - Send test emails to verify functionality

## 📞 Support

- **Documentation**: Full API reference in repository
- **Issues**: Report bugs on GitHub
- **Community**: Join our Discord server
- **Professional Support**: Available for enterprise deployments

---

**🎉 Congratulations!** Your Gmail support system is now ready to transform your customer support operations!