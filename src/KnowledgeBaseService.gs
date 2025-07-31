/**
 * KnowledgeBaseService.gs - Multi-Source Knowledge Base Management
 * 
 * Supports multiple knowledge sources:
 * - Google Sheets
 * - External APIs (REST endpoints)
 * - GitHub repositories (markdown files)
 * - Notion databases
 * - Confluence spaces
 * - Custom webhooks
 */

class KnowledgeBaseService {
  constructor() {
    this.config = Config.get('knowledgeBase');
    this.cache = CacheService.getScriptCache();
    this.sources = this.initializeSources();
  }

  /**
   * Initialize knowledge sources from config
   */
  initializeSources() {
    const sources = [];
    
    // Google Sheets source (default)
    if (this.config.sheetId) {
      sources.push({
        type: 'sheets',
        id: 'google-sheets',
        name: 'Google Sheets KB',
        config: { sheetId: this.config.sheetId }
      });
    }
    
    // External API sources
    if (this.config.externalSources) {
      this.config.externalSources.forEach(source => {
        sources.push({
          type: source.type,
          id: source.id,
          name: source.name,
          config: source.config
        });
      });
    }
    
    return sources;
  }

  /**
   * Search across all knowledge sources
   */
  search(query, options = {}) {
    const limit = options.limit || 5;
    const sources = options.sources || this.sources.map(s => s.id);
    const cacheKey = `kb_search_${Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, query + JSON.stringify(options))}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && this.config.cacheEnabled) {
      return JSON.parse(cached);
    }
    
    // Search all specified sources
    const allResults = [];
    
    sources.forEach(sourceId => {
      const source = this.sources.find(s => s.id === sourceId);
      if (!source) return;
      
      try {
        const results = this.searchSource(source, query, limit);
        allResults.push(...results);
      } catch (error) {
        console.error(`Error searching source ${sourceId}:`, error);
      }
    });
    
    // Rank and deduplicate results
    const rankedResults = this.rankResults(allResults, query);
    const finalResults = rankedResults.slice(0, limit);
    
    // Cache results
    if (this.config.cacheEnabled) {
      this.cache.put(cacheKey, JSON.stringify(finalResults), this.config.cacheExpiry || 3600);
    }
    
    return finalResults;
  }

  /**
   * Search a specific source
   */
  searchSource(source, query, limit) {
    switch (source.type) {
      case 'sheets':
        return this.searchGoogleSheets(source.config, query, limit);
      
      case 'api':
        return this.searchExternalAPI(source.config, query, limit);
      
      case 'github':
        return this.searchGitHub(source.config, query, limit);
      
      case 'notion':
        return this.searchNotion(source.config, query, limit);
      
      case 'confluence':
        return this.searchConfluence(source.config, query, limit);
      
      case 'webhook':
        return this.searchWebhook(source.config, query, limit);
      
      default:
        console.error(`Unknown source type: ${source.type}`);
        return [];
    }
  }

  /**
   * Search Google Sheets
   */
  searchGoogleSheets(config, query, limit) {
    try {
      const sheet = SpreadsheetApp.openById(config.sheetId);
      const dataSheet = sheet.getSheetByName(config.sheetName || 'Articles') || sheet.getSheets()[0];
      const data = dataSheet.getDataRange().getValues();
      
      if (data.length < 2) return [];
      
      const headers = data[0];
      const articles = [];
      
      // Convert to objects
      for (let i = 1; i < data.length; i++) {
        const article = {};
        headers.forEach((header, index) => {
          article[header.toLowerCase()] = data[i][index];
        });
        article.source = 'google-sheets';
        article.sourceId = config.sheetId;
        articles.push(article);
      }
      
      // Search and score
      return this.scoreArticles(articles, query).slice(0, limit);
      
    } catch (error) {
      console.error('Google Sheets search error:', error);
      return [];
    }
  }

  /**
   * Search External API
   */
  searchExternalAPI(config, query, limit) {
    try {
      const url = config.endpoint;
      const headers = config.headers || {};
      
      // Add auth if configured
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }
      
      const payload = {
        query: query,
        limit: limit,
        ...config.additionalParams
      };
      
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: headers,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      
      const response = UrlFetchApp.fetch(url, options);
      
      if (response.getResponseCode() !== 200) {
        throw new Error(`API returned ${response.getResponseCode()}: ${response.getContentText()}`);
      }
      
      const data = JSON.parse(response.getContentText());
      const articles = this.transformAPIResponse(data, config.responseMapping);
      
      return articles.map(article => ({
        ...article,
        source: 'api',
        sourceId: config.endpoint
      }));
      
    } catch (error) {
      console.error('External API search error:', error);
      return [];
    }
  }

  /**
   * Search GitHub repository
   */
  searchGitHub(config, query, limit) {
    try {
      const baseUrl = 'https://api.github.com';
      const headers = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      if (config.token) {
        headers['Authorization'] = `token ${config.token}`;
      }
      
      // Search for files in the repository
      const searchUrl = `${baseUrl}/search/code?q=${encodeURIComponent(query)}+repo:${config.owner}/${config.repo}+path:${config.path || ''}`;
      
      const response = UrlFetchApp.fetch(searchUrl, {
        headers: headers,
        muteHttpExceptions: true
      });
      
      if (response.getResponseCode() !== 200) {
        throw new Error(`GitHub API error: ${response.getContentText()}`);
      }
      
      const data = JSON.parse(response.getContentText());
      const articles = [];
      
      // Fetch content for each matching file
      const items = data.items.slice(0, limit);
      
      items.forEach(item => {
        try {
          const contentResponse = UrlFetchApp.fetch(item.url, {
            headers: headers
          });
          
          const fileData = JSON.parse(contentResponse.getContentText());
          const content = Utilities.newBlob(Utilities.base64Decode(fileData.content)).getDataAsString();
          
          // Parse markdown to extract title and content
          const parsed = this.parseMarkdown(content);
          
          articles.push({
            id: item.sha,
            title: parsed.title || item.name,
            content: parsed.content,
            url: item.html_url,
            source: 'github',
            sourceId: `${config.owner}/${config.repo}`,
            path: item.path,
            metadata: parsed.metadata
          });
          
        } catch (error) {
          console.error(`Error fetching file ${item.path}:`, error);
        }
      });
      
      return articles;
      
    } catch (error) {
      console.error('GitHub search error:', error);
      return [];
    }
  }

  /**
   * Search Notion database
   */
  searchNotion(config, query, limit) {
    try {
      const url = 'https://api.notion.com/v1/databases/' + config.databaseId + '/query';
      const headers = {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      };
      
      const payload = {
        filter: {
          or: [
            {
              property: config.titleProperty || 'Name',
              rich_text: { contains: query }
            },
            {
              property: config.contentProperty || 'Content',
              rich_text: { contains: query }
            }
          ]
        },
        page_size: limit
      };
      
      const response = UrlFetchApp.fetch(url, {
        method: 'post',
        headers: headers,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      
      if (response.getResponseCode() !== 200) {
        throw new Error(`Notion API error: ${response.getContentText()}`);
      }
      
      const data = JSON.parse(response.getContentText());
      const articles = [];
      
      data.results.forEach(page => {
        const title = this.extractNotionProperty(page.properties[config.titleProperty || 'Name']);
        const content = this.extractNotionProperty(page.properties[config.contentProperty || 'Content']);
        
        articles.push({
          id: page.id,
          title: title,
          content: content,
          url: page.url,
          source: 'notion',
          sourceId: config.databaseId,
          lastEdited: page.last_edited_time
        });
      });
      
      return articles;
      
    } catch (error) {
      console.error('Notion search error:', error);
      return [];
    }
  }

  /**
   * Search Confluence
   */
  searchConfluence(config, query, limit) {
    try {
      const baseUrl = config.baseUrl;
      const auth = Utilities.base64Encode(`${config.username}:${config.apiToken}`);
      
      const searchUrl = `${baseUrl}/rest/api/content/search?cql=text~"${encodeURIComponent(query)}" AND space="${config.spaceKey}"&limit=${limit}`;
      
      const response = UrlFetchApp.fetch(searchUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        },
        muteHttpExceptions: true
      });
      
      if (response.getResponseCode() !== 200) {
        throw new Error(`Confluence API error: ${response.getContentText()}`);
      }
      
      const data = JSON.parse(response.getContentText());
      const articles = [];
      
      data.results.forEach(page => {
        // Fetch full content
        const contentUrl = `${baseUrl}/rest/api/content/${page.id}?expand=body.storage`;
        const contentResponse = UrlFetchApp.fetch(contentUrl, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json'
          }
        });
        
        const fullPage = JSON.parse(contentResponse.getContentText());
        
        articles.push({
          id: page.id,
          title: page.title,
          content: this.stripHtml(fullPage.body.storage.value),
          url: `${baseUrl}${page._links.webui}`,
          source: 'confluence',
          sourceId: config.spaceKey,
          lastModified: fullPage.version.when
        });
      });
      
      return articles;
      
    } catch (error) {
      console.error('Confluence search error:', error);
      return [];
    }
  }

  /**
   * Search via custom webhook
   */
  searchWebhook(config, query, limit) {
    try {
      const response = UrlFetchApp.fetch(config.url, {
        method: config.method || 'POST',
        headers: config.headers || {},
        payload: JSON.stringify({
          query: query,
          limit: limit,
          ...config.payload
        }),
        muteHttpExceptions: true
      });
      
      if (response.getResponseCode() !== 200) {
        throw new Error(`Webhook error: ${response.getContentText()}`);
      }
      
      const data = JSON.parse(response.getContentText());
      const articles = this.transformWebhookResponse(data, config.mapping);
      
      return articles.map(article => ({
        ...article,
        source: 'webhook',
        sourceId: config.url
      }));
      
    } catch (error) {
      console.error('Webhook search error:', error);
      return [];
    }
  }

  /**
   * Transform API response based on mapping
   */
  transformAPIResponse(data, mapping) {
    const articles = [];
    const items = mapping.itemsPath ? this.getNestedValue(data, mapping.itemsPath) : data;
    
    if (!Array.isArray(items)) return [];
    
    items.forEach(item => {
      const article = {};
      
      Object.keys(mapping.fields).forEach(field => {
        article[field] = this.getNestedValue(item, mapping.fields[field]);
      });
      
      articles.push(article);
    });
    
    return articles;
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  /**
   * Parse markdown content
   */
  parseMarkdown(content) {
    const lines = content.split('\n');
    let title = '';
    let metadata = {};
    let bodyLines = [];
    let inFrontmatter = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for frontmatter
      if (line === '---' && i === 0) {
        inFrontmatter = true;
        continue;
      } else if (line === '---' && inFrontmatter) {
        inFrontmatter = false;
        continue;
      }
      
      // Parse frontmatter
      if (inFrontmatter) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          metadata[match[1]] = match[2];
        }
        continue;
      }
      
      // Extract title from first heading
      if (!title && line.startsWith('#')) {
        title = line.replace(/^#+\s*/, '');
        continue;
      }
      
      bodyLines.push(line);
    }
    
    return {
      title: title || metadata.title || 'Untitled',
      content: bodyLines.join('\n').trim(),
      metadata
    };
  }

  /**
   * Extract Notion property value
   */
  extractNotionProperty(prop) {
    if (!prop) return '';
    
    if (prop.rich_text) {
      return prop.rich_text.map(t => t.plain_text).join('');
    } else if (prop.title) {
      return prop.title.map(t => t.plain_text).join('');
    } else if (prop.select) {
      return prop.select.name;
    } else if (prop.multi_select) {
      return prop.multi_select.map(s => s.name).join(', ');
    }
    
    return '';
  }

  /**
   * Strip HTML tags
   */
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Transform webhook response
   */
  transformWebhookResponse(data, mapping) {
    if (!mapping) return Array.isArray(data) ? data : [data];
    return this.transformAPIResponse(data, mapping);
  }

  /**
   * Score articles based on query relevance
   */
  scoreArticles(articles, query) {
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/);
    
    const scored = articles.map(article => {
      let score = 0;
      
      // Title match (highest weight)
      if (article.title) {
        const titleLower = article.title.toLowerCase();
        words.forEach(word => {
          if (titleLower.includes(word)) score += 3;
        });
        if (titleLower === queryLower) score += 5;
      }
      
      // Content match
      if (article.content) {
        const contentLower = article.content.toLowerCase();
        words.forEach(word => {
          if (contentLower.includes(word)) score += 1;
        });
      }
      
      // Tags match
      if (article.tags) {
        const tags = Array.isArray(article.tags) ? article.tags : article.tags.split(',');
        tags.forEach(tag => {
          if (tag.toLowerCase().includes(queryLower)) score += 2;
        });
      }
      
      // Category match
      if (article.category && article.category.toLowerCase().includes(queryLower)) {
        score += 2;
      }
      
      return { article, score };
    });
    
    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.article);
  }

  /**
   * Rank results from multiple sources
   */
  rankResults(results, query) {
    // Score all results
    const scored = this.scoreArticles(results, query);
    
    // Deduplicate by title similarity
    const unique = [];
    const seen = new Set();
    
    scored.forEach(article => {
      const key = article.title.toLowerCase().replace(/\s+/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(article);
      }
    });
    
    return unique;
  }

  /**
   * Add a new knowledge source
   */
  addSource(source) {
    const config = Config.get('knowledgeBase');
    
    if (!config.externalSources) {
      config.externalSources = [];
    }
    
    config.externalSources.push(source);
    Config.set('knowledgeBase', config);
    
    // Reinitialize sources
    this.sources = this.initializeSources();
  }

  /**
   * Remove a knowledge source
   */
  removeSource(sourceId) {
    const config = Config.get('knowledgeBase');
    
    if (config.externalSources) {
      config.externalSources = config.externalSources.filter(s => s.id !== sourceId);
      Config.set('knowledgeBase', config);
    }
    
    // Reinitialize sources
    this.sources = this.initializeSources();
  }

  /**
   * Test a knowledge source
   */
  testSource(sourceId) {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) {
      return { success: false, error: 'Source not found' };
    }
    
    try {
      const results = this.searchSource(source, 'test', 1);
      return { 
        success: true, 
        message: `Source is working. Found ${results.length} results.`,
        sample: results[0]
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all configured sources
   */
  getSources() {
    return this.sources.map(source => ({
      id: source.id,
      name: source.name,
      type: source.type,
      status: 'active' // Could be extended to check health
    }));
  }
}

// Create singleton instance
const KnowledgeBase = new KnowledgeBaseService();

// Utility functions
function searchKnowledgeBase(query, limit = 5) {
  return KnowledgeBase.search(query, { limit });
}

function addKnowledgeSource(source) {
  return KnowledgeBase.addSource(source);
}

function testKnowledgeSource(sourceId) {
  return KnowledgeBase.testSource(sourceId);
}