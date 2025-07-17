/**
 * 🎨 PromptConfigService.gs - Customizable AI Prompt Management
 * 
 * Allows direct editing, overwriting, and extending of all Gemini prompts
 * Store custom prompts in Script Properties for easy modification
 */

class PromptConfigService {
  static PROMPT_KEYS = {
    EMAIL_ANALYSIS: 'prompt.email.analysis',
    RESPONSE_GENERATION: 'prompt.response.generation',
    CATEGORIZATION: 'prompt.categorization',
    SENTIMENT_ANALYSIS: 'prompt.sentiment',
    URGENCY_DETECTION: 'prompt.urgency',
    LANGUAGE_DETECTION: 'prompt.language',
    SUMMARY_GENERATION: 'prompt.summary',
    KNOWLEDGE_SEARCH: 'prompt.kb.search',
    ESCALATION_DECISION: 'prompt.escalation',
    FOLLOWUP_SUGGESTION: 'prompt.followup'
  };

  /**
   * Get default prompts - these can be overridden
   */
  static getDefaultPrompts() {
    return {
      [this.PROMPT_KEYS.EMAIL_ANALYSIS]: `
Analyze this customer support email and provide structured data.

Email Details:
From: {{email.from}}
Subject: {{email.subject}}
Body: {{email.body}}
Timestamp: {{email.date}}

Previous interactions: {{customer.history}}

Instructions:
1. Identify the primary intent and any secondary requests
2. Detect the emotional tone and urgency level
3. Extract key entities (product names, order numbers, etc.)
4. Suggest appropriate actions
5. Generate an optimized search query for our knowledge base

Return a JSON object with this exact structure:
{
  "category": "technical|billing|general|feedback|sales",
  "sentiment": "positive|neutral|negative|frustrated|angry",
  "urgency": 0.0-1.0,
  "intent": "primary customer intent in 1 sentence",
  "secondaryIntents": ["list", "of", "other", "requests"],
  "entities": {
    "products": ["product names mentioned"],
    "orderNumbers": ["order IDs"],
    "errorCodes": ["technical error codes"],
    "dates": ["mentioned dates"],
    "other": ["other important entities"]
  },
  "suggestedActions": [
    "action 1 with specific steps",
    "action 2 with details"
  ],
  "searchQuery": "optimized knowledge base search query",
  "language": "ISO language code",
  "customerMood": "happy|satisfied|confused|frustrated|angry",
  "summary": "2-3 sentence summary of the issue",
  "requiresHuman": true/false,
  "reason": "why human intervention might be needed"
}`,

      [this.PROMPT_KEYS.RESPONSE_GENERATION]: `
Generate a helpful, empathetic support response for this customer email.

Context:
{{context}}

Customer Email:
{{email.body}}

Email Analysis:
- Category: {{analysis.category}}
- Sentiment: {{analysis.sentiment}}
- Mood: {{analysis.customerMood}}
- Intent: {{analysis.intent}}
- Language: {{analysis.language}}

Customer Information:
- Name: {{customer.name}}
- Previous tickets: {{customer.ticketCount}}
- Customer since: {{customer.since}}
- VIP status: {{customer.vip}}

Relevant Knowledge Base Articles:
{{#each knowledgeArticles}}
- {{this.title}}: {{this.summary}}
  Link: {{this.link}}
{{/each}}

Response Guidelines:
1. Start with empathy and acknowledgment
2. Address the primary concern directly
3. Provide clear, step-by-step solutions
4. Use information from knowledge base articles
5. Match the customer's language ({{analysis.language}})
6. Maintain {{tone}} tone
7. Include relevant links or resources
8. Offer additional help
9. Sign off professionally as {{signature}}

Additional Instructions:
{{customInstructions}}

Generate a response that:
- Is between {{minLength}} and {{maxLength}} words
- Includes specific action steps
- References knowledge base articles naturally
- Anticipates follow-up questions

Response:`,

      [this.PROMPT_KEYS.CATEGORIZATION]: `
Categorize this email into the most appropriate category.

Email: {{email.subject}} - {{email.body}}

Available categories:
{{#each categories}}
- {{this.name}}: {{this.description}}
{{/each}}

Consider:
1. Primary topic of the email
2. Type of assistance needed
3. Department best suited to handle

Return only the category name.`,

      [this.PROMPT_KEYS.SENTIMENT_ANALYSIS]: `
Analyze the emotional tone of this email.

Email: {{email.body}}

Evaluate:
1. Overall emotional state
2. Frustration level (0-10)
3. Satisfaction indicators
4. Urgency in tone

Return: positive|neutral|negative|frustrated|angry`,

      [this.PROMPT_KEYS.URGENCY_DETECTION]: `
Determine the urgency level of this support request.

Email: {{email.subject}}
Body: {{email.body}}
Customer tier: {{customer.tier}}

Consider:
- Keywords indicating urgency
- Business impact mentioned
- Time sensitivity
- Customer importance

Return a number between 0.0 (not urgent) and 1.0 (extremely urgent).`,

      [this.PROMPT_KEYS.LANGUAGE_DETECTION]: `
Detect the language of this email and return the ISO 639-1 code.

Email: {{email.body}}

Return format: Just the 2-letter ISO code (e.g., 'en', 'es', 'fr')`,

      [this.PROMPT_KEYS.SUMMARY_GENERATION]: `
Create a concise summary of this support request.

Email: {{email.body}}

Create a 2-3 sentence summary that:
1. Identifies the main issue
2. Notes any important details
3. Highlights urgency or special requirements

Summary:`,

      [this.PROMPT_KEYS.KNOWLEDGE_SEARCH]: `
Generate search queries to find relevant knowledge base articles.

Customer issue: {{summary}}
Category: {{category}}
Entities: {{entities}}

Generate 3 different search queries:
1. Broad search query
2. Specific technical query
3. Alternative phrasing query

Format:
["query1", "query2", "query3"]`,

      [this.PROMPT_KEYS.ESCALATION_DECISION]: `
Determine if this ticket should be escalated to human support.

Ticket details:
{{ticket}}

AI confidence: {{confidence}}
Response attempts: {{attempts}}
Customer satisfaction: {{satisfaction}}

Escalation triggers:
{{#each triggers}}
- {{this}}
{{/each}}

Return JSON:
{
  "shouldEscalate": true/false,
  "reason": "specific reason for decision",
  "priority": "low|medium|high|urgent",
  "suggestedTeam": "team to escalate to"
}`,

      [this.PROMPT_KEYS.FOLLOWUP_SUGGESTION]: `
Suggest follow-up actions for this resolved ticket.

Ticket: {{ticket}}
Resolution: {{resolution}}

Suggest:
1. Proactive follow-up message
2. Related KB articles to share
3. Survey questions
4. Upsell opportunities (if appropriate)

Format as JSON array of actions.`
    };
  }

