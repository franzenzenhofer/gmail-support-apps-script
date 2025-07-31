/**
 * Google Apps Script Mock Setup
 * Provides mock implementations for GAS global objects and services
 */

// Mock Logger
global.Logger = {
  log: jest.fn((message) => console.log('[Logger]', message)),
  clear: jest.fn(),
};

// Mock console (GAS has limited console)
global.console = {
  log: jest.fn((...args) => console.log(...args)),
  error: jest.fn((...args) => console.error(...args)),
  warn: jest.fn((...args) => console.warn(...args)),
  info: jest.fn((...args) => console.info(...args)),
  time: jest.fn(),
  timeEnd: jest.fn(),
};

// Mock Utilities
global.Utilities = {
  formatDate: jest.fn((date, timeZone, format) => {
    return new Date(date).toISOString();
  }),
  formatString: jest.fn((template, ...args) => {
    let result = template;
    args.forEach((arg, i) => {
      result = result.replace(new RegExp(`%${i + 1}`, 'g'), arg);
    });
    return result;
  }),
  newBlob: jest.fn((data, contentType, name) => ({
    getBytes: () => data,
    getContentType: () => contentType,
    getName: () => name,
    setName: (newName) => name = newName,
  })),
  base64Encode: jest.fn((data) => Buffer.from(data).toString('base64')),
  base64Decode: jest.fn((data) => Buffer.from(data, 'base64').toString()),
  computeDigest: jest.fn((algorithm, data) => 'mock-digest'),
  sleep: jest.fn((milliseconds) => {}),
  jsonParse: jest.fn(JSON.parse),
  jsonStringify: jest.fn(JSON.stringify),
};

// Mock PropertiesService
const createPropertyStore = () => {
  const store = new Map();
  return {
    getProperty: jest.fn((key) => store.get(key) || null),
    setProperty: jest.fn((key, value) => {
      store.set(key, value);
      return this;
    }),
    deleteProperty: jest.fn((key) => {
      store.delete(key);
      return this;
    }),
    getProperties: jest.fn(() => Object.fromEntries(store)),
    setProperties: jest.fn((properties, deleteOthers = false) => {
      if (deleteOthers) store.clear();
      Object.entries(properties).forEach(([k, v]) => store.set(k, v));
      return this;
    }),
    deleteAllProperties: jest.fn(() => {
      store.clear();
      return this;
    }),
    getKeys: jest.fn(() => Array.from(store.keys())),
  };
};

global.PropertiesService = {
  getScriptProperties: jest.fn(() => createPropertyStore()),
  getUserProperties: jest.fn(() => createPropertyStore()),
  getDocumentProperties: jest.fn(() => createPropertyStore()),
};

// Mock CacheService
const createCache = () => {
  const cache = new Map();
  return {
    get: jest.fn((key) => cache.get(key) || null),
    put: jest.fn((key, value, expirationInSeconds = 600) => {
      cache.set(key, value);
      if (expirationInSeconds > 0) {
        setTimeout(() => cache.delete(key), expirationInSeconds * 1000);
      }
    }),
    remove: jest.fn((key) => cache.delete(key)),
    removeAll: jest.fn(() => cache.clear()),
    getAll: jest.fn((keys) => {
      const result = {};
      keys.forEach(key => {
        if (cache.has(key)) result[key] = cache.get(key);
      });
      return result;
    }),
    putAll: jest.fn((values, expirationInSeconds = 600) => {
      Object.entries(values).forEach(([k, v]) => {
        cache.set(k, v);
      });
    }),
  };
};

global.CacheService = {
  getScriptCache: jest.fn(() => createCache()),
  getUserCache: jest.fn(() => createCache()),
  getDocumentCache: jest.fn(() => createCache()),
};

// Mock UrlFetchApp
global.UrlFetchApp = {
  fetch: jest.fn((url, options = {}) => {
    return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ success: true, url, options }),
      getBlob: () => Utilities.newBlob('mock-response', 'text/plain', 'response.txt'),
      getHeaders: () => ({ 'Content-Type': 'application/json' }),
      getAllHeaders: () => ({ 'Content-Type': ['application/json'] }),
    };
  }),
  fetchAll: jest.fn((requests) => {
    return requests.map(req => UrlFetchApp.fetch(req.url, req));
  }),
};

