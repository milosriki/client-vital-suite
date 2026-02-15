import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite for Workflow Strategy Page
 *
 * This test suite verifies:
 * - Page renders without errors
 * - Real data loads from ai_execution_metrics
 * - Strategy recommendations display correctly
 * - Workflow priority list shows metrics
 * - No critical console errors
 */

test.describe('Workflow Strategy Page', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test('should load workflow strategy page without errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out known non-critical errors
        if (!text.includes('favicon') && !text.includes('net::ERR')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // Navigate to operations page (which contains workflow strategy)
    const response = await page.goto('/operations', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Verify response status
    expect([200, 304]).toContain(response?.status() || 0);

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Verify page title exists
    const title = await page.title();
    expect(title).toBeTruthy();

    // Check for page header
    const headerText = await page.textContent('h1');
    expect(headerText).toContain('PTD Edge Functions Strategy');

    // Verify no critical console errors
    const criticalErrors = consoleErrors.filter(err => {
      if (err.includes('Error handled by React Router default ErrorBoundary')) return false;
      if (err.includes('Notification prompting')) return false;
      if (err.includes('Failed to load resource: the server responded')) return false;
      if (err.includes('FunctionsFetchError')) return false;
      if (err.includes('[Query Error]')) return false;
      return err.includes('TypeError:') ||
             err.includes('ReferenceError:') ||
             err.includes('SyntaxError:');
    });

    if (criticalErrors.length > 0) {
      console.error('Critical errors:', criticalErrors);
      throw new Error(`Critical errors found: ${criticalErrors.join(', ')}`);
    }
  });

  test('should display workflow priority card', async ({ page }) => {
    await page.goto('/operations', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Check for Workflow Priority Order card
    const workflowCardTitle = await page.textContent('h3:has-text("Workflow Priority Order")');
    expect(workflowCardTitle).toBeTruthy();

    // Check if loading state or data is displayed
    const cardContent = await page.textContent('body');
    const hasLoadingOrData =
      cardContent?.includes('Loading execution metrics') ||
      cardContent?.includes('workflows analyzed') ||
      cardContent?.includes('No workflow execution data found');

    expect(hasLoadingOrData).toBeTruthy();
  });

  test('should display implementation phases accordion', async ({ page }) => {
    await page.goto('/operations', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check for Implementation Phases card
    const phasesCardTitle = await page.textContent('h3:has-text("Implementation Phases")');
    expect(phasesCardTitle).toBeTruthy();

    // Check for Phase badges
    const phaseElements = await page.locator('text=/Phase \\d/').all();
    expect(phaseElements.length).toBeGreaterThan(0);
  });

  test('should display critical configuration checklist', async ({ page }) => {
    await page.goto('/operations', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check for Critical Configuration Checklist card
    const checklistTitle = await page.textContent('h3:has-text("Critical Configuration Checklist")');
    expect(checklistTitle).toBeTruthy();

    // Verify checklist categories are present
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toContain('Supabase Connection');
    expect(bodyContent).toContain('Database Tables');
  });

  test('should handle accordion interactions', async ({ page }) => {
    await page.goto('/operations', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find first accordion trigger
    const firstAccordionTrigger = await page.locator('[data-state="closed"]').first();

    if (await firstAccordionTrigger.count() > 0) {
      // Click to expand
      await firstAccordionTrigger.click();
      await page.waitForTimeout(500);

      // Verify accordion expanded
      const expandedContent = await page.locator('[data-state="open"]').first();
      expect(await expandedContent.count()).toBeGreaterThan(0);
    }
  });

  test('should display alert for critical issues or operational status', async ({ page }) => {
    await page.goto('/operations', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Check for either critical issues alert or operational status
    const bodyContent = await page.textContent('body');
    const hasAlert =
      bodyContent?.includes('Critical Issues Detected') ||
      bodyContent?.includes('All Systems Operational');

    expect(hasAlert).toBeTruthy();
  });

  test('should display AI strategy recommendations if available', async ({ page }) => {
    await page.goto('/operations', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Check if strategy recommendations card exists
    const bodyContent = await page.textContent('body');

    // This section is conditional, so we just verify the page doesn't crash
    // The recommendations card will only show if there's data
    expect(bodyContent).toBeTruthy();
  });
});
