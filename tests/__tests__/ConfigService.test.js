/**
 * ConfigService Test Suite
 * Demonstrates testing Google Apps Script services locally
 */

// Import the service we want to test
const { loadGasFile } = require('../utils/gas-loader');

describe('ConfigService', () => {
  let ConfigService;
  
  beforeAll(() => {
    // Load the ConfigService from the .gs file
    ConfigService = loadGasFile('ConfigService.gs');
  });
  
  beforeEach(() => {
    // Clear all mocked properties before each test
    PropertiesService.getScriptProperties().deleteAllProperties();
  });

  describe('Configuration Management', () => {
    test('should initialize with default configuration', () => {
      const config = ConfigService.Config.get();
      
      expect(config).toBeDefined();
      expect(config.gemini).toBeDefined();
      expect(config.support).toBeDefined();
      expect(config.email).toBeDefined();
    });

    test('should set and retrieve nested configuration values', () => {
      const testValue = 'test-value-' + Date.now();
      
      ConfigService.Config.set('test.nested.value', testValue);
      const retrieved = ConfigService.Config.get('test.nested.value');
      
      expect(retrieved).toBe(testValue);
    });

    test('should merge configuration objects', () => {
      const existingConfig = {
        gemini: { apiKey: 'existing-key' },
        support: { autoReply: true }
      };
      
      ConfigService.Config.setAll(existingConfig);
      
      const updates = {
        gemini: { model: 'gemini-pro' },
        support: { maxReplies: 5 }
      };
      
      ConfigService.Config.merge(updates);
      
      const config = ConfigService.Config.get();
      expect(config.gemini.apiKey).toBe('existing-key');
      expect(config.gemini.model).toBe('gemini-pro');
      expect(config.support.autoReply).toBe(true);
      expect(config.support.maxReplies).toBe(5);
    });
  });

  describe('API Key Validation', () => {
    test('should throw error for missing API key', () => {
      ConfigService.Config.set('gemini.apiKey', '');
      
      expect(() => {
        ConfigService.Config.validateApiKey();
      }).toThrow('Gemini API key not configured');
    });

    test('should throw error for placeholder API key', () => {
      ConfigService.Config.set('gemini.apiKey', 'YOUR_GEMINI_API_KEY_HERE');
      
      expect(() => {
        ConfigService.Config.validateApiKey();
      }).toThrow('Gemini API key not configured');
    });

    test('should return valid API key', () => {
      const validKey = 'AIzaSyC_valid_key_123';
      ConfigService.Config.set('gemini.apiKey', validKey);
      
      const result = ConfigService.Config.validateApiKey();
      expect(result).toBe(validKey);
    });
  });

  describe('Environment Detection', () => {
    test('should detect development environment', () => {
      ConfigService.Config.set('environment', 'development');
      
      expect(ConfigService.Config.isDevelopment()).toBe(true);
      expect(ConfigService.Config.isProduction()).toBe(false);
    });

    test('should detect production environment', () => {
      ConfigService.Config.set('environment', 'production');
      
      expect(ConfigService.Config.isDevelopment()).toBe(false);
      expect(ConfigService.Config.isProduction()).toBe(true);
    });
  });

  describe('Business Hours', () => {
    test('should check if current time is within business hours', () => {
      const businessHours = {
        start: 9,
        end: 17,
        days: [1, 2, 3, 4, 5] // Monday to Friday
      };
      
      ConfigService.Config.set('support.businessHours', businessHours);
      
      // Mock a Wednesday at 2 PM
      const mockDate = new Date('2024-01-10T14:00:00');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
      expect(ConfigService.Config.isBusinessHours()).toBe(true);
      
      // Mock a Saturday
      const weekendDate = new Date('2024-01-13T14:00:00');
      jest.spyOn(global, 'Date').mockImplementation(() => weekendDate);
      
      expect(ConfigService.Config.isBusinessHours()).toBe(false);
      
      global.Date.mockRestore();
    });
  });
});