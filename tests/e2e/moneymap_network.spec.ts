import { test, expect } from '@playwright/test';

test('debug money-map network requests', async ({ page }) => {
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
  });
  
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('HTTP ERROR:', response.status(), response.url());
    }
  });

  await page.goto('/money-map', { waitUntil: 'networkidle' });
  
  const content = await page.textContent('body');
  console.log('Page loaded, content length:', content?.length);
});
