# Gmail Support System - Deploy

## Quickest Deploy (One Command)
```bash
npx gmail-support-deploy
```

## Manual Deploy (3 Steps)
```bash
npm install -g @google/clasp
gh repo clone franzenzenhofer/gmail-support-apps-script
npm run quickstart
```

## Direct Deploy (No Terminal)
```javascript
// Run in Apps Script:
UrlFetchApp.fetch('https://raw.githubusercontent.com/franzenzenhofer/gmail-support-apps-script/main/deploy.js').getContentText() && autoInstall()
```

## Safety: Always Starts in DRAFT MODE
- ✅ No emails sent automatically
- ✅ All emails saved as drafts only
- ✅ Dashboard shows warning banner
- ✅ Test mode enabled

## Support
team@fullstackoptimization.com