# 🎨 Prompt Customization Guide

## Transform Your AI Assistant's Personality and Behavior

This guide shows you how to customize every aspect of your Gmail Support System's AI responses - no coding required!

## Table of Contents
- [Quick Start](#quick-start)
- [Understanding Prompts](#understanding-prompts)
- [Using the Visual Editor](#using-the-visual-editor)
- [Common Customizations](#common-customizations)
- [Advanced Techniques](#advanced-techniques)
- [Industry-Specific Examples](#industry-specific-examples)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Quick Start

### Method 1: Visual Editor (Easiest)
1. Open your Google Sheet
2. Go to **Extensions → Gmail Support → Edit AI Prompts**
3. Select a prompt from the dropdown
4. Make your changes
5. Click **Save Changes**
6. That's it! Changes apply immediately

### Method 2: Script Properties
1. Go to **Project Settings → Script Properties**
2. Add a property like: `prompt.email.analysis`
3. Paste your custom prompt
4. Save

### Method 3: Code (For Developers)
```javascript
// In your script
PromptConfigService.setPrompt(
  'prompt.response.generation',
  'Your custom prompt here...'
);
```

## Understanding Prompts

### What Are Prompts?
Prompts are instructions that tell the AI how to:
- Analyze emails
- Generate responses
- Categorize issues
- Detect urgency
- Understand sentiment

### Available Prompts

| Prompt Key | Purpose | When It's Used |
|------------|---------|----------------|
| `prompt.email.analysis` | Analyzes incoming emails | Every new email |
| `prompt.response.generation` | Creates replies | When generating responses |
| `prompt.categorization` | Assigns categories | During email processing |
| `prompt.sentiment` | Detects emotions | Analysis phase |
| `prompt.urgency` | Determines priority | SLA calculation |
| `prompt.language` | Detects language | Multi-language support |
| `prompt.summary` | Creates summaries | Ticket creation |
| `prompt.kb.search` | Searches knowledge base | Finding solutions |
| `prompt.escalation` | Decides escalation | Human handoff |
| `prompt.followup` | Suggests next steps | After resolution |

## Using the Visual Editor

### Step-by-Step Guide

1. **Open the Editor**
   ```
   Extensions → Gmail Support → Edit AI Prompts
   ```

2. **Select a Prompt**
   - Choose from the dropdown menu
   - The current prompt appears in the editor
   - Green dot = customized, Gray dot = default

3. **Edit the Prompt**
   - Type directly in the text area
   - Use variables with `{{variable}}` syntax
   - Preview shows real-time results

4. **Test Your Changes**
   - Click "Test Prompt" to see sample output
   - Adjust until satisfied

5. **Save or Reset**
   - **Save Changes**: Apply your customization
   - **Reset to Default**: Restore original prompt
   - **Clear**: Start fresh

### Understanding Variables

Variables let you insert dynamic content:

```
{{email.from}} → customer@example.com
{{email.subject}} → Help with password reset
{{customer.name}} → John Doe
{{analysis.category}} → technical
```

## Common Customizations

### 1. Change Response Tone

**Friendly & Casual:**
```javascript
// Add to response generation prompt
"Use a warm, friendly tone with casual language.
Feel free to use exclamation points and emojis! 😊
Start with 'Hi [Name]!' and end with 'Cheers!'"
```

**Formal & Professional:**
```javascript
"Use formal business language throughout.
Address as 'Dear Mr./Ms. [LastName]'
Avoid contractions and maintain professional distance.
Sign off with 'Sincerely' or 'Best regards'"
```

**Technical & Direct:**
```javascript
"Be concise and technical.
Use bullet points for steps.
Include relevant technical details and specifications.
Skip pleasantries and focus on solutions."
```

### 2. Add Company Information

```javascript
// Extend any prompt with:
"Our business hours: Monday-Friday 9 AM - 6 PM EST
Support phone: 1-800-SUPPORT
Live chat available at: support.company.com
Premium support for Enterprise customers"
```

### 3. Custom Categories

Replace the default categories in the categorization prompt:

```javascript
"Categories for our business:
- returns: Product returns, refunds, exchanges
- shipping: Delivery issues, tracking, delays
- technical-hardware: Device malfunctions
- technical-software: App or website issues
- account-billing: Payment, subscription, invoices
- account-access: Login problems, password resets
- product-inquiry: Pre-sales questions
- feedback: Suggestions, complaints, praise"
```

### 4. Industry-Specific Keywords

Add to email analysis prompt:
```javascript
"Pay special attention to these industry terms:
- SKU numbers (format: ABC-12345)
- Order IDs (format: ORD-XXXXXXXX)
- Subscription tiers: Basic, Pro, Enterprise
- Common issues: 'sync error', 'payment failed', 'access denied'
- Product names: [List your products]"
```

### 5. Multi-Language Instructions

```javascript
// In response generation:
"If customer language is {{analysis.language}}:
- Respond in the same language
- Use culturally appropriate greetings
- Format dates and currency for their locale
- If unsure, ask for language preference"
```

## Advanced Techniques

### 1. Conditional Logic

Use if/then structures in your prompts:

```javascript
{{#if customer.vip}}
  Provide white-glove service with priority handling.
  Mention their VIP status and exclusive benefits.
{{/if}}

{{#if analysis.sentiment == 'angry'}}
  Start with a sincere apology.
  Acknowledge their frustration explicitly.
  Offer immediate escalation option.
{{/if}}
```

### 2. Dynamic Instructions

Create prompts that adapt based on context:

```javascript
"Response length should be:
{{#if analysis.urgency > 0.8}}
  - Very brief (50-100 words)
  - Direct solution only
{{else}}
  - Comprehensive (200-300 words)
  - Include explanation and alternatives
{{/if}}"
```

### 3. Template Responses

Build reusable response templates:

```javascript
"For category '{{analysis.category}}', use this template:

{{#if analysis.category == 'password-reset'}}
Hi {{customer.name}},

I'll help you reset your password right away:

1. Click here: [Reset Password Link]
2. Enter your email: {{email.from}}
3. Check your inbox for the reset code
4. Create a new secure password

The link expires in 1 hour for security.

Need more help? I'm here!
{{/if}}"
```

### 4. Chaining Prompts

Reference other prompt outputs:

```javascript
"Based on the urgency score ({{analysis.urgency}}):
- If > 0.8: Route to senior support immediately
- If > 0.5: Flag for supervisor review
- Otherwise: Standard processing

Previous analysis determined: {{analysis.summary}}"
```

## Industry-Specific Examples

### E-commerce
```javascript
// Add to email analysis:
"Extract and validate:
- Order numbers (6-10 digits)
- Product SKUs
- Shipping tracking numbers
- Return request reasons
- Payment method issues

Flag high-value orders (>$500) for priority handling."

// Add to response generation:
"Always include:
- Estimated delivery/resolution time
- Return policy reminder (30 days)
- Link to order tracking
- Offer discount code for inconvenience (if applicable)"
```

### SaaS/Software
```javascript
// Add to categorization:
"Software-specific categories:
- bug-report: Software defects
- feature-request: New functionality
- integration: Third-party connections
- api-issue: Developer/API problems
- performance: Speed/reliability issues
- security: Security concerns
- onboarding: Setup and getting started"

// Add to response:
"Include relevant:
- Documentation links
- API status page
- Known issues/workarounds
- Version numbers
- System requirements"
```

### Healthcare
```javascript
// Add to all prompts:
"HIPAA Compliance Requirements:
- Never mention specific medical conditions
- Use case numbers, not patient names
- Include privacy notice in all responses
- Offer secure communication channel
- Flag any health emergencies for immediate escalation"
```

### Financial Services
```javascript
// Add to analysis:
"Security-sensitive detection:
- Password/PIN mentions → Flag for secure handling
- Account numbers → Mask in responses
- Transaction disputes → Priority routing
- Fraud mentions → Immediate escalation
- Regulatory keywords → Compliance team"
```

### Education
```javascript
// Add to response:
"Educational tone:
- Patient and encouraging
- Provide learning resources
- Break down complex topics
- Offer video tutorials when available
- Include relevant course/assignment context"
```

## Troubleshooting

### Common Issues

**1. AI Not Using Custom Prompt**
- Check Script Properties for typos in key names
- Ensure prompt key starts with `prompt.`
- Try resetting and re-saving

**2. Variables Not Replacing**
- Check variable syntax: `{{variable}}`
- Ensure variable exists in context
- Use preview to debug

**3. Responses Too Generic**
- Add more specific instructions
- Include examples in your prompt
- Use conditional logic for edge cases

**4. Wrong Language/Tone**
- Be explicit about tone requirements
- Provide example phrases
- Test with various email types

### Testing Your Prompts

1. **Use Test Emails**
   ```javascript
   // Send test emails with different scenarios:
   - Angry customer
   - Technical question
   - Billing issue
   - Feature request
   - Non-English email
   ```

2. **Check the Logs**
   ```javascript
   // View → Logs shows:
   - Which prompt was used
   - Variable substitutions
   - AI response
   ```

3. **Monitor Performance**
   - Track response quality
   - Customer satisfaction
   - Resolution rates
   - Adjust prompts based on data

## Best Practices

### 1. Start Small
- Change one prompt at a time
- Test thoroughly before moving to next
- Keep track of what works

### 2. Be Specific
```javascript
// Bad:
"Be helpful"

// Good:
"Provide step-by-step solutions with:
- Numbered steps
- Expected outcome for each step
- Time estimate
- Alternative if steps don't work"
```

### 3. Use Examples
```javascript
"Format responses like this example:

Hi Sarah! 👋

I see you're having trouble logging in. Let's fix that right away:

1. First, go to login.example.com
2. Click 'Forgot Password?' (bottom right)
3. Enter your email: sarah@email.com
4. Check your inbox for the reset link

This usually takes 2-3 minutes. If you don't see the email, check your spam folder.

Still stuck? I'm here to help!

Best,
Alex from Support"
```

### 4. Version Control
- Document your changes
- Keep backup of working prompts
- Test before busy periods

### 5. Iterate Based on Feedback
- Monitor customer responses
- Track satisfaction scores
- Refine prompts weekly

### 6. Maintain Consistency
- Use same terminology across prompts
- Keep tone consistent
- Align with brand guidelines

## Advanced Customization

### Creating Prompt Templates

Save commonly used prompt sections:

```javascript
// Create reusable sections
const promptTemplates = {
  greeting: {
    friendly: "Hi {{customer.name}}! 👋",
    formal: "Dear {{customer.name}},",
    technical: "Hello,"
  },
  
  closing: {
    friendly: "Cheers! 🎉",
    formal: "Best regards,",
    technical: "Regards,"
  },
  
  escalation: "If you need immediate assistance, please reply with 'URGENT' or call our priority line: 1-800-PRIORITY"
};

// Use in prompts:
PromptConfigService.extendPrompt(
  'prompt.response.generation',
  promptTemplates.escalation,
  'end'
);
```

### Dynamic Prompt Selection

Choose prompts based on conditions:

```javascript
// In your code:
function selectPromptVariant(email, analysis) {
  if (analysis.customerTier === 'enterprise') {
    return 'prompt.response.enterprise';
  } else if (analysis.sentiment === 'angry') {
    return 'prompt.response.recovery';
  } else {
    return 'prompt.response.standard';
  }
}
```

### A/B Testing Prompts

Test different versions:

```javascript
// Randomly assign prompt variants
const variant = Math.random() > 0.5 ? 'A' : 'B';

if (variant === 'A') {
  // Use prompt version A
  PromptConfigService.setPrompt(
    'prompt.response.generation',
    promptVersionA
  );
} else {
  // Use prompt version B
  PromptConfigService.setPrompt(
    'prompt.response.generation',
    promptVersionB
  );
}

// Track performance
MetricsService.track('prompt_variant', {
  variant: variant,
  satisfaction: customerFeedback
});
```

## Quick Reference

### Essential Variables
```
{{email.from}}         - Sender email
{{email.subject}}      - Email subject
{{email.body}}         - Email content
{{customer.name}}      - Customer name
{{customer.vip}}       - VIP status
{{analysis.category}}  - Detected category
{{analysis.sentiment}} - Emotional tone
{{analysis.urgency}}   - Priority score
{{tone}}              - Response tone setting
{{signature}}         - Email signature
```

### Prompt Keys
```
prompt.email.analysis
prompt.response.generation
prompt.categorization
prompt.sentiment
prompt.urgency
prompt.language
prompt.summary
prompt.kb.search
prompt.escalation
prompt.followup
```

### Common Patterns
```javascript
// Conditional content
{{#if condition}}...{{/if}}

// Loops
{{#each items}}{{this}}{{/each}}

// Nested properties
{{object.property.subproperty}}

// Default values
{{variable || 'default'}}
```

## Getting Help

1. **Check Examples**: Review industry examples above
2. **Test First**: Use preview before saving
3. **Start Simple**: Basic changes before complex logic
4. **Ask Community**: Share your prompts for feedback

Remember: The AI is powerful but needs clear instructions. The more specific you are, the better your results!

---

💡 **Pro Tip**: Keep a document with your successful prompt customizations. Share with your team and build a library of proven prompts for different scenarios.