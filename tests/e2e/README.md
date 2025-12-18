# E2E Test Suite

This directory contains end-to-end tests using Playwright to verify application stability after repository merges.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### Run all tests:
```bash
npm run test:e2e
```

### Run tests in UI mode (interactive):
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser):
```bash
npm run test:e2e:headed
```

### Run specific test file:
```bash
npx playwright test tests/e2e/navigation.spec.ts
```

## Test Coverage

The `navigation.spec.ts` test suite covers:

1. **All 26 Routes**: Systematically tests each route to ensure:
   - Page renders with status 200 (or 404 for NotFound route)
   - No critical console errors
   - Page content loads successfully
   - Page does not crash

2. **Dashboard Quick Actions**: Specifically verifies that Quick Action buttons exist:
   - Sync HubSpot
   - Run BI Agent
   - Generate Interventions
   - View Clients
   - Call Tracking
   - AI Control

3. **Application Stability**: Tests rapid navigation between routes to ensure no memory leaks or error accumulation.

## Routes Tested

- `/` - Dashboard (root)
- `/dashboard` - Dashboard (alias)
- `/operations` - Operations Center
- `/sales-pipeline` - Sales Pipeline
- `/stripe` - Stripe Intelligence
- `/call-tracking` - Call Tracking
- `/audit-trail` - Audit Trail
- `/war-room` - CEO War Room
- `/ai-knowledge` - AI Knowledge Base
- `/ai-learning` - AI Learning Dashboard
- `/overview` - Overview
- `/clients` - Clients List
- `/coaches` - Coaches
- `/interventions` - Interventions
- `/analytics` - Analytics
- `/meta-dashboard` - Meta Dashboard
- `/ptd-control` - PTD Control
- `/hubspot-analyzer` - HubSpot Analyzer
- `/sales-coach-tracker` - Sales Coach Tracker
- `/setter-activity-today` - Setter Activity Today
- `/yesterday-bookings` - Yesterday Bookings
- `/hubspot-live` - HubSpot Live Data
- `/ultimate-ceo` - Ultimate CEO
- `/marketing-stress-test` - Marketing Stress Test
- `/ai-dev` - AI Dev Console
- `/nonexistent-route-12345` - NotFound (404)

## Configuration

The test suite uses `playwright.config.ts` in the project root. Key settings:

- **Base URL**: `http://localhost:8080` (configurable via `PLAYWRIGHT_BASE_URL` env var)
- **Browsers**: Chromium, Firefox, WebKit
- **Auto-start dev server**: Tests automatically start the dev server if not running
- **Timeout**: 60 seconds per test
- **Retries**: 2 retries on CI, 0 locally

## Environment Variables

- `PLAYWRIGHT_BASE_URL`: Override the base URL (default: `http://localhost:8080`)
- `CI`: Set to `true` in CI environments for different retry/timeout behavior

## Troubleshooting

### Tests fail with "Navigation timeout"
- Ensure the dev server is running on port 8080
- Check that the application builds successfully
- Increase timeout in `playwright.config.ts` if needed

### Tests fail with console errors
- Some routes may have expected API errors in test environment
- Critical JavaScript errors (TypeError, ReferenceError, etc.) will fail tests
- Check browser console in headed mode for details

### Quick Action buttons not found
- Buttons may be conditionally rendered based on data/state
- Check if buttons are in different components (QuickActionsPanel, QuickActions, LiveQuickActions)
- Run in headed mode to visually inspect the page

## CI/CD Integration

To run tests in CI:

```bash
# Install dependencies
npm ci

# Install Playwright browsers
npx playwright install --with-deps

# Run tests
npm run test:e2e
```

The test suite is configured to:
- Run in parallel (1 worker on CI)
- Retry failed tests twice
- Generate HTML reports
- Capture screenshots on failure

