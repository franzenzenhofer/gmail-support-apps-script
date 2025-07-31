/**
 * AIServiceDRY.gs - DRY Refactored AI Service
 * Extends BaseService to eliminate code duplication
 */

class AIServiceDRY extends BaseService {
  constructor() {
    super('gemini');
  }
  
  initializeService() {
    this.apiKey = this.getApiKey();
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = this.config.model || 'gemini-pro';
  }
  
  /**
   * Get API key with proper error handling
   */
  getApiKey() {
    const apiKey = this.config.apiKey || 
                  PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      throw new Error(ERROR_MESSAGES.API_KEY_MISSING);
    }
    
    return apiKey;
  }
  
  /**
   * Generate response with caching and error handling
   */
  generateResponse(prompt, options = {}) {
    return this.withErrorHandling('generate', () => {
      const cacheKey = `ai_response_${this.hashString(prompt)}`;
      
      return this.getCached(cacheKey, () => {
        const response = this.callGeminiAPI(prompt, options);
        return this.parseResponse(response);
      }, CACHE_TTL.MEDIUM);
    });
  }
  
  /**
   * Call Gemini API with rate limiting
   */
  callGeminiAPI(prompt, options = {}) {
    const validation = this.validateInput(prompt, { 
      required: true, 
      maxLength: 30000 
    });
    
    if (!validation.valid) {
      throw new Error(`Invalid prompt: ${validation.errors.join(', ')}`);
    }
    
    const payload = {
      contents: [{
        parts: [{ text: validation.sanitized }]
      }],
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 1024,
        topP: options.topP || 0.8,
        topK: options.topK || 40
      }
    };
    
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      payload: JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(
      `${this.baseUrl}/${this.model}:generateContent`,
      requestOptions
    );
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`API Error: ${response.getResponseCode()}`);
    }
    
    return JSON.parse(response.getContentText());
  }
  
  /**
   * Analyze email sentiment with caching
   */
  analyzeSentiment(text) {
    return this.withErrorHandling('sentiment', () => {
      const cacheKey = `sentiment_${this.hashString(text)}`;
      
      return this.getCached(cacheKey, () => {
        const prompt = `Analyze the sentiment of this email and classify it as positive, negative, or neutral. Also rate urgency from 1-10:

Email: ${text}

Respond in JSON format: {"sentiment": "positive/negative/neutral", "urgency": 1-10, "confidence": 0.0-1.0}`;
        
        const response = this.generateResponse(prompt);
        return this.parseSentimentResponse(response);
      }, CACHE_TTL.LONG);
    });
  }
  
  /**
   * Categorize email with validation
   */
  categorizeEmail(subject, body) {
    return this.withErrorHandling('categorize', () => {
      const validation = this.validateInput(body, { maxLength: 10000 });
      if (!validation.valid) {
        throw new Error(`Invalid email body: ${validation.errors.join(', ')}`);
      }
      
      const prompt = `Categorize this support email into one of these categories: technical, billing, account, feature_request, complaint, general

Subject: ${subject}
Body: ${validation.sanitized}

Respond with just the category name.`;
      
      const response = this.generateResponse(prompt, { maxTokens: 50 });
      return this.parseCategory(response);
    });
  }
  
  /**
   * Generate auto-reply with context
   */
  generateAutoReply(emailData, knowledgeBase = '') {
    return this.withErrorHandling('autoReply', () => {
      const context = knowledgeBase ? `\n\nKnowledge Base:\n${knowledgeBase}` : '';
      
      const prompt = `Generate a helpful support response to this customer email. Be professional, empathetic, and provide actionable solutions.

Customer Email:
Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${emailData.body}${context}

Generate a response that:
1. Acknowledges their issue
2. Provides helpful information or next steps
3. Maintains a professional tone
4. Includes relevant information from the knowledge base if available`;
      
      return this.generateResponse(prompt, { maxTokens: 2048 });
    });
  }
  
  /**
   * Parse API response with error handling
   */
  parseResponse(apiResponse) {
    if (!apiResponse.candidates || apiResponse.candidates.length === 0) {
      throw new Error('No content generated');
    }
    
    const candidate = apiResponse.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      throw new Error('Invalid response format');
    }
    
    return candidate.content.parts[0].text || '';
  }
  
  /**
   * Parse sentiment response
   */
  parseSentimentResponse(response) {
    try {
      const jsonMatch = response.match(/\{.*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Fallback parsing
    }
    
    return {
      sentiment: 'neutral',
      urgency: 5,
      confidence: 0.5
    };
  }
  
  /**
   * Parse category response
   */
  parseCategory(response) {
    const category = response.toLowerCase().trim();
    const validCategories = ['technical', 'billing', 'account', 'feature_request', 'complaint', 'general'];
    
    return validCategories.includes(category) ? category : 'general';
  }
  
  /**
   * Hash string for cache keys
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Batch process multiple prompts
   */
  batchGenerate(prompts, options = {}) {
    return this.batchProcess(prompts, (batch) => {
      return batch.map(prompt => {
        try {
          return this.generateResponse(prompt, options);
        } catch (error) {
          return { error: error.message };
        }
      });
    }, 5); // Smaller batches for API limits
  }
}

// Create singleton instance
const AIDRY = new AIServiceDRY();

// Export wrapper functions
function generateAIResponse(prompt, options) {
  return AIDRY.generateResponse(prompt, options);
}

function analyzeEmailSentiment(text) {
  return AIDRY.analyzeSentiment(text);
}

function categorizeEmailAI(subject, body) {
  return AIDRY.categorizeEmail(subject, body);
}