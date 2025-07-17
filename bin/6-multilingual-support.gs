/**
 * Multilingual Support System
 * 
 * Use Case: Handle support in 50+ languages with auto-translation
 * Features: Language detection, native responses, cultural adaptation
 */

// Multilingual Configuration
const MULTILINGUAL_CONFIG = {
  supportedLanguages: [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'it', name: 'Italian', native: 'Italiano' },
    { code: 'pt', name: 'Portuguese', native: 'Português' },
    { code: 'zh', name: 'Chinese', native: '中文' },
    { code: 'ja', name: 'Japanese', native: '日本語' },
    { code: 'ko', name: 'Korean', native: '한국어' },
    { code: 'ar', name: 'Arabic', native: 'العربية' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'ru', name: 'Russian', native: 'Русский' },
    { code: '*', name: 'All Others', native: 'Auto-detect' }
  ],
  
  greetings: {
    en: 'Hello',
    es: 'Hola',
    fr: 'Bonjour',
    de: 'Hallo',
    it: 'Ciao',
    pt: 'Olá',
    zh: '你好',
    ja: 'こんにちは',
    ko: '안녕하세요',
    ar: 'مرحبا',
    hi: 'नमस्ते',
    ru: 'Здравствуйте'
  },
  
  closings: {
    en: 'Best regards',
    es: 'Saludos cordiales',
    fr: 'Cordialement',
    de: 'Mit freundlichen Grüßen',
    it: 'Cordiali saluti',
    pt: 'Atenciosamente',
    zh: '此致敬礼',
    ja: 'よろしくお願いします',
    ko: '감사합니다',
    ar: 'مع أطيب التحيات',
    hi: 'शुभकामनाएं',
    ru: 'С уважением'
  },
  
  culturalAdaptations: {
    ja: { formality: 'high', indirectness: 'high' },
    ko: { formality: 'high', indirectness: 'medium' },
    de: { formality: 'medium', directness: 'high' },
    ar: { formality: 'high', contextual: true },
    en: { formality: 'low', directness: 'medium' }
  }
};

/**
 * Multilingual support processor
 */
function multilingualSupportProcessor() {
  console.log('🌍 Multilingual Support System');
  console.log('==============================\n');
  
  // Get unprocessed emails
  const emails = getUnprocessedMultilingualEmails();
  
  const languageStats = {};
  
  emails.forEach(email => {
    try {
      const result = processMultilingualEmail(email);
      languageStats[result.language] = (languageStats[result.language] || 0) + 1;
    } catch (error) {
      console.error('Error processing multilingual email:', error);
    }
  });
  
  // Display language statistics
  displayLanguageStats(languageStats);
  
  // Update language-specific knowledge bases
  updateLanguageKnowledgeBases();
}

/**
 * Get unprocessed emails
 */
function getUnprocessedMultilingualEmails() {
  return Email.searchEmails({
    query: '-label:processed',
    limit: 30
  });
}

/**
 * Process email with multilingual support
 */
function processMultilingualEmail(email) {
  console.log(`\n📧 Processing: ${email.subject}`);
  
  // Detect language
  const language = detectEmailLanguage(email);
  console.log(`   🌍 Detected language: ${language.name} (${language.code}) - ${Math.round(language.confidence * 100)}% confidence`);
  
  // Get customer's language preference
  const customerLang = getCustomerLanguagePreference(email.from) || language.code;
  
  // Translate if needed for analysis
  let analysisEmail = email;
  if (language.code !== 'en') {
    analysisEmail = translateEmail(email, language.code, 'en');
    console.log('   📝 Translated for analysis');
  }
  
  // Analyze email intent
  const analysis = analyzeMultilingualEmail(analysisEmail, language);
  console.log(`   🎯 Category: ${analysis.category}`);
  console.log(`   😊 Sentiment: ${analysis.sentiment}`);
  
  // Search knowledge base in customer's language
  const knowledge = searchMultilingualKnowledge(email, language.code);
  console.log(`   📚 Found ${knowledge.length} relevant articles`);
  
  // Generate culturally appropriate response
  const response = generateCulturallyAwareResponse(email, analysis, knowledge, language);
  console.log(`   ✍️  Generated response in ${language.name}`);
  
  // Send response
  sendMultilingualResponse(email, response, language);
  
  // Update customer language preference
  updateCustomerLanguagePreference(email.from, language.code);
  
  return {
    language: language.code,
    category: analysis.category,
    responded: true
  };
}

/**
 * Detect email language with confidence
 */
