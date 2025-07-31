/**
 * AIService.gs - Gemini API Integration
 * 
 * Advanced AI capabilities with function calling
 * KISS implementation of complex AI operations
 */

class AIService {
  constructor() {
    const configService = new ConfigService();
    this.config = configService.get('gemini');
    this.apiKey = this.getApiKey();
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = this.config.model || 'gemini-2.0-flash-exp';
    this.cache = CacheService.getScriptCache();
  }

  /**
   * Get API key from config or properties
   */
  getApiKey() {
    // First check Script Properties (highest priority)
    const props = PropertiesService.getScriptProperties();
    const propKey = props.getProperty('GEMINI_API_KEY');
    
    if (propKey && propKey !== '' && propKey !== 'YOUR_GEMINI_API_KEY_HERE') {
      return propKey;
    }
    
    // Then check config
    if (this.config.apiKey && this.config.apiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
      return this.config.apiKey;
    }
    
    // No valid key found
    console.error('❌ GEMINI API KEY NOT SET!');
    console.error('Run systemCheck() for instructions on how to set it.');
    throw new Error('Gemini API key not configured. Run systemCheck() for help.');
  }

  /**
   * Analyze email content
   */
  async analyzeEmail(email, options = {}) {
    profile('ai_analyze_email');
    
    try {
      const prompt = this.buildEmailAnalysisPrompt(email, options);
      
      const analysis = await this.generateContent(prompt, {
        temperature: 0.3,
        maxOutputTokens: 1024,
        tools: this.getEmailAnalysisTools()
      });
      
      profileEnd('ai_analyze_email');
      
      return this.parseEmailAnalysis(analysis);
      
    } catch (error) {
      profileEnd('ai_analyze_email');
      throw handleError(error, { operation: 'analyzeEmail' });
    }
  }

  /**
   * Generate reply to email
   */
  async generateReply(email, context = {}) {
    profile('ai_generate_reply');
    
    try {
      const prompt = this.buildReplyPrompt(email, context);
      
      const response = await this.generateContent(prompt, {
        temperature: 0.7,
        maxOutputTokens: 2048
      });
      
      profileEnd('ai_generate_reply');
      
      return this.parseReplyResponse(response);
      
    } catch (error) {
      profileEnd('ai_generate_reply');
      throw handleError(error, { operation: 'generateReply' });
    }
  }