// Mock GmailApp
const createMockThread = (id, messages = []) => ({
  getId: () => id,
  getFirstMessageSubject: () => messages[0]?.getSubject() || '',
  getLastMessageDate: () => messages[messages.length - 1]?.getDate() || new Date(),
  getMessages: () => messages,
  getMessageCount: () => messages.length,
  hasStarredMessages: () => messages.some(m => m.isStarred()),
  isImportant: () => false,
  isUnread: () => messages.some(m => m.isUnread()),
  addLabel: jest.fn(),
  removeLabel: jest.fn(),
  moveToArchive: jest.fn(),
  moveToInbox: jest.fn(),
  moveToSpam: jest.fn(),
  moveToTrash: jest.fn(),
  refresh: jest.fn(),
  reply: jest.fn(),
  replyAll: jest.fn(),
});

const createMockMessage = (id, subject, body, from = 'test@example.com') => ({
  getId: () => id,
  getSubject: () => subject,
  getBody: () => body,
  getPlainBody: () => body.replace(/<[^>]*>/g, ''),
  getFrom: () => from,
  getTo: () => 'support@example.com',
  getDate: () => new Date(),
  getThread: () => createMockThread('thread-' + id, []),
  isUnread: () => true,
  isDraft: () => false,
  isInChats: () => false,
  isInInbox: () => true,
  isInPriorityInbox: () => false,
  isInTrash: () => false,
  isStarred: () => false,
  markRead: jest.fn(),
  markUnread: jest.fn(),
  moveToTrash: jest.fn(),
  refresh: jest.fn(),
  reply: jest.fn(),
  replyAll: jest.fn(),
  star: jest.fn(),
  unstar: jest.fn(),
});

const mockLabels = new Map();

global.GmailApp = {
  search: jest.fn((query, start = 0, max = 50) => {
    // Return mock threads based on query
    return [
      createMockThread('thread-1', [
        createMockMessage('msg-1', 'Test Subject', 'Test body content'),
      ]),
    ];
  }),
  getUserLabelByName: jest.fn((name) => {
    if (mockLabels.has(name)) {
      return mockLabels.get(name);
    }
    return null;
  }),
  createLabel: jest.fn((name) => {
    const label = {
      getName: () => name,
      deleteLabel: jest.fn(),
      addToThread: jest.fn(),
      addToThreads: jest.fn(),
      removeFromThread: jest.fn(),
      removeFromThreads: jest.fn(),
    };
    mockLabels.set(name, label);
    return label;
  }),
  sendEmail: jest.fn((to, subject, body, options = {}) => {
    console.log(`[GmailApp] Email sent to: ${to}, Subject: ${subject}`);
  }),
  createDraft: jest.fn((to, subject, body, options = {}) => ({
    getId: () => 'draft-' + Date.now(),
    getMessage: () => createMockMessage('draft-msg', subject, body),
    send: jest.fn(),
    update: jest.fn(),
    deleteDraft: jest.fn(),
  })),
  getDrafts: jest.fn(() => []),
  getInboxThreads: jest.fn((start = 0, max = 50) => []),
  getStarredThreads: jest.fn((start = 0, max = 50) => []),
  getTrashThreads: jest.fn((start = 0, max = 50) => []),
};

// Mock SpreadsheetApp
const createMockSheet = (name) => ({
  getName: () => name,
  getRange: jest.fn((a1Notation) => createMockRange()),
  getDataRange: jest.fn(() => createMockRange()),
  getLastRow: jest.fn(() => 10),
  getLastColumn: jest.fn(() => 5),
  appendRow: jest.fn((values) => {}),
  insertRows: jest.fn((afterPosition, howMany) => {}),
  deleteRows: jest.fn((rowPosition, howMany) => {}),
  clear: jest.fn(),
});

const createMockRange = () => ({
  getValues: jest.fn(() => [['A1', 'B1'], ['A2', 'B2']]),
  setValues: jest.fn((values) => {}),
  getValue: jest.fn(() => 'mock-value'),
  setValue: jest.fn((value) => {}),
  getRow: jest.fn(() => 1),
  getColumn: jest.fn(() => 1),
  getNumRows: jest.fn(() => 2),
  getNumColumns: jest.fn(() => 2),
  clear: jest.fn(),
});

const mockSpreadsheets = new Map();