  /**
   * Get a prompt with variable substitution
   */
  static getPrompt(promptKey, variables = {}) {
    const props = PropertiesService.getScriptProperties();
    
    // Check for custom prompt first
    let promptTemplate = props.getProperty(promptKey);
    
    // Fall back to default if not customized
    if (!promptTemplate) {
      const defaults = this.getDefaultPrompts();
      promptTemplate = defaults[promptKey];
      
      if (!promptTemplate) {
        throw new Error(`Unknown prompt key: ${promptKey}`);
      }
    }
    
    // Substitute variables
    return this.substituteVariables(promptTemplate, variables);
  }

  /**
   * Set a custom prompt
   */
  static setPrompt(promptKey, promptTemplate) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(promptKey, promptTemplate);
    
    // Log the change
    console.log(`Updated prompt: ${promptKey}`);
    
    // Backup the previous version
    this.backupPrompt(promptKey, promptTemplate);
  }

  /**
   * Get all custom prompts
   */
  static getAllCustomPrompts() {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    const prompts = {};
    
    // Filter for prompt properties
    Object.keys(allProps).forEach(key => {
      if (key.startsWith('prompt.')) {
        prompts[key] = allProps[key];
      }
    });
    
    return prompts;
  }

  /**
   * Reset a prompt to default
   */
  static resetPrompt(promptKey) {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty(promptKey);
    console.log(`Reset prompt to default: ${promptKey}`);
  }

  /**
   * Reset all prompts to defaults
   */
  static resetAllPrompts() {
    const props = PropertiesService.getScriptProperties();
    
    Object.values(this.PROMPT_KEYS).forEach(key => {
      props.deleteProperty(key);
    });
    
    console.log('All prompts reset to defaults');
  }

  /**
   * Extend a prompt by adding to it
   */
  static extendPrompt(promptKey, additionalContent, position = 'end') {
    const currentPrompt = this.getPrompt(promptKey);
    
    let newPrompt;
    if (position === 'start') {
      newPrompt = additionalContent + '\n\n' + currentPrompt;
    } else if (position === 'end') {
      newPrompt = currentPrompt + '\n\n' + additionalContent;
    } else {
      // Position is a string to search for
      newPrompt = currentPrompt.replace(position, position + '\n' + additionalContent);
    }
    
    this.setPrompt(promptKey, newPrompt);
    return newPrompt;
  }

  /**
   * Variable substitution with Handlebars-like syntax
   */
  static substituteVariables(template, variables) {
    let result = template;
    
    // Simple variable substitution {{variable}}
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(variables, path.trim());
      return value !== undefined ? value : match;
    });
    
    // Conditional blocks {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, 
      (match, condition, content) => {
        const value = this.getNestedValue(variables, condition.trim());
        return value ? content : '';
      });
    
    // Each loops {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (match, arrayPath, content) => {
        const array = this.getNestedValue(variables, arrayPath.trim());
        if (!Array.isArray(array)) return '';
        
        return array.map(item => {
          return content.replace(/\{\{this\.([^}]+)\}\}/g, (m, prop) => {
            return this.getNestedValue(item, prop.trim());
          }).replace(/\{\{this\}\}/g, item);
        }).join('\n');
      });
    
    return result;
  }

  /**
   * Get nested object value by path
   */
  static getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => {
      return current?.[prop];
    }, obj);
  }

  /**
   * Backup prompt history
   */
  static backupPrompt(promptKey, content) {
    const backupKey = `${promptKey}.backup.${new Date().getTime()}`;
    const props = PropertiesService.getScriptProperties();
    
    // Keep only last 5 backups
    const backups = Object.keys(props.getProperties())
      .filter(k => k.startsWith(`${promptKey}.backup.`))
      .sort();
    
    if (backups.length >= 5) {
      props.deleteProperty(backups[0]);
    }
    
    props.setProperty(backupKey, content);
  }

  /**
   * Get prompt history
   */
  static getPromptHistory(promptKey) {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    const history = [];
    
    Object.keys(allProps)
      .filter(k => k.startsWith(`${promptKey}.backup.`))
      .sort()
      .forEach(key => {
        const timestamp = key.split('.').pop();
        history.push({
          timestamp: new Date(parseInt(timestamp)),
          content: allProps[key]
        });
      });
    
    return history;
  }

  /**
   * Export all prompts
   */
  static exportPrompts() {
    const defaults = this.getDefaultPrompts();
    const custom = this.getAllCustomPrompts();
    
    return {
      defaults: defaults,
      custom: custom,
      exported: new Date().toISOString()
    };
  }

  /**
   * Import prompts
   */
  static importPrompts(promptData) {
    const props = PropertiesService.getScriptProperties();
    
    Object.entries(promptData.custom).forEach(([key, value]) => {
      props.setProperty(key, value);
    });
    
    console.log(`Imported ${Object.keys(promptData.custom).length} prompts`);
  }

  /**
   * Validate prompt template
   */
  static validatePrompt(template) {
    const errors = [];
    
    // Check for balanced brackets
    const openBrackets = (template.match(/\{\{/g) || []).length;
    const closeBrackets = (template.match(/\}\}/g) || []).length;
    
    if (openBrackets !== closeBrackets) {
      errors.push('Unbalanced brackets');
    }
    
    // Check for valid variable names
    const variables = template.match(/\{\{([^}]+)\}\}/g) || [];
    variables.forEach(v => {
      const varName = v.replace(/[{}]/g, '').trim();
      if (!/^[a-zA-Z0-9._#\/\s]+$/.test(varName)) {
        errors.push(`Invalid variable: ${v}`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}

/**
 * UI Functions for Google Sheets menu
 */
function openPromptEditor() {
  const html = HtmlService.createHtmlOutputFromFile('PromptEditor')
    .setWidth(800)
    .setHeight(600);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'AI Prompt Editor');
}

function getPromptsForEditor() {
  return {
    defaults: PromptConfigService.getDefaultPrompts(),
    custom: PromptConfigService.getAllCustomPrompts(),
    keys: PromptConfigService.PROMPT_KEYS
  };
}

function savePromptFromEditor(promptKey, content) {
  PromptConfigService.setPrompt(promptKey, content);
  return { success: true };
}

function resetPromptFromEditor(promptKey) {
  PromptConfigService.resetPrompt(promptKey);
  return { success: true };
}

/**
 * Example: Update AI Service to use configurable prompts
 */
function exampleAIServiceUpdate() {
  // In AIService.gs, update the analyzeEmail method:
  
  const email = {
    from: 'customer@example.com',
    subject: 'Help with password reset',
    body: 'I cannot log in to my account',
    date: new Date()
  };
  
  const customer = {
    history: 'Previous tickets: 2',
    name: 'John Doe',
    since: '2023-01-01',
    vip: false
  };
  
  // Get the configured prompt with variables substituted
  const prompt = PromptConfigService.getPrompt(
    PromptConfigService.PROMPT_KEYS.EMAIL_ANALYSIS,
    {
      email: email,
      customer: customer
    }
  );
  
  console.log('Generated prompt:', prompt);
  
  // Use this prompt with Gemini API
  // ... rest of AI processing
}