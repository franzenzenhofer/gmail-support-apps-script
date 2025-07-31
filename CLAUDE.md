# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gmail Support System - A comprehensive AI-powered customer support automation system built entirely in Google Apps Script. It processes support emails, generates AI responses using Google Gemini, manages tickets, and includes enterprise features like SLA tracking, escalation, and metrics.

## Key Commands

### Development & Testing
- `npm run push` - Deploy code to Google Apps Script
- `npm run push:watch` - Watch for changes and auto-deploy
- `npm run test` - Run comprehensive test suite via `runComprehensiveTests()`
- `npm run logs` - View Apps Script execution logs
- `npm run logs:watch` - Watch logs in real-time
- `npm run open` - Open the Apps Script project in browser

### Deployment
- `npm run deploy:prod` - Push and deploy to production
- Run `installGmailSupport()` function in Apps Script editor for initial setup
- Run `deployGmailSupport()` for quick deployment

### Testing Individual Components
- `TestSuite.run('ConfigService')` - Test specific service
- `runAllTests()` - Run entire test suite
- `runComprehensiveTests()` - Production validation tests

## Architecture Overview

### Service Architecture Pattern
All services follow a consistent class-based pattern with singleton instances:

```javascript
class ServiceName {
  constructor() {
    this.cache = new Map();
    this.initializeDefaults();
  }
  
  // Service methods...
}

const ServiceInstance = new ServiceName();
```

### Core Services
- **ConfigService** - Configuration management with nested property support
- **TicketService** - Ticket lifecycle management with atomic ID generation
- **AIService** - Gemini AI integration for response generation
- **EmailService** - Gmail API wrapper with thread management
- **MetricsService** - Performance tracking and SLA monitoring
- **EscalationService** - Smart escalation rules and routing
- **SafetyService** - Production safety utilities (rate limiting, timeouts)
- **ErrorService** - Comprehensive error handling and recovery

### Key Patterns

1. **Error Handling**: All services use ErrorHandler for consistent error management
2. **Caching**: In-memory caching with TTL support to optimize API calls
3. **Rate Limiting**: Built-in rate limiting to respect Google API quotas
4. **Execution Time Safety**: 5.5-minute timeout protection for Apps Script limits
5. **Atomic Operations**: Thread-safe ticket ID generation with sharding
6. **Transaction Support**: Multi-step operations with rollback capability

### Storage Strategy
- **Script Properties**: API keys, configuration
- **User Properties**: User-specific settings
- **Cache Service**: Temporary data with TTL
- **Google Drive**: Knowledge base, backups, large data
- **Gmail Labels**: Email organization and workflow

## Critical Production Considerations

1. **API Key Management**: Never hardcode keys. Use Script Properties or installer
2. **Script Execution Limits**: 6-minute hard limit, code uses 5.5-minute safety
3. **Storage Limits**: Properties service has 500KB limit per property
4. **Rate Limits**: Respect Gmail API quotas (250 quota units/user/second)
5. **Memory Management**: Automatic cleanup for long-running processes

## Testing Strategy

The project uses a custom TestRunner framework:
- Unit tests for all services
- Integration tests for workflows
- Performance benchmarks
- Error scenario testing
- Production validation suite

## Entry Points

- **processEmails()** - Main email processing trigger (run every 5 minutes)
- **doGet()** - Web app dashboard endpoint
- **updateMetrics()** - Metrics calculation (hourly)
- **cleanupOldTickets()** - Data cleanup (daily)
- **generateReports()** - Report generation (daily/weekly)

## Bug Fixes Applied

The codebase includes 67 documented bug fixes for production stability:
- Thread-safe operations
- Memory leak prevention
- Rate limit compliance
- Error recovery mechanisms
- Data validation
- Security hardening

See `BUG_FIXES_TODO.md` and `UltimateBugFixes.gs` for complete list.

## Development Workflow

1. Make changes locally
2. Run `npm run push` to deploy to Apps Script
3. Test using Apps Script editor or `npm run test`
4. Check logs with `npm run logs`
5. Deploy to production with `npm run deploy:prod`

## Google Apps Script Specifics

- **Manifest**: `appsscript.json` defines permissions and advanced services
- **Triggers**: Set up time-based triggers for `processEmails` (5 min), `updateMetrics` (hourly)
- **Web App**: Deploy as web app for dashboard access
- **Gmail API**: Advanced service enabled for full email control
- **Execution Order**: Code.gs loads first, then alphabetical order