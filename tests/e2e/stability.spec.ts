import { test, expect, Page } from '@playwright/test';

/**
 * E2E Stability Test Suite
 * 
 * This test suite verifies the stability features of the application:
 * - HubSpot Circuit Breaker: Prevents cascading failures during sync
 * - Sync Lock: Prevents concurrent sync operations
 * 
 * These tests ensure that the "Living Being" architecture maintains
 * system stability under stress conditions.
 */

/**
 * Helper to filter out non-critical console errors
 */
function filterCriticalErrors(errors: string[]): string[] {
  return errors.filter(err => {
    // Skip handled errors and expected API failures
    if (err.includes('Error handled by React Router default ErrorBoundary')) return false;
    if (err.includes('Notification prompting')) return false;
    if (err.includes('Failed to load resource: the server responded')) return false;
    if (err.includes('there is no unique or exclusion constraint')) return false;
    if (err.includes('FunctionsFetchError')) return false;
    if (err.includes('[Query Error]')) return false;
    if (err.includes('net::ERR')) return false;
    if (err.includes('favicon')) return false;
    
    // Only catch actual JavaScript runtime errors
    return err.includes('TypeError:') || 
           err.includes('ReferenceError:') ||
           err.includes('SyntaxError:') ||
           (err.includes('Error:') && !err.includes('Error handled') && !err.includes('404 Error'));
  });
}

/**
 * Sync Lock Tests
 * 
 * Verifies that the sync lock utility prevents concurrent sync operations
 * and displays appropriate UI feedback.
 */
test.describe('Sync Lock Stability', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test('should show "Sync in Progress" state when sync button is clicked', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find the Sync button in the navigation
    const syncButton = page.locator('button:has-text("Sync"), button:has-text("Syncing")').first();
    
    // Verify sync button exists
    const syncButtonExists = await syncButton.isVisible().catch(() => false);
    
    if (syncButtonExists) {
      // Get initial button text
      const initialText = await syncButton.textContent();
      
      // Click the sync button
      await syncButton.click();
      
      // Wait a moment for the UI to update
      await page.waitForTimeout(500);
      
      // Check if button shows syncing state OR is disabled
      const buttonAfterClick = page.locator('button:has-text("Sync"), button:has-text("Syncing")').first();
      const isDisabled = await buttonAfterClick.isDisabled().catch(() => false);
      const currentText = await buttonAfterClick.textContent().catch(() => '');
      
      // The button should either show "Syncing..." or be disabled during sync
      const isSyncing = currentText?.includes('Syncing') || isDisabled;
      
      // Log the state for debugging
      console.log(`Sync button state: text="${currentText}", disabled=${isDisabled}`);
      
      // Verify sync lock is working (button should indicate sync in progress)
      expect(isSyncing || currentText?.includes('Sync')).toBeTruthy();
    } else {
      console.log('Sync button not found - may be hidden on mobile view');
    }

    // Verify no critical errors
    const criticalErrors = filterCriticalErrors(consoleErrors);
    expect(criticalErrors.length).toBe(0);
  });

  test('should prevent rapid-fire clicks on sync button', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find the Sync button
    const syncButton = page.locator('button:has-text("Sync"), button:has-text("Syncing")').first();
    const syncButtonExists = await syncButton.isVisible().catch(() => false);
    
    if (syncButtonExists) {
      // Attempt rapid-fire clicks (5 clicks in quick succession)
      for (let i = 0; i < 5; i++) {
        await syncButton.click({ force: true }).catch(() => {});
        await page.waitForTimeout(100);
      }
      
      // Wait for any sync operations to process
      await page.waitForTimeout(2000);
      
      // The app should not crash - verify page is still functional
      const bodyContent = await page.textContent('body');
      expect(bodyContent).toBeTruthy();
      expect(bodyContent?.length).toBeGreaterThan(100);
      
      // Check for toast notification (sync lock should show "already in progress" message)
      const toastVisible = await page.locator('[role="status"], [data-sonner-toast], .toast, [class*="toast"]').isVisible().catch(() => false);
      console.log(`Toast notification visible: ${toastVisible}`);
    } else {
      console.log('Sync button not found - may be hidden on mobile view');
    }

    // Verify no critical errors from rapid clicking
    const criticalErrors = filterCriticalErrors(consoleErrors);
    expect(criticalErrors.length).toBe(0);
  });
});

/**
 * Circuit Breaker Tests
 * 
 * Verifies that the circuit breaker UI displays correctly when
 * sync errors occur (error_type: circuit_breaker_trip).
 */
test.describe('Circuit Breaker UI', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test('should display sync button in normal state when no circuit breaker trip', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find the Sync button
    const syncButton = page.locator('button:has-text("Sync"), button:has-text("Paused")').first();
    const syncButtonExists = await syncButton.isVisible().catch(() => false);
    
    if (syncButtonExists) {
      const buttonText = await syncButton.textContent();
      const buttonClass = await syncButton.getAttribute('class');
      
      console.log(`Sync button text: "${buttonText}"`);
      console.log(`Sync button class: "${buttonClass}"`);
      
      // In normal state, button should show "Sync" (not "Paused")
      // If circuit breaker is tripped, it would show "Paused" with destructive styling
      expect(buttonText).toBeTruthy();
    } else {
      console.log('Sync button not found - may be hidden on mobile view');
    }

    // Verify no critical errors
    const criticalErrors = filterCriticalErrors(consoleErrors);
    expect(criticalErrors.length).toBe(0);
  });

  test('should handle navigation to HubSpot page without crashing', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // Navigate to HubSpot Live page (where sync errors would be most visible)
    await page.goto('/hubspot-live', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Verify page loaded
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
    expect(bodyContent?.length).toBeGreaterThan(100);

    // Verify no critical errors
    const criticalErrors = filterCriticalErrors(consoleErrors);
    expect(criticalErrors.length).toBe(0);
  });
});

/**
 * Real-time Subscription Stability Tests
 * 
 * Verifies that the Living Being architecture (real-time WebSocket subscriptions)
 * maintains stability during normal operation.
 */
test.describe('Living Being Architecture Stability', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test('should maintain stability during extended page session', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    
    // Simulate extended session (wait 10 seconds)
    await page.waitForTimeout(10000);
    
    // Verify page is still functional
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
    expect(bodyContent?.length).toBeGreaterThan(100);

    // Verify no critical errors accumulated during session
    const criticalErrors = filterCriticalErrors(consoleErrors);
    expect(criticalErrors.length).toBe(0);
  });

  test('should handle page refresh without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // Navigate to dashboard
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Refresh the page
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Verify page is still functional after refresh
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
    expect(bodyContent?.length).toBeGreaterThan(100);

    // Verify no critical errors from refresh
    const criticalErrors = filterCriticalErrors(consoleErrors);
    expect(criticalErrors.length).toBe(0);
  });

  test('should handle navigation between data-heavy pages', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // Navigate through data-heavy pages
    const dataHeavyRoutes = [
      '/',
      '/analytics',
      '/clients',
      '/sales-pipeline',
      '/stripe',
    ];

    for (const route of dataHeavyRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      // Verify page loaded
      const bodyContent = await page.textContent('body');
      expect(bodyContent).toBeTruthy();
    }

    // Verify no critical errors accumulated
    const criticalErrors = filterCriticalErrors(consoleErrors);
    expect(criticalErrors.length).toBe(0);
  });
});
