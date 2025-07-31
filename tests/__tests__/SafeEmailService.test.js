/**
 * SafeEmailService Test Suite
 * Tests email safety mechanisms
 */

describe('SafeEmailService', () => {
  let SafeEmail;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    PropertiesService.getScriptProperties().deleteAllProperties();
  });

  test('should create drafts instead of sending emails in DRAFT_MODE', () => {
    const { loadGasFile } = require('../utils/gas-loader');
    
    // Load dependencies
    loadGasFile('SafetyConfig.gs');
    const emailContext = loadGasFile('EmailService.gs');
    const safeContext = loadGasFile('SafeEmailService.gs');
    
    // Mock createDraft
    const mockDraft = { id: 'draft-123' };
    emailContext.Email.createDraft = jest.fn().mockReturnValue(mockDraft);
    
    // Send email
    const result = safeContext.sendSafeEmail(
      'test@example.com',
      'Test Subject',
      'Test Body'
    );
    
    // Should create draft, not send
    expect(result.status).toBe('draft');
    expect(result.draftMode).toBe(true);
    expect(emailContext.Email.createDraft).toHaveBeenCalled();
  });

  test('should add safety warnings to draft emails', () => {
    const { loadGasFile } = require('../utils/gas-loader');
    
    loadGasFile('SafetyConfig.gs');
    const emailContext = loadGasFile('EmailService.gs');
    const safeContext = loadGasFile('SafeEmailService.gs');
    
    let capturedBody;
    emailContext.Email.createDraft = jest.fn((to, subject, body) => {
      capturedBody = body;
      return { id: 'draft-123' };
    });
    
    safeContext.sendSafeEmail('test@example.com', 'Test', 'Original body');
    
    expect(capturedBody).toContain('THIS IS A DRAFT');
    expect(capturedBody).toContain('Original body');
  });

  test('should respect test mode email filtering', () => {
    const { loadGasFile } = require('../utils/gas-loader');
    
    const safetyContext = loadGasFile('SafetyConfig.gs');
    loadGasFile('EmailService.gs');
    const safeContext = loadGasFile('SafeEmailService.gs');
    
    // Ensure test mode is on
    safetyContext.SAFETY_CONFIG.testMode = true;
    
    // Try to send to non-whitelisted email
    const result = safeContext.sendSafeEmail(
      'not-whitelisted@example.com',
      'Test',
      'Body'
    );
    
    expect(result).toBeNull();
  });

  test('should log all email operations in verbose mode', () => {
    const { loadGasFile } = require('../utils/gas-loader');
    
    loadGasFile('SafetyConfig.gs');
    loadGasFile('EmailService.gs');
    const safeContext = loadGasFile('SafeEmailService.gs');
    
    const consoleSpy = jest.spyOn(console, 'log');
    
    safeContext.sendSafeEmail('team@fullstackoptimization.com', 'Test', 'Body');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[DRAFT MODE]')
    );
  });
});