# 🧪 Testing Guide - Gmail Support System

## After Deployment Testing Checklist

### 1. ✅ Safety Verification (CRITICAL)

**Check DRAFT_MODE Status:**
- Open Apps Script → View → Logs
- Look for: "DRAFT MODE is ON"
- Verify: No "LIVE MODE" messages

**Verify Test Mode:**
- Check Script Properties for `SAFETY_CONFIG_OVERRIDE`
- Should contain: `"testMode": true`
- Should contain: `"draftMode": true`

### 2. 📧 Email Testing Flow

**Send Test Email:**
1. Send email to: `team@fullstackoptimization.com`
2. Subject: "Test Support Request - DRAFT MODE"
3. Body: "This is a test of the support system. Please respond with helpful information."

**Expected Behavior:**
- ✅ System processes the email
- ✅ Creates a DRAFT response (no email sent)
- ✅ Draft includes "[DRAFT]" in subject
- ✅ Draft includes safety warning header
- ✅ Ticket is created with ID
- ✅ Labels are applied to email

**Check Results:**
- Go to Gmail → Drafts folder
- Look for draft with "[DRAFT]" prefix
- Verify safety warning in draft body
- Check original email has Support labels

### 3. 🎛️ Dashboard Testing

**Access Dashboard:**
1. Deploy project as Web App
2. Copy the web app URL
3. Open in browser
4. Should show red warning banner: "DRAFT MODE ACTIVE"

**Dashboard Checks:**
- ✅ Red warning banner visible
- ✅ Safety toggles show correct state
- ✅ Draft mode toggle is ON
- ✅ Test mode toggle is ON
- ✅ Max emails shows 5 or less
- ✅ System status shows "Safe"

### 4. 🔍 Log Analysis

**Check Apps Script Logs:**
```
Expected log entries:
- "DRAFT MODE is ON"
- "Processing email from team@fullstackoptimization.com"
- "Creating draft instead of sending"
- "Draft created with ID: draft-xxxxx"
- "Safety check passed"
```

**What NOT to see:**
- ❌ "Sending email to..."
- ❌ "Email sent successfully"
- ❌ "LIVE MODE active"
- ❌ Any error messages

### 5. 🛡️ Safety Mechanism Tests

**Test Email Filtering:**
1. Send email from non-whitelisted address
2. Should see: "Skipping email due to safety rules"
3. No processing should occur

**Test Rate Limiting:**
1. Send multiple emails quickly
2. Should see rate limiting messages after 5 emails
3. System should throttle processing

**Test Emergency Stop:**
1. Access dashboard
2. Toggle Emergency Stop to ON
3. Send test email
4. Should see: "Emergency stop is active"
5. No processing should occur

### 6. 🔧 Configuration Testing

**API Key Validation:**
- Remove or set invalid API key
- Send test email
- Should see: "API key not configured" error
- No crash should occur

**Business Hours (if configured):**
- Test outside business hours
- Should respect time restrictions

### 7. 📊 Performance Testing

**Memory Usage:**
- Process several test emails
- Check for memory cleanup messages
- System should not crash

**Execution Time:**
- Large emails should process within time limits
- Should see execution time monitoring

### 8. 🚨 Error Handling Testing

**Invalid Email Format:**
- Test with malformed email
- Should handle gracefully with error message

**Large Email Body:**
- Send very long email
- Should truncate or handle appropriately

**Network Issues:**
- Test with API failures
- Should retry and handle errors

## ✅ Acceptance Criteria

**System is ready for production when ALL of these are true:**

- [ ] DRAFT_MODE is confirmed ON
- [ ] Test emails create drafts only (no sending)
- [ ] Dashboard shows safety warnings
- [ ] Email filtering works correctly
- [ ] Rate limiting is active
- [ ] Error handling works properly
- [ ] Logs show expected safety messages
- [ ] Emergency stop functions correctly
- [ ] API key validation works
- [ ] Performance is acceptable

## 🚨 Safety Checklist Before Going Live

**NEVER enable live mode unless:**

- [ ] Tested with multiple email scenarios
- [ ] Verified all safety mechanisms work
- [ ] Confirmed email responses are appropriate
- [ ] Knowledge base is properly configured
- [ ] Team is trained on dashboard controls
- [ ] Monitoring and alerting is set up
- [ ] Backup and recovery plan exists

---

**Remember: The system is designed to be safe by default. Only enable live mode after thorough testing and team approval!**