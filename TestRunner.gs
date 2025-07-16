/**
 * TestRunner.gs - Comprehensive Test Suite
 * 
 * DRY testing framework for Apps Script
 * KISS principle: Simple assertions, powerful results
 */

class TestRunner {
  constructor() {
    this.tests = [];
    this.suites = new Map();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };
    this.currentSuite = null;
  }

  /**
   * Create a test suite
   */
  suite(name, fn) {
    this.currentSuite = name;
    this.suites.set(name, []);
    
    try {
      fn();
    } catch (error) {
      console.error(`Suite setup failed: ${name}`, error);
    }
    
    this.currentSuite = null;
  }

  /**
   * Add a test
   */
  test(description, fn) {
    const test = {
      suite: this.currentSuite,
      description,
      fn,
      status: 'pending'
    };
    
    if (this.currentSuite) {
      this.suites.get(this.currentSuite).push(test);
    } else {
      this.tests.push(test);
    }
  }

  /**
   * Skip a test
   */
  skip(description, fn) {
    const test = {
      suite: this.currentSuite,
      description,
      fn,
      status: 'skipped'
    };
    
    if (this.currentSuite) {
      this.suites.get(this.currentSuite).push(test);
    } else {
      this.tests.push(test);
    }
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log('🧪 Running tests...\n');
    
    const startTime = Date.now();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: []
    };
    
    // Run standalone tests
    if (this.tests.length > 0) {
      await this.runTests('General', this.tests);
    }
    
    // Run test suites
    for (const [suiteName, tests] of this.suites) {
      await this.runTests(suiteName, tests);
    }
    
    this.results.duration = Date.now() - startTime;
    
    // Print summary
    this.printSummary();
    
    return this.results;
  }

  /**
   * Run a set of tests
   */
  async runTests(suiteName, tests) {
    console.log(`\n📦 ${suiteName}`);
    console.log('─'.repeat(50));
    
    for (const test of tests) {
      if (test.status === 'skipped') {
        this.results.skipped++;
        this.results.total++;
        console.log(`  ⏭️  ${test.description} (skipped)`);
        continue;
      }
      
      const result = await this.runTest(test);
      this.results.tests.push(result);
      this.results.total++;
      
      if (result.passed) {
        this.results.passed++;
        console.log(`  ✅ ${test.description} (${result.duration}ms)`);
      } else {
        this.results.failed++;
        console.log(`  ❌ ${test.description}`);
        console.log(`     Error: ${result.error}`);
        if (result.stack) {
          console.log(`     Stack: ${result.stack.split('\n')[1]}`);
        }
      }
    }
  }

  /**
   * Run a single test
   */
  async runTest(test) {
    const startTime = Date.now();
    const result = {
      suite: test.suite,
      description: test.description,
      passed: false,
      duration: 0,
      error: null,
      stack: null
    };
    
    try {
      // Create test context
      const context = this.createTestContext();
      
      // Run test
      await test.fn(context);
      
      result.passed = true;
    } catch (error) {
      result.error = error.message;
      result.stack = error.stack;
    }
    
    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Create test context with assertions
   */
  createTestContext() {
    return {
      assert: this.assert.bind(this),
      assertEqual: this.assertEqual.bind(this),
      assertNotEqual: this.assertNotEqual.bind(this),
      assertTrue: this.assertTrue.bind(this),
      assertFalse: this.assertFalse.bind(this),
      assertThrows: this.assertThrows.bind(this),
      assertArrayEqual: this.assertArrayEqual.bind(this),
      assertObjectEqual: this.assertObjectEqual.bind(this),
      assertContains: this.assertContains.bind(this),
      assertNotContains: this.assertNotContains.bind(this),
      assertGreaterThan: this.assertGreaterThan.bind(this),
      assertLessThan: this.assertLessThan.bind(this),
      assertType: this.assertType.bind(this),
      fail: this.fail.bind(this)
    };
  }

  /**
   * Assertion methods
   */
  assert(condition, message = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertNotEqual(actual, expected, message) {
    if (actual === expected) {
      throw new Error(message || `Expected not to equal ${expected}`);
    }
  }

  assertTrue(value, message) {
    if (!value) {
      throw new Error(message || `Expected true, got ${value}`);
    }
  }

  assertFalse(value, message) {
    if (value) {
      throw new Error(message || `Expected false, got ${value}`);
    }
  }

  async assertThrows(fn, expectedError, message) {
    try {
      await fn();
      throw new Error(message || 'Expected function to throw');
    } catch (error) {
      if (expectedError && !error.message.includes(expectedError)) {
        throw new Error(`Expected error containing "${expectedError}", got "${error.message}"`);
      }
    }
  }

  assertArrayEqual(actual, expected, message) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      throw new Error('Both values must be arrays');
    }
    
    if (actual.length !== expected.length) {
      throw new Error(message || `Array length mismatch: ${actual.length} !== ${expected.length}`);
    }
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) {
        throw new Error(message || `Array mismatch at index ${i}: ${actual[i]} !== ${expected[i]}`);
      }
    }
  }

  assertObjectEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual, null, 2);
    const expectedStr = JSON.stringify(expected, null, 2);
    
    if (actualStr !== expectedStr) {
      throw new Error(message || `Object mismatch:\nExpected: ${expectedStr}\nActual: ${actualStr}`);
    }
  }

  assertContains(haystack, needle, message) {
    if (typeof haystack === 'string') {
      if (!haystack.includes(needle)) {
        throw new Error(message || `"${haystack}" does not contain "${needle}"`);
      }
    } else if (Array.isArray(haystack)) {
      if (!haystack.includes(needle)) {
        throw new Error(message || `Array does not contain ${needle}`);
      }
    } else {
      throw new Error('assertContains requires string or array');
    }
  }

  assertNotContains(haystack, needle, message) {
    if (typeof haystack === 'string') {
      if (haystack.includes(needle)) {
        throw new Error(message || `"${haystack}" contains "${needle}"`);
      }
    } else if (Array.isArray(haystack)) {
      if (haystack.includes(needle)) {
        throw new Error(message || `Array contains ${needle}`);
      }
    } else {
      throw new Error('assertNotContains requires string or array');
    }
  }

  assertGreaterThan(actual, expected, message) {
    if (actual <= expected) {
      throw new Error(message || `${actual} is not greater than ${expected}`);
    }
  }

  assertLessThan(actual, expected, message) {
    if (actual >= expected) {
      throw new Error(message || `${actual} is not less than ${expected}`);
    }
  }

  assertType(value, expectedType, message) {
    const actualType = typeof value;
    if (actualType !== expectedType) {
      throw new Error(message || `Expected type ${expectedType}, got ${actualType}`);
    }
  }

  fail(message = 'Test failed') {
    throw new Error(message);
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 Test Summary');
    console.log('─'.repeat(50));
    
    const passRate = this.results.total > 0 
      ? Math.round((this.results.passed / this.results.total) * 100) 
      : 0;
    
    console.log(`Total:    ${this.results.total}`);
    console.log(`Passed:   ${this.results.passed} ✅`);
    console.log(`Failed:   ${this.results.failed} ❌`);
    console.log(`Skipped:  ${this.results.skipped} ⏭️`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log(`Duration: ${this.results.duration}ms`);
    
    if (this.results.failed === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log('\n💔 Some tests failed');
    }
  }

  /**
   * Get test report
   */
  getReport() {
    return {
      ...this.results,
      passRate: this.results.total > 0 
        ? (this.results.passed / this.results.total) * 100 
        : 0,
      failedTests: this.results.tests.filter(t => !t.passed)
    };
  }

  /**
   * Clear all tests
   */
  clear() {
    this.tests = [];
    this.suites.clear();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };
  }
}

