/**
 * DriveKnowledgeService.gs - Google Drive Knowledge Base Integration
 * 
 * Complete Drive integration for knowledge base management
 * Supports all Drive file types with intelligent content extraction
 */

class DriveKnowledgeService {
  constructor() {
    this.config = Config.get('knowledgeBase.driveConfig');
    this.cache = CacheService.getScriptCache();
    this.supportedTypes = {
      'docs': 'application/vnd.google-apps.document',
      'sheets': 'application/vnd.google-apps.spreadsheet',
      'slides': 'application/vnd.google-apps.presentation',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    this.indexedContent = new Map();
  }

  /**
   * Sync entire Drive knowledge base
   */
  async syncKnowledgeBase() {
    profile('drive_sync_full');
    
    try {
      const folders = this.getDriveKnowledgeFolders();
      const allArticles = [];
      
      for (const folder of folders) {
        const articles = await this.syncFolder(folder);
        allArticles.push(...articles);
      }
      
      // Update search index
      await this.updateSearchIndex(allArticles);
      
      // Store sync results
      this.storeSyncResults(allArticles);
      
      profileEnd('drive_sync_full');
      
      logInfo('Drive knowledge base synced', {
        totalArticles: allArticles.length,
        folders: folders.length
      });
      
      return allArticles;
      
    } catch (error) {
      profileEnd('drive_sync_full');
      throw handleError(error, { operation: 'syncKnowledgeBase' });
    }
  }

  /**
   * Sync specific folder
   */
  async syncFolder(folder) {
    profile('drive_sync_folder');
    
    try {
      const articles = [];
      const files = this.getFilesInFolder(folder);
      
      for (const file of files) {
        try {
          const article = await this.processFile(file);
          if (article) {
            articles.push(article);
          }
        } catch (error) {
          logError(`Failed to process file: ${file.getName()}`, {
            fileId: file.getId(),
            error: error.message
          });
        }
      }
      
      profileEnd('drive_sync_folder');
      return articles;
      
    } catch (error) {
      profileEnd('drive_sync_folder');
      throw handleError(error, { operation: 'syncFolder' });
    }
  }

  /**
   * Process individual file
   */
  async processFile(file) {
    profile('drive_process_file');
    
    try {
      const fileType = this.getFileType(file);
      if (!fileType) {
        return null;
      }
      
      // Check if file was modified since last sync
      const lastModified = file.getLastUpdated();
      const lastSynced = this.getLastSyncTime(file.getId());
      
      if (lastSynced && lastModified <= lastSynced) {
        return this.getCachedArticle(file.getId());
      }
      
      const content = await this.extractContent(file, fileType);
      const metadata = this.extractMetadata(file, content);
      
      const article = {
        id: `drive_${file.getId()}`,
        title: metadata.title || file.getName(),
        content: content.text,
        plainText: content.plainText,
        category: metadata.category || 'general',
        tags: metadata.tags || [],
        solution: metadata.solution || '',
        source: 'drive',
        sourceId: file.getId(),
        url: file.getUrl(),
        lastModified: lastModified.toISOString(),
        fileType: fileType,
        folder: this.getFileFolder(file),
        permissions: this.getFilePermissions(file),
        metadata: {
          owner: file.getOwner()?.getEmail(),
          size: file.getSize(),
          mimeType: file.getBlob().getContentType(),
          images: content.images || [],
          links: content.links || [],
          structure: content.structure || {}
        }
      };
      
      // Cache the article
      this.cacheArticle(article);
      
      // Update sync time
      this.updateSyncTime(file.getId());
      
      profileEnd('drive_process_file');
      return article;
      
    } catch (error) {
      profileEnd('drive_process_file');
      throw handleError(error, { 
        operation: 'processFile',
        fileId: file.getId(),
        fileName: file.getName()
      });
    }
  }

  /**
   * Extract content from file based on type
   */
  async extractContent(file, fileType) {
    switch (fileType) {
      case 'docs':
        return this.extractGoogleDocsContent(file);
      case 'sheets':
        return this.extractGoogleSheetsContent(file);
      case 'slides':
        return this.extractGoogleSlidesContent(file);
      case 'pdf':
        return this.extractPDFContent(file);
      case 'txt':
      case 'md':
        return this.extractTextContent(file);
      case 'docx':
        return this.extractDocxContent(file);
      default:
        return { text: '', plainText: '' };
    }
  }

  /**
   * Extract Google Docs content
   */
  extractGoogleDocsContent(file) {
    try {
      const doc = DocumentApp.openById(file.getId());
      const body = doc.getBody();
      
      const content = {
        text: body.getText(),
        plainText: body.getText(),
        images: [],
        links: [],
        structure: {
          headings: [],
          paragraphs: body.getParagraphs().length,
          tables: body.getTables().length
        }
      };
      
      // Extract headings
      const paragraphs = body.getParagraphs();
      paragraphs.forEach((paragraph, index) => {
        const heading = paragraph.getHeading();
        if (heading !== DocumentApp.ParagraphHeading.NORMAL) {
          content.structure.headings.push({
            level: this.getHeadingLevel(heading),
            text: paragraph.getText(),
            index: index
          });
        }
      });
      
      // Extract links
      const textElements = body.getDescendants();
      textElements.forEach(element => {
        if (element.getType() === DocumentApp.ElementType.TEXT) {
          const text = element.asText();
          const url = text.getLinkUrl();
          if (url) {
            content.links.push({
              text: text.getText(),
              url: url
            });
          }
        }
      });
      
      // Extract images (inline images)
      const images = body.getImages();
      images.forEach(image => {
        content.images.push({
          altText: image.getAltDescription() || '',
          width: image.getWidth(),
          height: image.getHeight()
        });
      });
      
      return content;
      
    } catch (error) {
      logError('Failed to extract Google Docs content', {
        fileId: file.getId(),
        error: error.message
      });
      return { text: '', plainText: '' };
    }
  }

  /**
   * Extract Google Sheets content
   */
  extractGoogleSheetsContent(file) {
    try {
      const spreadsheet = SpreadsheetApp.openById(file.getId());
      const sheets = spreadsheet.getSheets();
      
      let allContent = '';
      const structure = {
        sheets: [],
        totalRows: 0,
        totalColumns: 0
      };
      
      sheets.forEach(sheet => {
        const range = sheet.getDataRange();
        const values = range.getValues();
        
        structure.sheets.push({
          name: sheet.getName(),
          rows: values.length,
          columns: values[0]?.length || 0
        });
        
        structure.totalRows += values.length;
        structure.totalColumns = Math.max(structure.totalColumns, values[0]?.length || 0);
        
        // Convert sheet data to text
        values.forEach(row => {
          allContent += row.join(' | ') + '\n';
        });
        
        allContent += '\n---\n';
      });
      
      return {
        text: allContent,
        plainText: allContent,
        images: [],
        links: [],
        structure: structure
      };
      
    } catch (error) {
      logError('Failed to extract Google Sheets content', {
        fileId: file.getId(),
        error: error.message
      });
      return { text: '', plainText: '' };
    }
  }

  /**
   * Extract Google Slides content
   */
  extractGoogleSlidesContent(file) {
    try {
      const presentation = SlidesApp.openById(file.getId());
      const slides = presentation.getSlides();
      
      let allContent = '';
      const structure = {
        slides: slides.length,
        totalElements: 0
      };
      
      slides.forEach((slide, index) => {
        allContent += `\n=== Slide ${index + 1} ===\n`;
        
        const pageElements = slide.getPageElements();
        structure.totalElements += pageElements.length;
        
        pageElements.forEach(element => {
          if (element.getPageElementType() === SlidesApp.PageElementType.SHAPE) {
            const shape = element.asShape();
            const text = shape.getText();
            if (text) {
              allContent += text.asString() + '\n';
            }
          }
        });
      });
      
      return {
        text: allContent,
        plainText: allContent,
        images: [],
        links: [],
        structure: structure
      };
      
    } catch (error) {
      logError('Failed to extract Google Slides content', {
        fileId: file.getId(),
        error: error.message
      });
      return { text: '', plainText: '' };
    }
  }

  /**
   * Extract PDF content
   */
  extractPDFContent(file) {
    try {
      // Note: Apps Script doesn't have native PDF text extraction
      // This is a placeholder for future implementation
      // Consider using external PDF parsing service
      
      logWarn('PDF text extraction not implemented', {
        fileId: file.getId(),
        fileName: file.getName()
      });
      
      return {
        text: `PDF Document: ${file.getName()}`,
        plainText: `PDF Document: ${file.getName()}`,
        images: [],
        links: [],
        structure: {
          type: 'pdf',
          size: file.getSize(),
          note: 'PDF text extraction requires external service'
        }
      };
      
    } catch (error) {
      logError('Failed to extract PDF content', {
        fileId: file.getId(),
        error: error.message
      });
      return { text: '', plainText: '' };
    }
  }

  /**
   * Extract text content
   */
  extractTextContent(file) {
    try {
      const blob = file.getBlob();
      const content = blob.getDataAsString();
      
      return {
        text: content,
        plainText: content,
        images: [],
        links: this.extractLinksFromText(content),
        structure: {
          type: 'text',
          lines: content.split('\n').length,
          characters: content.length
        }
      };
      
    } catch (error) {
      logError('Failed to extract text content', {
        fileId: file.getId(),
        error: error.message
      });
      return { text: '', plainText: '' };
    }
  }

  /**
   * Extract DOCX content
   */
  extractDocxContent(file) {
    try {
      // Note: Apps Script doesn't have native DOCX parsing
      // This is a placeholder implementation
      
      logWarn('DOCX text extraction not fully implemented', {
        fileId: file.getId(),
        fileName: file.getName()
      });
      
      return {
        text: `DOCX Document: ${file.getName()}`,
        plainText: `DOCX Document: ${file.getName()}`,
        images: [],
        links: [],
        structure: {
          type: 'docx',
          size: file.getSize(),
          note: 'DOCX text extraction requires external service'
        }
      };
      
    } catch (error) {
      logError('Failed to extract DOCX content', {
        fileId: file.getId(),
        error: error.message
      });
      return { text: '', plainText: '' };
    }
  }

  /**
   * Search Drive knowledge base
   */
  async searchDriveKnowledge(query, options = {}) {
    profile('drive_search');
    
    try {
      const {
        limit = 10,
        fileTypes = [],
        folders = [],
        includeContent = true,
        fuzzySearch = true
      } = options;
      
      let searchResults = [];
      
      // Search cached articles first
      const cachedResults = this.searchCachedArticles(query, options);
      searchResults.push(...cachedResults);
      
      // If not enough results, search Drive directly
      if (searchResults.length < limit) {
        const driveResults = await this.searchDriveFiles(query, options);
        searchResults.push(...driveResults);
      }
      
      // Score and sort results
      const scoredResults = this.scoreSearchResults(searchResults, query);
      
      profileEnd('drive_search');
      
      return scoredResults.slice(0, limit);
      
    } catch (error) {
      profileEnd('drive_search');
      throw handleError(error, { operation: 'searchDriveKnowledge' });
    }
  }

  /**
   * Get Drive knowledge folders
   */
  getDriveKnowledgeFolders() {
    const folders = [];
    
    try {
      // Get root folder
      const rootFolderId = this.config.rootFolderId || this.findOrCreateRootFolder();
      const rootFolder = DriveApp.getFolderById(rootFolderId);
      folders.push(rootFolder);
      
      // Get monitored folders
      if (this.config.monitorFolders) {
        this.config.monitorFolders.forEach(folderPath => {
          const folder = this.findFolderByPath(folderPath);
          if (folder) {
            folders.push(folder);
          }
        });
      }
      
      // Include subfolders if configured
      if (this.config.includeSubfolders) {
        folders.forEach(folder => {
          const subfolders = this.getSubfolders(folder);
          folders.push(...subfolders);
        });
      }
      
    } catch (error) {
      logError('Failed to get Drive knowledge folders', {
        error: error.message
      });
    }
    
    return folders;
  }

  /**
   * Get files in folder
   */
  getFilesInFolder(folder) {
    const files = [];
    const fileIterator = folder.getFiles();
    
    while (fileIterator.hasNext()) {
      const file = fileIterator.next();
      
      // Check if file type is supported
      if (this.isFileTypeSupported(file)) {
        files.push(file);
      }
    }
    
    return files;
  }

  /**
   * Get file type
   */
  getFileType(file) {
    const mimeType = file.getBlob().getContentType();
    
    for (const [type, mime] of Object.entries(this.supportedTypes)) {
      if (mimeType === mime) {
        return type;
      }
    }
    
    // Check by extension
    const name = file.getName().toLowerCase();
    for (const type of Object.keys(this.supportedTypes)) {
      if (name.endsWith(`.${type}`)) {
        return type;
      }
    }
    
    return null;
  }

  /**
   * Check if file type is supported
   */
  isFileTypeSupported(file) {
    const fileType = this.getFileType(file);
    return fileType && this.config.fileTypes.includes(fileType);
  }

  /**
   * Extract metadata from file and content
   */
  extractMetadata(file, content) {
    const metadata = {
      title: file.getName(),
      category: 'general',
      tags: [],
      solution: ''
    };
    
    // Extract title from content if available
    if (content.structure?.headings?.length > 0) {
      metadata.title = content.structure.headings[0].text;
    }
    
    // Extract category from folder name
    const folder = this.getFileFolder(file);
    if (folder) {
      metadata.category = folder.getName().toLowerCase();
    }
    
    // Extract tags from content
    metadata.tags = this.extractTagsFromContent(content.text);
    
    // Try to find solution section
    metadata.solution = this.extractSolutionFromContent(content.text);
    
    return metadata;
  }

  /**
   * Extract tags from content
   */
  extractTagsFromContent(text) {
    const tags = [];
    
    // Look for hashtags
    const hashtagMatches = text.match(/#(\w+)/g);
    if (hashtagMatches) {
      tags.push(...hashtagMatches.map(tag => tag.substring(1)));
    }
    
    // Look for tag sections
    const tagSectionMatch = text.match(/tags?:\s*([^\n]+)/i);
    if (tagSectionMatch) {
      const tagText = tagSectionMatch[1];
      const extractedTags = tagText.split(/[,;]/).map(tag => tag.trim());
      tags.push(...extractedTags);
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Extract solution from content
   */
  extractSolutionFromContent(text) {
    const solutionPatterns = [
      /solution:\s*([^]*?)(?=\n\n|\n[A-Z]|$)/i,
      /answer:\s*([^]*?)(?=\n\n|\n[A-Z]|$)/i,
      /resolution:\s*([^]*?)(?=\n\n|\n[A-Z]|$)/i,
      /fix:\s*([^]*?)(?=\n\n|\n[A-Z]|$)/i
    ];
    
    for (const pattern of solutionPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return '';
  }

  /**
   * Helper methods
   */
  
  findOrCreateRootFolder() {
    const folderName = this.config.rootFolder || 'Knowledge Base';
    const folders = DriveApp.getFoldersByName(folderName);
    
    if (folders.hasNext()) {
      return folders.next().getId();
    }
    
    // Create folder if it doesn't exist
    const folder = DriveApp.createFolder(folderName);
    return folder.getId();
  }

  findFolderByPath(path) {
    try {
      const parts = path.split('/');
      let folder = DriveApp.getRootFolder();
      
      for (const part of parts) {
        const subfolders = folder.getFoldersByName(part);
        if (subfolders.hasNext()) {
          folder = subfolders.next();
        } else {
          return null;
        }
      }
      
      return folder;
    } catch (error) {
      return null;
    }
  }

  getSubfolders(folder) {
    const subfolders = [];
    const iterator = folder.getFolders();
    
    while (iterator.hasNext()) {
      const subfolder = iterator.next();
      subfolders.push(subfolder);
      
      // Recursively get subfolders
      if (this.config.includeSubfolders) {
        subfolders.push(...this.getSubfolders(subfolder));
      }
    }
    
    return subfolders;
  }

  getFileFolder(file) {
    const parents = file.getParents();
    return parents.hasNext() ? parents.next() : null;
  }

  getFilePermissions(file) {
    return {
      canEdit: file.isViewable(),
      canComment: file.isViewable(),
      canView: file.isViewable(),
      owner: file.getOwner()?.getEmail()
    };
  }

  getHeadingLevel(heading) {
    const headingLevels = {
      [DocumentApp.ParagraphHeading.HEADING1]: 1,
      [DocumentApp.ParagraphHeading.HEADING2]: 2,
      [DocumentApp.ParagraphHeading.HEADING3]: 3,
      [DocumentApp.ParagraphHeading.HEADING4]: 4,
      [DocumentApp.ParagraphHeading.HEADING5]: 5,
      [DocumentApp.ParagraphHeading.HEADING6]: 6
    };
    
    return headingLevels[heading] || 0;
  }

  extractLinksFromText(text) {
    const links = [];
    const urlRegex = /https?:\/\/[^\s]+/g;
    let match;
    
    while ((match = urlRegex.exec(text)) !== null) {
      links.push({
        url: match[0],
        text: match[0]
      });
    }
    
    return links;
  }

  cacheArticle(article) {
    const key = `drive_article_${article.sourceId}`;
    this.cache.put(key, JSON.stringify(article), 3600); // 1 hour
  }

  getCachedArticle(fileId) {
    const key = `drive_article_${fileId}`;
    const cached = this.cache.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  updateSyncTime(fileId) {
    const key = `drive_sync_${fileId}`;
    this.cache.put(key, new Date().toISOString(), 86400); // 24 hours
  }

  getLastSyncTime(fileId) {
    const key = `drive_sync_${fileId}`;
    const cached = this.cache.get(key);
    return cached ? new Date(cached) : null;
  }

  updateSearchIndex(articles) {
    // Update in-memory search index
    this.indexedContent.clear();
    
    articles.forEach(article => {
      this.indexedContent.set(article.id, {
        title: article.title,
        content: article.plainText,
        tags: article.tags,
        category: article.category
      });
    });
    
    logInfo('Drive search index updated', {
      articlesIndexed: articles.length
    });
  }

  searchCachedArticles(query, options) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const [id, article] of this.indexedContent.entries()) {
      let score = 0;
      
      // Title match
      if (article.title.toLowerCase().includes(queryLower)) {
        score += 10;
      }
      
      // Content match
      if (article.content.toLowerCase().includes(queryLower)) {
        score += 5;
      }
      
      // Tag match
      if (article.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
        score += 8;
      }
      
      // Category match
      if (article.category.toLowerCase().includes(queryLower)) {
        score += 6;
      }
      
      if (score > 0) {
        results.push({
          id: id,
          score: score,
          article: article
        });
      }
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  async searchDriveFiles(query, options) {
    try {
      const searchQuery = this.buildDriveSearchQuery(query, options);
      const files = DriveApp.searchFiles(searchQuery);
      const results = [];
      
      while (files.hasNext() && results.length < options.limit) {
        const file = files.next();
        
        if (this.isFileTypeSupported(file)) {
          const article = await this.processFile(file);
          if (article) {
            results.push({
              id: article.id,
              score: 5, // Default score for Drive search
              article: article
            });
          }
        }
      }
      
      return results;
      
    } catch (error) {
      logError('Drive file search failed', {
        query: query,
        error: error.message
      });
      return [];
    }
  }

  buildDriveSearchQuery(query, options) {
    let searchQuery = `fullText contains "${query}"`;
    
    // Add file type filters
    if (options.fileTypes && options.fileTypes.length > 0) {
      const mimeTypes = options.fileTypes
        .map(type => this.supportedTypes[type])
        .filter(Boolean);
      
      if (mimeTypes.length > 0) {
        const mimeQuery = mimeTypes.map(mime => `mimeType = "${mime}"`).join(' or ');
        searchQuery += ` and (${mimeQuery})`;
      }
    }
    
    // Add folder filters
    if (options.folders && options.folders.length > 0) {
      const folderQuery = options.folders.map(folder => `"${folder}" in parents`).join(' or ');
      searchQuery += ` and (${folderQuery})`;
    }
    
    return searchQuery;
  }

  scoreSearchResults(results, query) {
    return results.map(result => {
      const article = result.article;
      let score = result.score;
      
      // Boost score based on various factors
      if (article.title.toLowerCase().includes(query.toLowerCase())) {
        score += 5;
      }
      
      if (article.category === 'faq' || article.category === 'help') {
        score += 3;
      }
      
      if (article.lastModified) {
        const daysSinceModified = (Date.now() - new Date(article.lastModified)) / (1000 * 60 * 60 * 24);
        if (daysSinceModified < 30) {
          score += 2; // Boost recent articles
        }
      }
      
      return {
        ...article,
        score: score,
        confidence: Math.min(score / 20, 1) // Normalize to 0-1
      };
    }).sort((a, b) => b.score - a.score);
  }

  storeSyncResults(articles) {
    const results = {
      timestamp: new Date().toISOString(),
      totalArticles: articles.length,
      byFileType: {},
      byFolder: {},
      errors: []
    };
    
    articles.forEach(article => {
      // Count by file type
      results.byFileType[article.fileType] = (results.byFileType[article.fileType] || 0) + 1;
      
      // Count by folder
      const folder = article.folder || 'root';
      results.byFolder[folder] = (results.byFolder[folder] || 0) + 1;
    });
    
    // Store results
    const props = PropertiesService.getScriptProperties();
    props.setProperty('drive_sync_results', JSON.stringify(results));
    
    // Record metric
    Metrics.recordMetric('drive_sync_completed', results);
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    const props = PropertiesService.getScriptProperties();
    const results = props.getProperty('drive_sync_results');
    
    return results ? JSON.parse(results) : null;
  }

  /**
   * Monitor Drive folder for changes
   */
  setupDriveMonitoring() {
    if (!this.config.autoSync) return;
    
    try {
      const folders = this.getDriveKnowledgeFolders();
      
      folders.forEach(folder => {
        // Set up file change triggers would go here
        // Note: Apps Script doesn't support real-time Drive monitoring
        // This would require periodic polling or webhook integration
        
        logInfo('Drive monitoring setup for folder', {
          folderId: folder.getId(),
          folderName: folder.getName()
        });
      });
      
    } catch (error) {
      logError('Failed to setup Drive monitoring', {
        error: error.message
      });
    }
  }
}

// Create singleton instance
const DriveKnowledge = new DriveKnowledgeService();

// Convenience functions
function syncDriveKnowledgeBase() {
  return DriveKnowledge.syncKnowledgeBase();
}

function searchDriveKnowledge(query, options) {
  return DriveKnowledge.searchDriveKnowledge(query, options);
}

function getDriveSyncStats() {
  return DriveKnowledge.getSyncStats();
}