function detectEmailLanguage(email) {
  const text = `${email.subject} ${email.body}`.substring(0, 1000);
  
  // Use Google's language detection
  const detection = LanguageApp.detect(text);
  
  if (detection.length > 0 && detection[0].confidence > 0.7) {
    const langCode = detection[0].language;
    const supported = MULTILINGUAL_CONFIG.supportedLanguages.find(l => l.code === langCode);
    
    if (supported) {
      return {
        code: langCode,
        name: supported.name,
        native: supported.native,
        confidence: detection[0].confidence
      };
    }
  }
  
  // Fallback language detection using patterns
  const patterns = {
    zh: /[\u4e00-\u9fa5]/,
    ja: /[\u3040-\u309f\u30a0-\u30ff]/,
    ko: /[\uac00-\ud7af]/,
    ar: /[\u0600-\u06ff]/,
    hi: /[\u0900-\u097F]/,
    ru: /[\u0400-\u04FF]/
  };
  
  for (const [code, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      const supported = MULTILINGUAL_CONFIG.supportedLanguages.find(l => l.code === code);
      return {
        code: code,
        name: supported.name,
        native: supported.native,
        confidence: 0.8
      };
    }
  }
  
  // Default to English
  return {
    code: 'en',
    name: 'English',
    native: 'English',
    confidence: 0.5
  };
}

/**
 * Translate email content
 */
function translateEmail(email, fromLang, toLang) {
  try {
    return {
      ...email,
      subject: LanguageApp.translate(email.subject, fromLang, toLang),
      body: LanguageApp.translate(email.body, fromLang, toLang),
      originalLanguage: fromLang
    };
  } catch (error) {
    console.error('Translation error:', error);
    return email;
  }
}

/**
 * Analyze multilingual email
 */
function analyzeMultilingualEmail(email, language) {
  // Use AI with language context
  const analysis = AI.analyzeEmail(email, {
    language: language.code,
    culturalContext: MULTILINGUAL_CONFIG.culturalAdaptations[language.code]
  });
  
  // Adjust for cultural communication styles
  if (language.code === 'ja' || language.code === 'ko') {
    // High-context cultures may be more indirect
    if (analysis.sentiment === 'neutral' && email.body.length > 500) {
      analysis.possibleComplaint = true;
    }
  }
  
  return analysis;
}

/**
 * Search multilingual knowledge base
 */
function searchMultilingualKnowledge(email, langCode) {
  // First search in the customer's language
  let results = KnowledgeBase.search(email.subject + ' ' + email.body, {
    language: langCode,
    limit: 3
  });
  
  // If no results, search in English and translate
  if (results.length === 0 && langCode !== 'en') {
    const translatedQuery = LanguageApp.translate(
      email.subject + ' ' + email.body.substring(0, 200),
      langCode,
      'en'
    );
    
    results = KnowledgeBase.search(translatedQuery, {
      language: 'en',
      limit: 3
    });
    
    // Translate results back
    results = results.map(article => ({
      ...article,
      title: LanguageApp.translate(article.title, 'en', langCode),
      content: LanguageApp.translate(article.content, 'en', langCode),
      translated: true
    }));
  }
  
  return results;
}

/**
 * Generate culturally aware response
 */
function generateCulturallyAwareResponse(email, analysis, knowledge, language) {
  const cultural = MULTILINGUAL_CONFIG.culturalAdaptations[language.code] || {};
  
  // Build culturally appropriate prompt
  const prompt = `Generate a customer support response in ${language.name} (${language.code}).

Customer Email: ${email.subject}
${email.body}

Analysis:
- Category: ${analysis.category}
- Sentiment: ${analysis.sentiment}
- Urgency: ${analysis.urgency}

Cultural Considerations:
- Formality Level: ${cultural.formality || 'medium'}
- Communication Style: ${cultural.directness ? 'direct' : 'indirect'}
- Context Awareness: ${cultural.contextual ? 'high' : 'normal'}

Knowledge Base Articles:
${knowledge.map(k => `- ${k.title}: ${k.content.substring(0, 200)}...`).join('\n')}

Requirements:
1. Respond in ${language.name} (${language.code})
2. Use appropriate cultural communication style
3. Include greeting: ${MULTILINGUAL_CONFIG.greetings[language.code] || MULTILINGUAL_CONFIG.greetings.en}
4. Include closing: ${MULTILINGUAL_CONFIG.closings[language.code] || MULTILINGUAL_CONFIG.closings.en}
5. Address the customer's issue completely
6. Be ${cultural.formality === 'high' ? 'very formal and respectful' : 'friendly but professional'}`;

  const response = AI.generateReply(email, {
    customPrompt: prompt,
    language: language.code,
    tone: determineCulturalTone(language.code, analysis.sentiment)
  });
  
  // Post-process for cultural appropriateness
  return enhanceCulturalResponse(response, language, cultural);
}

/**
 * Enhance response for cultural appropriateness
 */
function enhanceCulturalResponse(response, language, cultural) {
  let enhanced = response.reply;
  
  // Add appropriate honorifics or titles
  if (language.code === 'ja') {
    enhanced = enhanced.replace(/Dear/g, '様へ');
  } else if (language.code === 'de') {
    enhanced = enhanced.replace(/Dear Mr\./g, 'Sehr geehrter Herr');
    enhanced = enhanced.replace(/Dear Ms\./g, 'Sehr geehrte Frau');
  }
  
  // Adjust directness for high-context cultures
  if (cultural.indirectness === 'high') {
    // Soften direct statements
    enhanced = enhanced.replace(/You must/g, 'It would be helpful if you could');
    enhanced = enhanced.replace(/You should/g, 'You might consider');
  }
  
  return {
    ...response,
    reply: enhanced,
    culturallyAdapted: true
  };
}