global.SpreadsheetApp = {
  openById: jest.fn((id) => {
    if (!mockSpreadsheets.has(id)) {
      const sheets = new Map([['Sheet1', createMockSheet('Sheet1')]]);
      mockSpreadsheets.set(id, {
        getId: () => id,
        getName: () => 'Mock Spreadsheet',
        getSheetByName: (name) => sheets.get(name) || null,
        getSheets: () => Array.from(sheets.values()),
        insertSheet: (name) => {
          const sheet = createMockSheet(name);
          sheets.set(name, sheet);
          return sheet;
        },
        deleteSheet: (sheet) => sheets.delete(sheet.getName()),
      });
    }
    return mockSpreadsheets.get(id);
  }),
  create: jest.fn((name) => {
    const id = 'spreadsheet-' + Date.now();
    return SpreadsheetApp.openById(id);
  }),
};

// Mock DriveApp
global.DriveApp = {
  getFolderById: jest.fn((id) => ({
    getId: () => id,
    getName: () => 'Mock Folder',
    createFile: jest.fn((name, content, mimeType) => ({
      getId: () => 'file-' + Date.now(),
      getName: () => name,
      getBlob: () => Utilities.newBlob(content, mimeType, name),
    })),
    getFiles: jest.fn(() => ({
      hasNext: () => false,
      next: () => null,
    })),
  })),
  createFolder: jest.fn((name) => ({
    getId: () => 'folder-' + Date.now(),
    getName: () => name,
  })),
  getFileById: jest.fn((id) => ({
    getId: () => id,
    getName: () => 'Mock File',
    getBlob: () => Utilities.newBlob('mock content', 'text/plain', 'file.txt'),
    setContent: jest.fn(),
  })),
};

// Mock HtmlService
global.HtmlService = {
  createHtmlOutput: jest.fn((html) => ({
    setTitle: jest.fn().mockReturnThis(),
    setWidth: jest.fn().mockReturnThis(),
    setHeight: jest.fn().mockReturnThis(),
    setSandboxMode: jest.fn().mockReturnThis(),
    getContent: () => html,
    append: jest.fn().mockReturnThis(),
    appendUntrusted: jest.fn().mockReturnThis(),
    clear: jest.fn().mockReturnThis(),
  })),
  createTemplateFromFile: jest.fn((filename) => ({
    evaluate: jest.fn(() => HtmlService.createHtmlOutput('<html></html>')),
  })),
  SandboxMode: {
    IFRAME: 'IFRAME',
    NATIVE: 'NATIVE',
    EMULATED: 'EMULATED',
  },
};

// Mock ScriptApp
global.ScriptApp = {
  newTrigger: jest.fn((functionName) => ({
    timeBased: () => ({
      everyMinutes: jest.fn(() => ({ create: jest.fn() })),
      everyHours: jest.fn(() => ({ create: jest.fn() })),
      everyDays: jest.fn(() => ({ create: jest.fn() })),
      atHour: jest.fn().mockReturnThis(),
      onWeekDay: jest.fn().mockReturnThis(),
      create: jest.fn(),
    }),
    forSpreadsheet: jest.fn().mockReturnThis(),
    forForm: jest.fn().mockReturnThis(),
    forDocument: jest.fn().mockReturnThis(),
    onChange: jest.fn().mockReturnThis(),
    onEdit: jest.fn().mockReturnThis(),
    onFormSubmit: jest.fn().mockReturnThis(),
    onOpen: jest.fn().mockReturnThis(),
    create: jest.fn(),
  })),
  getProjectTriggers: jest.fn(() => []),
  deleteTrigger: jest.fn(),
  getService: jest.fn(() => ({
    getUrl: () => 'https://script.google.com/mock-url',
  })),
};

// Mock LockService
global.LockService = {
  getScriptLock: jest.fn(() => ({
    tryLock: jest.fn(() => true),
    waitLock: jest.fn(() => true),
    releaseLock: jest.fn(),
    hasLock: jest.fn(() => true),
  })),
  getUserLock: jest.fn(() => ({
    tryLock: jest.fn(() => true),
    waitLock: jest.fn(() => true),
    releaseLock: jest.fn(),
    hasLock: jest.fn(() => true),
  })),
  getDocumentLock: jest.fn(() => ({
    tryLock: jest.fn(() => true),
    waitLock: jest.fn(() => true),
    releaseLock: jest.fn(),
    hasLock: jest.fn(() => true),
  })),
};

// Export for use in tests
module.exports = {
  mockLabels,
  mockSpreadsheets,
  createMockThread,
  createMockMessage,
  createMockSheet,
  createMockRange,
};