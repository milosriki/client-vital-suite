import { test, expect } from '@playwright/test';

test('verify money-map page loads and displays content', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.goto('/money-map', { waitUntil: 'networkidle' });
  
  const title = await page.textContent('h1');
  console.log('Page Title:', title);
  
  const body = await page.textContent('body');
  const hasErrorText = body?.includes('Error') || body?.includes('Something went wrong');
  
  console.log('Console Errors:', consoleErrors);
  
  expect(title).toContain('Campaign Money Map');
  expect(hasErrorText).toBeFalsy();
  expect(consoleErrors.length).toBe(0);
});
