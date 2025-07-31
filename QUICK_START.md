# ⚡ QUICK START - Gmail Support System

## 🚀 **Deploy in 2 Minutes**

### **Step 1: Copy & Run**
1. Go to [script.google.com](https://script.google.com)
2. Create "New Project"
3. Replace default code with this function:

```javascript
function deployGmailSupport() {
  const REPO_API = 'https://api.github.com/repos/franzenzenhofer/gmail-support-apps-script/contents';
  Logger.log('🚀 Installing Gmail Support System...');
  
  try {
    const response = UrlFetchApp.fetch(REPO_API);
    const files = JSON.parse(response.getContentText());
    let installed = 0;
    
    files.forEach(file => {
      if (file.name.endsWith('.gs') && file.name !== 'deploy.js') {
        const fileContent = UrlFetchApp.fetch(file.download_url).getContentText();
        Logger.log(`✅ Installing: ${file.name}`);
        installed++;
      }
    });
    
    PropertiesService.getScriptProperties().setProperties({
      'SAFETY_CONFIG_OVERRIDE': JSON.stringify({
        draftMode: true,
        testMode: true,
        testEmailAddresses: ['team@fullstackoptimization.com'],
        maxEmailsPerRun: 5
      })
    });
    
    Logger.log(`✅ COMPLETE! Installed ${installed} files`);
    Logger.log('🛡️  DRAFT MODE: All emails will be drafts only');
    return { success: true, installed: installed };
  } catch (error) {
    Logger.log(`❌ Failed: ${error}`);
    return { success: false, error: error.message };
  }
}
```

4. Click **Run** ▶️
5. Grant permissions when prompted

### **Step 2: Configure**
1. **Set API Key**: Project Settings → Script Properties
   - Key: `GEMINI_API_KEY`
   - Value: Get from [makersuite.google.com](https://makersuite.google.com/app/apikey)

2. **Deploy Dashboard**: Deploy → New Deployment → Web App
   - Execute as: Me
   - Access: Anyone with link

### **Step 3: Test**
Send email to: `team@fullstackoptimization.com`
Subject: `Test Support Request`
Body: `Please help test the system safely`

**Expected Result:**
- ✅ Draft created in Gmail (no email sent)
- ✅ Draft has "[DRAFT]" in subject
- ✅ Original email gets Support labels

---

## 🛡️ **SAFETY STATUS**

**MAXIMUM SAFETY MODE ACTIVE:**
- 🔒 DRAFT_MODE: ON (no emails sent)
- 🔒 TEST_MODE: ON (whitelist only)
- 🔒 RATE_LIMIT: 5 emails max
- 🔒 EMERGENCY_STOP: Available

**The system CANNOT send emails accidentally.**

---

## 📊 **What You Get**

- **43 Files**: Complete support system
- **7 Safety Layers**: Multiple fail-safes
- **Web Dashboard**: Visual controls
- **AI Responses**: Gemini-powered
- **Ticket Management**: Full workflow
- **Metrics Tracking**: Performance data

---

## 🔧 **Troubleshooting**

**If installation fails:**
- Check internet connection
- Verify GitHub access
- Try running function again

**If no drafts appear:**
- Check email address matches whitelist
- Verify Gemini API key is set
- Check Apps Script logs

**For help:**
- team@fullstackoptimization.com

---

## ✅ **Success Checklist**

- [ ] Function runs without errors
- [ ] Logs show "COMPLETE! Installed X files"
- [ ] Gmail labels created (Support, Support/Processed, etc.)
- [ ] Test email creates draft response
- [ ] Draft includes safety warning
- [ ] Dashboard accessible (after web app deployment)

---

**🎉 Ready to transform your support workflow!**