/**
 * Determine cultural tone
 */
function determineCulturalTone(langCode, sentiment) {
  const cultural = MULTILINGUAL_CONFIG.culturalAdaptations[langCode] || {};
  
  if (sentiment === 'negative') {
    return cultural.formality === 'high' ? 'apologetic_formal' : 'empathetic';
  } else if (cultural.formality === 'high') {
    return 'formal_respectful';
  } else {
    return 'friendly_professional';
  }
}

/**
 * Send multilingual response
 */
function sendMultilingualResponse(email, response, language) {
  // Add language indicator to subject
  const subject = `Re: ${email.subject} [${language.native}]`;
  
  // Add footer with language options
  const footer = generateLanguageFooter(language.code);
  
  Email.sendEmail(
    email.from,
    subject,
    response.reply + footer,
    {
      htmlBody: convertToHtml(response.reply) + footer,
      labels: [`processed/multilingual/${language.code}`]
    }
  );
  
  console.log(`   ✅ Response sent in ${language.name}`);
}

/**
 * Generate language preference footer
 */
function generateLanguageFooter(currentLang) {
  const otherLangs = MULTILINGUAL_CONFIG.supportedLanguages
    .filter(l => l.code !== currentLang && l.code !== '*')
    .slice(0, 5);
  
  const translations = {
    en: '\n\n---\nPrefer a different language?',
    es: '\n\n---\n¿Prefieres otro idioma?',
    fr: '\n\n---\nPréférez-vous une autre langue?',
    de: '\n\n---\nBevorzugen Sie eine andere Sprache?',
    ja: '\n\n---\n他の言語をご希望ですか？',
    zh: '\n\n---\n需要其他语言吗？'
  };
  
  const text = translations[currentLang] || translations.en;
  
  return text + ' ' + otherLangs.map(l => l.native).join(' | ');
}

/**
 * Get customer language preference
 */
function getCustomerLanguagePreference(email) {
  const props = PropertiesService.getScriptProperties();
  const pref = props.getProperty(`lang_pref_${email}`);
  return pref || null;
}

/**
 * Update customer language preference
 */
function updateCustomerLanguagePreference(email, langCode) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(`lang_pref_${email}`, langCode);
}

/**
 * Display language statistics
 */
function displayLanguageStats(stats) {
  console.log('\n📊 Language Distribution');
  console.log('========================');
  
  const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
  
  Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([lang, count]) => {
      const percentage = ((count / total) * 100).toFixed(1);
      const langInfo = MULTILINGUAL_CONFIG.supportedLanguages.find(l => l.code === lang);
      console.log(`${langInfo.native}: ${count} (${percentage}%)`);
    });
}

/**
 * Update language-specific knowledge bases
 */
function updateLanguageKnowledgeBases() {
  console.log('\n📚 Updating language knowledge bases...');
  
  // Get frequently asked questions by language
  const faqByLanguage = analyzeFAQsByLanguage();
  
  // Create language-specific KB articles
  Object.entries(faqByLanguage).forEach(([lang, faqs]) => {
    if (faqs.length > 0) {
      console.log(`   Creating ${faqs.length} articles for ${lang}`);
      // In production, would create actual KB articles
    }
  });
}

/**
 * Analyze FAQs by language
 */
function analyzeFAQsByLanguage() {
  // In production, analyze ticket history by language
  return {
    es: ['¿Cómo reseteo mi contraseña?', '¿Cuánto cuesta?'],
    fr: ['Comment réinitialiser mon mot de passe?', 'Quel est le prix?'],
    de: ['Wie setze ich mein Passwort zurück?', 'Was kostet es?']
  };
}

/**
 * Special handlers for specific languages
 */
const languageHandlers = {
  // Handle right-to-left languages
  ar: function(email, response) {
    response.reply = `<div dir="rtl">${response.reply}</div>`;
    return response;
  },
  
  // Handle Japanese formal language
  ja: function(email, response) {
    // Add appropriate keigo (honorific language)
    response.reply = response.reply.replace(/Thank you/g, 'ありがとうございます');
    return response;
  },
  
  // Handle Chinese simplified/traditional
  zh: function(email, response) {
    // Detect and handle simplified vs traditional
    const isTraditional = /[\u4e00-\u9fa5]/.test(email.body) && 
                         email.body.includes('臺灣') || email.body.includes('香港');
    
    if (isTraditional) {
      response.reply = convertToTraditionalChinese(response.reply);
    }
    return response;
  }
};

// Helper function (simplified example)
function convertToTraditionalChinese(text) {
  // In production, use proper conversion library
  return text;
}

// Run multilingual support
function runMultilingualSupport() {
  multilingualSupportProcessor();
}