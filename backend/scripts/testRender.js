const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launchPersistentContext(
    path.resolve('./data/sessions/server_profile_facebook'),
    {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content',
      ]
    }
  );
  
  const page = await browser.newPage();
  await page.goto('https://business.facebook.com/latest/composer?business_id=388442289154361', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  

  const customiseToggle = page.locator("input[aria-label='Customise post for Facebook and Instagram'], [role='switch']:has-text('Customise')").first();
  if (await customiseToggle.isVisible()) {
    await customiseToggle.click({ force: true });
    await page.waitForTimeout(3000);
  }
  
  await page.screenshot({ path: 'test_fb_render.png', fullPage: true });
  console.log('Saved screenshot to test_fb_render.png');
  await browser.close();
})();