  /**
   * Generate content with Gemini
   */
  async generateContent(prompt, options = {}) {
    const cacheKey = `gemini_${Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      prompt + JSON.stringify(options)
    ).map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('')}`;
    
    // Check cache
    if (options.useCache !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logDebug('Using cached AI response');
        return JSON.parse(cached);
      }
    }
    
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
    
    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: options.temperature || this.config.temperature || 0.3,
        maxOutputTokens: options.maxOutputTokens || this.config.maxTokens || 1024,
        topP: options.topP || 0.95,
        topK: options.topK || 40
      }
    };
    
    // Add tools if provided
    if (options.tools) {
      payload.tools = [{
        functionDeclarations: options.tools
      }];
    }
    
    // Add safety settings
    payload.safetySettings = [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ];
    
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      const error = JSON.parse(response.getContentText());
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }
    
    const result = JSON.parse(response.getContentText());
    
    // Cache successful response
    if (options.useCache !== false) {
      this.cache.put(cacheKey, JSON.stringify(result), options.cacheDuration || 300);
    }
    
    return result;
  }

  /**
   * Build email analysis prompt
   */
  buildEmailAnalysisPrompt(email, options) {
    const { includeHistory = false, focusAreas = [] } = options;
    
    // Check if PromptConfigService exists and use it
    if (typeof PromptConfigService !== 'undefined') {
      try {
        // Get customer history if available
        const customerHistory = {
          history: includeHistory ? `Message ${email.messageCount} in conversation` : 'First contact',
          previousTickets: 0 // Could be enhanced with actual data
        };
        
        // Get configured prompt
        let prompt = PromptConfigService.getPrompt(
          PromptConfigService.PROMPT_KEYS.EMAIL_ANALYSIS,
          {
            email: email,
            customer: customerHistory
          }
        );
        
        // Add focus areas if specified
        if (focusAreas.length > 0) {
          prompt += `\n\nPay special attention to: ${focusAreas.join(', ')}`;
        }
        
        return prompt;
      } catch (error) {
        console.log('Using fallback prompt:', error);
      }
    }
    
    // Fallback to default prompt
    let prompt = `Analyze this customer support email and provide detailed insights.

Email Details:
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
Body: ${email.body}

Provide a comprehensive analysis including:
1. Sentiment (positive, negative, neutral)
2. Category (technical, billing, account, feature, complaint, general)
3. Urgency (low, medium, high, urgent)
4. Intent (the main purpose of the email)
5. Key entities (people, products, dates, monetary values)
6. Summary (one sentence)
7. Suggested response approach`;
    
    if (includeHistory && email.messageCount > 1) {
      prompt += `\n\nNote: This is message ${email.messageCount} in an ongoing conversation.`;
    }
    
    if (focusAreas.length > 0) {
      prompt += `\n\nPay special attention to: ${focusAreas.join(', ')}`;
    }
    
    return prompt;
  }

  /**
   * Build reply prompt
   */
  buildReplyPrompt(email, context) {
    const { 
      knowledgeArticles = [],
      customerHistory = null,
      tone = 'professional',
      includeSignature = true,
      analysis = {},
      customInstructions = '',
      minLength = 100,
      maxLength = 300
    } = context;
    
    // Check if PromptConfigService exists and use it
    if (typeof PromptConfigService !== 'undefined') {
      try {
        // Get configured prompt
        return PromptConfigService.getPrompt(
          PromptConfigService.PROMPT_KEYS.RESPONSE_GENERATION,
          {
            context: JSON.stringify(context),
            email: email,
            analysis: analysis,
            customer: customerHistory || {
              name: email.from.split('@')[0],
              ticketCount: 0,
              since: new Date().toISOString(),
              vip: false
            },
            knowledgeArticles: knowledgeArticles,
            tone: tone,
            signature: includeSignature ? 'Support Team' : '',
            customInstructions: customInstructions,
            minLength: minLength,
            maxLength: maxLength
          }
        );
      } catch (error) {
        console.log('Using fallback reply prompt:', error);
      }
    }
    
    // Fallback to default prompt
    let prompt = `Generate a helpful customer support response to this email.

Customer Email:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.body}

Response Guidelines:
- Tone: ${tone}
- Be helpful and empathetic
- Provide clear, actionable information
- Keep the response concise but complete`;
    
    if (knowledgeArticles.length > 0) {
      prompt += `\n\nRelevant Knowledge Base Articles:`;
      knowledgeArticles.forEach((article, index) => {
        prompt += `\n${index + 1}. ${article.title}: ${article.content}`;
      });
    }
    
    if (customerHistory) {
      prompt += `\n\nCustomer History:
- Previous tickets: ${customerHistory.ticketCount}
- Customer since: ${customerHistory.firstContact}
- Satisfaction rating: ${customerHistory.satisfaction}/5`;
    }
    
    if (!includeSignature) {
      prompt += `\n\nDo not include a signature.`;
    }
    
    return prompt;
  }

  /**
   * Get email analysis tools for function calling
   */
  getEmailAnalysisTools() {
    return [
      {
        name: 'categorize_email',
        description: 'Categorize the email into predefined categories',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['technical', 'billing', 'account', 'feature', 'complaint', 'general'],
              description: 'The primary category of the email'
            },
            subcategory: {
              type: 'string',
              description: 'More specific subcategory if applicable'
            }
          },
          required: ['category']
        }
      },
      {
        name: 'extract_entities',
        description: 'Extract important entities from the email',
        parameters: {
          type: 'object',
          properties: {
            people: {
              type: 'array',
              items: { type: 'string' },
              description: 'Names of people mentioned'
            },
            products: {
              type: 'array',
              items: { type: 'string' },
              description: 'Products or services mentioned'
            },
            dates: {
              type: 'array',
              items: { type: 'string' },
              description: 'Important dates mentioned'
            },
            monetary_values: {
              type: 'array',
              items: { type: 'string' },
              description: 'Money amounts mentioned'
            }
          }
        }
      },
      {
        name: 'analyze_sentiment',
        description: 'Analyze the emotional sentiment of the email',
        parameters: {
          type: 'object',
          properties: {
            sentiment: {
              type: 'string',
              enum: ['positive', 'negative', 'neutral', 'mixed'],
              description: 'Overall sentiment'
            },
            confidence: {
              type: 'number',
              description: 'Confidence score (0-1)'
            },
            emotions: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['happy', 'angry', 'frustrated', 'confused', 'satisfied', 'disappointed']
              },
              description: 'Detected emotions'
            }
          },
          required: ['sentiment', 'confidence']
        }
      }
    ];
  }

  /**
   * Parse email analysis response
   */
  parseEmailAnalysis(response) {
    try {
      const content = response.candidates[0].content.parts[0].text;
      
      // Try to extract JSON if present
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Parse structured text response
      const analysis = {
        sentiment: 'neutral',
        category: 'general',
        urgency: 'medium',
        intent: '',
        entities: {},
        summary: '',
        suggestedResponse: ''
      };
      
      // Extract sentiment
      const sentimentMatch = content.match(/sentiment[:\s]+(\w+)/i);
      if (sentimentMatch) {
        analysis.sentiment = sentimentMatch[1].toLowerCase();
      }
      
      // Extract category
      const categoryMatch = content.match(/category[:\s]+(\w+)/i);
      if (categoryMatch) {
        analysis.category = categoryMatch[1].toLowerCase();
      }
      
      // Extract urgency
      const urgencyMatch = content.match(/urgency[:\s]+(\w+)/i);
      if (urgencyMatch) {
        analysis.urgency = urgencyMatch[1].toLowerCase();
      }
      
      // Extract summary
      const summaryMatch = content.match(/summary[:\s]+(.+?)(?:\n|$)/i);
      if (summaryMatch) {
        analysis.summary = summaryMatch[1].trim();
      }
      
      return analysis;
      
    } catch (error) {
      logError('Failed to parse AI analysis', { error: error.message });
      
      // Return default analysis
      return {
        sentiment: 'neutral',
        category: 'general',
        urgency: 'medium',
        intent: 'support request',
        summary: 'Customer support email',
        suggestedResponse: 'Thank you for contacting support.'
      };
    }
  }

  /**
   * Parse reply response
   */
  parseReplyResponse(response) {
    try {
      const content = response.candidates[0].content.parts[0].text;
      
      return {
        reply: content.trim(),
        confidence: 0.8, // Default confidence
        suggestions: []
      };
      
    } catch (error) {
      logError('Failed to parse AI reply', { error: error.message });
      
      return {
        reply: 'Thank you for contacting our support team. We are reviewing your request and will respond shortly.',
        confidence: 0.3,
        suggestions: ['Please provide more details', 'Include error messages if any']
      };
    }
  }

  /**
   * Summarize email thread
   */
  async summarizeThread(messages, options = {}) {
    const prompt = `Summarize this email conversation in a concise way.

${messages.map((msg, i) => `
Message ${i + 1}:
From: ${msg.from}
Date: ${msg.date}
${msg.body}
`).join('\n---\n')}

Provide:
1. Brief summary of the issue
2. Current status
3. Key points discussed
4. Next steps needed`;
    
    const response = await this.generateContent(prompt, {
      temperature: 0.3,
      maxOutputTokens: 512
    });
    
    return this.parseSummaryResponse(response);
  }

  /**
   * Parse summary response
   */
  parseSummaryResponse(response) {
    try {
      const content = response.candidates[0].content.parts[0].text;
      
      return {
        summary: content.trim(),
        keyPoints: [],
        nextSteps: []
      };
      
    } catch (error) {
      return {
        summary: 'Email thread summary unavailable',
        keyPoints: [],
        nextSteps: []
      };
    }
  }

  /**
   * Detect language
   */
  async detectLanguage(text) {
    const prompt = `Detect the language of this text and return the ISO 639-1 language code (e.g., 'en' for English, 'es' for Spanish):

"${text.substring(0, 200)}"

Return only the language code.`;
    
    const response = await this.generateContent(prompt, {
      temperature: 0,
      maxOutputTokens: 10
    });
    
    try {
      const content = response.candidates[0].content.parts[0].text;
      return content.trim().toLowerCase().substring(0, 2);
    } catch (error) {
      return 'en'; // Default to English
    }
  }

  /**
   * Translate text
   */
  async translateText(text, targetLanguage, sourceLanguage = 'auto') {
    const prompt = `Translate the following text${sourceLanguage !== 'auto' ? ` from ${sourceLanguage}` : ''} to ${targetLanguage}:

"${text}"

Return only the translated text.`;
    
    const response = await this.generateContent(prompt, {
      temperature: 0.3,
      maxOutputTokens: 2048
    });
    
    try {
      return response.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      throw new Error('Translation failed');
    }
  }

  /**
   * Generate embeddings for semantic search
   */
  async generateEmbedding(text) {
    // Note: Gemini doesn't directly support embeddings via this API
    // This is a placeholder for future implementation
    // Consider using a different model or service for embeddings
    
    logWarn('Embedding generation not implemented for Gemini');
    
    // Return a mock embedding for now
    return Array(768).fill(0).map(() => Math.random());
  }

  /**
   * Check content safety
   */
  async checkContentSafety(text) {
    const prompt = `Analyze this text for safety concerns. Return JSON with:
- safe: boolean
- concerns: array of any safety issues
- severity: low/medium/high

Text: "${text}"`;
    
    const response = await this.generateContent(prompt, {
      temperature: 0,
      maxOutputTokens: 256
    });
    
    try {
      const content = response.candidates[0].content.parts[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Default to safe
    }
    
    return {
      safe: true,
      concerns: [],
      severity: 'low'
    };
  }

  /**
   * Get AI usage statistics
   */
  getUsageStats() {
    const props = PropertiesService.getScriptProperties();
    const stats = JSON.parse(props.getProperty('ai_usage_stats') || '{}');
    
    return {
      totalRequests: stats.totalRequests || 0,
      totalTokens: stats.totalTokens || 0,
      byOperation: stats.byOperation || {},
      lastReset: stats.lastReset || new Date().toISOString()
    };
  }

  /**
   * Update usage statistics
   */
  updateUsageStats(operation, tokens) {
    const props = PropertiesService.getScriptProperties();
    const stats = JSON.parse(props.getProperty('ai_usage_stats') || '{}');
    
    stats.totalRequests = (stats.totalRequests || 0) + 1;
    stats.totalTokens = (stats.totalTokens || 0) + tokens;
    
    if (!stats.byOperation) stats.byOperation = {};
    stats.byOperation[operation] = (stats.byOperation[operation] || 0) + 1;
    
    props.setProperty('ai_usage_stats', JSON.stringify(stats));
  }
}

// Create singleton instance
const AI = new AIService();

// Convenience functions
function analyzeEmail(email, options) {
  return AI.analyzeEmail(email, options);
}

function generateReply(email, context) {
  return AI.generateReply(email, context);
}

function summarizeThread(messages, options) {
  return AI.summarizeThread(messages, options);
}

function detectLanguage(text) {
  return AI.detectLanguage(text);
}

function translateText(text, targetLanguage, sourceLanguage) {
  return AI.translateText(text, targetLanguage, sourceLanguage);
}

function checkContentSafety(text) {
  return AI.checkContentSafety(text);
}

function getAIUsageStats() {
  return AI.getUsageStats();
}