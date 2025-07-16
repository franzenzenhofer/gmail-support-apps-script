# Gmail Support System - Deployment Guide

## 🚀 Deployment Options

### Option 1: Manual Deployment (Easiest)

1. **Create Apps Script Project**
   ```
   1. Go to script.google.com
   2. Create new project
   3. Copy all .gs and .html files
   4. Save project
   ```

2. **Configure Settings**
   ```javascript
   // In ConfigService.gs
   gemini: {
     apiKey: 'YOUR_API_KEY' // Required!
   }
   ```

3. **Run Setup**
   ```javascript
   // Run once from Apps Script editor
   setup();
   ```

4. **Deploy as Web App**
   ```
   Deploy > New Deployment > Web app
   Execute as: Me
   Access: Anyone (or restrict)
   ```

### Option 2: Clasp Deployment (Automated)

#### Prerequisites
- Node.js 14+
- npm or yarn
- Google account

#### Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Login to Google**
   ```bash
   npm run login
   ```

3. **Create New Project**
   ```bash
   npm run create
   ```
   
   Or clone existing:
   ```bash
   # Update .clasp.json with your script ID
   npm run clone
   ```

4. **Configure Script ID**
   ```json
   // .clasp.json
   {
     "scriptId": "YOUR_SCRIPT_ID_HERE"
   }
   ```

5. **Push Code**
   ```bash
   npm run push
   ```

6. **Deploy**
   ```bash
   npm run deploy:prod
   ```

### Option 3: CI/CD Pipeline

#### GitHub Actions Setup

1. **Create Workflow**
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy to Apps Script
   
   on:
     push:
       branches: [main]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'
             
         - name: Install dependencies
           run: npm install
           
         - name: Setup clasp
           run: |
             echo "${{ secrets.CLASP_CREDS }}" > ~/.clasprc.json
             echo '{"scriptId":"${{ secrets.SCRIPT_ID }}"}' > .clasp.json
             
         - name: Deploy
           run: npm run deploy:prod
   ```

2. **Add Secrets**
   - `CLASP_CREDS`: Your .clasprc.json contents
   - `SCRIPT_ID`: Your Apps Script project ID

## 🔧 Configuration

### Environment Variables

Create Script Properties in Apps Script:

```javascript
// Set properties
PropertiesService.getScriptProperties().setProperty('ENVIRONMENT', 'production');
PropertiesService.getScriptProperties().setProperty('DEBUG_MODE', 'false');
PropertiesService.getScriptProperties().setProperty('VERSION', '1.0.0');
```

### API Keys

Store securely in Script Properties:

```javascript
// Set Gemini API key
PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', 'your-key');

// Set other API keys
PropertiesService.getScriptProperties().setProperty('SLACK_WEBHOOK', 'your-webhook');
```

## 📋 Pre-Deployment Checklist

- [ ] Gemini API key configured
- [ ] Knowledge base source configured
- [ ] Email labels created
- [ ] Time triggers set up
- [ ] Permissions granted
- [ ] Test emails processed successfully
- [ ] Dashboard accessible
- [ ] Error handling tested

## 🔄 Update Process

### 1. Test Changes Locally
```bash
# Watch for changes
npm run dev

# View logs
npm run logs:watch
```

### 2. Run Tests
```bash
npm run test
```

### 3. Deploy to Staging
```javascript
deploy('staging', {
  version: '1.1.0',
  runTests: true,
  backup: true
});
```

### 4. Deploy to Production
```javascript
deploy('production', {
  version: '1.1.0',
  notify: true
});
```

## 🔙 Rollback Process

### Immediate Rollback
```javascript
// Rollback last deployment
rollback('deployment-id');
```

### Manual Rollback
1. Open Apps Script editor
2. File > See version history
3. Restore previous version

## 📊 Monitoring

### View Logs
```bash
# Real-time logs
npm run logs:watch

# Or in Apps Script
View > Logs
```

### Check Deployment Status
```javascript
const report = getDeploymentReport({
  includeHistory: true
});
console.log(report);
```

### Monitor Health
```javascript
const health = getSystemHealth();
const metrics = getMetrics();
const errors = getErrorStats();
```

## 🚨 Troubleshooting

### Common Deployment Issues

1. **"Authorization required"**
   ```bash
   npm run login
   ```

2. **"Script not found"**
   - Check .clasp.json scriptId
   - Ensure you have access to the script

3. **"Deployment failed"**
   - Check pre-deployment tests
   - Verify API quotas
   - Review error logs

### Debug Deployment
```javascript
// Enable debug mode
setDebugMode(true);

// Get detailed deployment info
const deployment = getDeploymentHistory({ limit: 1 })[0];
console.log(deployment);

// Check deployment manifest
const manifest = PropertiesService.getScriptProperties()
  .getProperty('DEPLOYMENT_MANIFEST');
console.log(JSON.parse(manifest));
```

## 🔒 Security Considerations

### Production Deployment

1. **Restrict Access**
   ```javascript
   webapp: {
     executeAs: "USER_DEPLOYING",
     access: "DOMAIN" // Restrict to your domain
   }
   ```

2. **Enable Audit Logging**
   ```javascript
   logging: {
     level: 'INFO',
     auditEnabled: true,
     cloudLogging: true
   }
   ```

3. **Set Permissions**
   ```javascript
   deployment: {
     admins: ['admin@company.com'],
     environments: {
       production: {
         restricted: true,
         approvers: ['manager@company.com']
       }
     }
   }
   ```

## 📈 Performance Optimization

### For Large Deployments

1. **Enable Caching**
   ```javascript
   cache: {
     enabled: true,
     ttl: 3600,
     distributed: true
   }
   ```

2. **Optimize Triggers**
   ```javascript
   // Batch processing
   ScriptApp.newTrigger('processEmails')
     .timeBased()
     .everyMinutes(5)
     .create();
   ```

3. **Use Batch Operations**
   ```javascript
   batchProcess: {
     enabled: true,
     size: 50,
     parallel: true
   }
   ```

## 🌍 Multi-Region Deployment

### Deploy to Multiple Projects

```bash
# Deploy to US
SCRIPT_ID=us-script-id npm run deploy:prod

# Deploy to EU
SCRIPT_ID=eu-script-id npm run deploy:prod

# Deploy to APAC
SCRIPT_ID=apac-script-id npm run deploy:prod
```

### Sync Configuration
```javascript
// Sync across regions
const regions = ['us', 'eu', 'apac'];
regions.forEach(region => {
  deployToRegion(region, config);
});
```

## 📝 Post-Deployment

### 1. Verify Deployment
- Check dashboard loads
- Process test email
- Verify knowledge base search
- Test error handling

### 2. Monitor Initial Hours
- Watch error rates
- Check response times
- Monitor API usage
- Review user feedback

### 3. Document Changes
- Update CHANGELOG.md
- Note configuration changes
- Document any issues
- Update runbooks

## 🆘 Emergency Procedures

### System Down
1. Check Apps Script status page
2. Review error logs
3. Rollback if needed
4. Enable maintenance mode

### High Error Rate
1. Enable debug mode
2. Check recent deployments
3. Review error patterns
4. Scale back automation

### API Quota Exceeded
1. Enable rate limiting
2. Reduce batch sizes
3. Implement caching
4. Contact Google support

---

**Remember**: Always test in staging before production deployment!