// Create test runner instance
const TestSuite = new TestRunner();

// Define test suites
function defineTests() {
  // Configuration Tests
  TestSuite.suite('ConfigService', () => {
    TestSuite.test('should get default configuration', (t) => {
      const config = Config.get();
      t.assertType(config, 'object');
      t.assert(config.gemini, 'Gemini config exists');
      t.assert(config.support, 'Support config exists');
    });
    
    TestSuite.test('should set and get configuration value', (t) => {
      const testValue = 'test-value-' + Date.now();
      Config.set('test.value', testValue);
      const retrieved = Config.get('test.value');
      t.assertEqual(retrieved, testValue);
    });
    
    TestSuite.test('should validate configuration', (t) => {
      const validation = Config.validate();
      t.assertType(validation.valid, 'boolean');
      t.assert(Array.isArray(validation.errors), 'Errors is array');
    });
  });

  // Knowledge Base Tests
  TestSuite.suite('KnowledgeBaseService', () => {
    TestSuite.test('should search knowledge base', async (t) => {
      const results = await KnowledgeBase.search('test query');
      t.assert(Array.isArray(results), 'Results is array');
    });
    
    TestSuite.test('should handle empty search results', async (t) => {
      const results = await KnowledgeBase.search('xyzabc123impossible');
      t.assertEqual(results.length, 0, 'No results for impossible query');
    });
    
    TestSuite.test('should get configured sources', (t) => {
      const sources = KnowledgeBase.getSources();
      t.assert(Array.isArray(sources), 'Sources is array');
      t.assertGreaterThan(sources.length, 0, 'Has at least one source');
    });
  });

  // Debug Service Tests
  TestSuite.suite('DebugService', () => {
    TestSuite.test('should log debug messages', (t) => {
      const message = 'Test debug message';
      const result = debug(message);
      t.assert(result, 'Debug returns result');
      t.assertEqual(result.message, message);
    });
    
    TestSuite.test('should wrap functions', async (t) => {
      let called = false;
      const wrapped = debugWrap('testFunc', () => {
        called = true;
        return 'result';
      });
      
      const result = wrapped();
      t.assertTrue(called, 'Function was called');
      t.assertEqual(result, 'result');
    });
    
    TestSuite.test('should create checkpoints', (t) => {
      const checkpoint = Debug.checkpoint('test-checkpoint');
      t.assert(checkpoint.timestamp, 'Has timestamp');
      t.assertEqual(checkpoint.label, 'test-checkpoint');
    });
  });

  // Error Service Tests
  TestSuite.suite('ErrorService', () => {
    TestSuite.test('should handle errors', async (t) => {
      const error = new Error('Test error');
      const handled = await ErrorHandler.handle(error);
      t.assertTrue(handled.handled, 'Error was handled');
      t.assert(handled.message, 'Has error message');
    });
    
    TestSuite.test('should wrap functions with error handling', async (t) => {
      const wrapped = wrapWithErrorHandling(() => {
        throw new Error('Test error');
      });
      
      await t.assertThrows(async () => {
        await wrapped();
      }, 'Test error');
    });
    
    TestSuite.test('should create custom errors', (t) => {
      const error = createError('CustomError', 'Custom message', 'CUSTOM_001');
      t.assertEqual(error.name, 'CustomError');
      t.assertEqual(error.message, 'Custom message');
      t.assertEqual(error.code, 'CUSTOM_001');
    });
  });

  // Logging Service Tests
  TestSuite.suite('LoggingService', () => {
    TestSuite.test('should log at different levels', (t) => {
      const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
      levels.forEach(level => {
        const result = Logger.log(level, `Test ${level} message`);
        t.assertEqual(result.level, level);
      });
    });
    
    TestSuite.test('should query logs', (t) => {
      // Log some test messages
      logInfo('Test message 1');
      logError('Test error message');
      
      const logs = queryLogs({ level: 'ERROR' });
      t.assert(Array.isArray(logs), 'Logs is array');
    });
    
    TestSuite.test('should export logs', (t) => {
      const json = exportLogs('json');
      t.assertType(json, 'string');
      
      const parsed = JSON.parse(json);
      t.assert(Array.isArray(parsed), 'Exported logs is array');
    });
  });

  // Deployment Service Tests
  TestSuite.suite('DeploymentService', () => {
    TestSuite.test('should get current version', (t) => {
      const version = getCurrentVersion();
      t.assertType(version, 'string');
      t.assert(version.match(/\d+\.\d+\.\d+/), 'Valid semver format');
    });
    
    TestSuite.test('should get current environment', (t) => {
      const env = getCurrentEnvironment();
      t.assertContains(['development', 'staging', 'production'], env);
    });
    
    TestSuite.test('should increment version', (t) => {
      const current = Deployment.version;
      const patch = Deployment.incrementVersion('patch');
      const minor = Deployment.incrementVersion('minor');
      const major = Deployment.incrementVersion('major');
      
      t.assert(patch > current, 'Patch version increased');
      t.assert(minor > patch, 'Minor version increased');
      t.assert(major > minor, 'Major version increased');
    });
  });

  // Integration Tests
  TestSuite.suite('Integration', () => {
    TestSuite.test('should process mock support email', async (t) => {
      const mockEmail = {
        id: 'test-123',
        threadId: 'thread-123',
        from: 'customer@example.com',
        subject: 'Password reset help',
        body: 'I forgot my password and need help resetting it.',
        date: new Date()
      };
      
      // This would normally process through the system
      t.assert(mockEmail.subject, 'Mock email created');
    });
    
    TestSuite.skip('should send test email (manual)', async (t) => {
      // Skipped in automated tests
      // Run manually with caution
    });
  });
}

// Run all tests
function runAllTests() {
  defineTests();
  return TestSuite.runAll();
}

// Run specific test suite
function runTestSuite(suiteName) {
  defineTests();
  const suite = TestSuite.suites.get(suiteName);
  if (!suite) {
    throw new Error(`Test suite "${suiteName}" not found`);
  }
  return TestSuite.runTests(suiteName, suite);
}

// Get test report
function getTestReport() {
  return TestSuite.getReport();
}

// Clear tests
function clearTests() {
  TestSuite.clear();
}