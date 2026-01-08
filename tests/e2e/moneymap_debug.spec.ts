import { test, expect } from '@playwright/test';

test('debug money-map page', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.goto('/money-map', { waitUntil: 'load' });
  
  // Wait for at least some text to appear or timeout
  await page.waitForTimeout(5000);
  
  const content = await page.content();
  console.log('HTML Length:', content.length);
  
  const bodyText = await page.innerText('body');
  console.log('Body Text Start:', bodyText.substring(0, 200));
  
  const h1Count = await page.locator('h1').count();
  console.log('H1 Count:', h1Count);
});
