/**
 * SafetyConfig Test Suite
 * Tests the critical safety configuration
 */

describe('SafetyConfig', () => {
  beforeEach(() => {
    // Clear properties before each test
    PropertiesService.getScriptProperties().deleteAllProperties();
  });

  test('should default to DRAFT_MODE = true for safety', () => {
    const { loadGasFile } = require('../utils/gas-loader');
    const context = loadGasFile('SafetyConfig.gs');
    
    expect(context.DRAFT_MODE).toBe(true);
    expect(context.SAFETY_CONFIG.draftMode).toBe(true);
  });

  test('should start in test mode with whitelisted emails', () => {
    const { loadGasFile } = require('../utils/gas-loader');
    const context = loadGasFile('SafetyConfig.gs');
    
    expect(context.SAFETY_CONFIG.testMode).toBe(true);
    expect(context.SAFETY_CONFIG.testEmailAddresses).toContain('team@fullstackoptimization.com');
  });

  test('isDraftMode should return true by default', () => {
    const { loadGasFile } = require('../utils/gas-loader');
    const context = loadGasFile('SafetyConfig.gs');
    
    const result = context.isDraftMode();
    expect(result).toBe(true);
  });

  test('should not process emails outside whitelist in test mode', () => {
    const { loadGasFile } = require('../utils/gas-loader');
    const context = loadGasFile('SafetyConfig.gs');
    
    const shouldProcess = context.shouldProcessEmail('random@example.com');
    expect(shouldProcess).toBe(false);
    
    const shouldProcessTeam = context.shouldProcessEmail('team@fullstackoptimization.com');
    expect(shouldProcessTeam).toBe(true);
  });

  test('emergency stop should halt all processing', () => {
    const { loadGasFile } = require('../utils/gas-loader');
    const context = loadGasFile('SafetyConfig.gs');
    
    // Set emergency stop
    context.SAFETY_CONFIG.emergencyStop = true;
    
    const shouldProcess = context.shouldProcessEmail('team@fullstackoptimization.com');
    expect(shouldProcess).toBe(false);
  });
});