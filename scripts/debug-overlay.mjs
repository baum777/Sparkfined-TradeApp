import { chromium } from 'playwright';

async function debugOverlay() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:8081...');
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('Looking for Terminal link...');
    const terminalLink = page.locator('a:has-text("Terminal"), a:has-text("Trading")').first();
    
    if (await terminalLink.count() > 0) {
      await terminalLink.click();
      await page.waitForTimeout(2000);
    }

    console.log('Looking for Discover button...');
    const discoverButton = page.locator('button:has(svg)').first();
    
    if (await discoverButton.count() > 0) {
      await discoverButton.click();
      await page.waitForTimeout(2000);
      
      console.log('\n=== Page HTML Structure ===');
      const bodyHTML = await page.locator('body').innerHTML();
      console.log(bodyHTML.substring(0, 5000));
      
      console.log('\n=== Looking for elements with "Not Bonded" text ===');
      const notBondedElements = await page.locator('text="Not Bonded"').all();
      console.log(`Found ${notBondedElements.length} elements with "Not Bonded" text`);
      
      console.log('\n=== Looking for elements with "Bonded" text ===');
      const bondedElements = await page.locator('text="Bonded"').all();
      console.log(`Found ${bondedElements.length} elements with "Bonded" text`);
      
      console.log('\n=== Looking for elements with "Ranked" text ===');
      const rankedElements = await page.locator('text="Ranked"').all();
      console.log(`Found ${rankedElements.length} elements with "Ranked" text`);
      
      console.log('\n=== All buttons on page ===');
      const allButtons = await page.locator('button').all();
      console.log(`Found ${allButtons.length} buttons`);
      for (let i = 0; i < Math.min(allButtons.length, 20); i++) {
        const text = await allButtons[i].textContent();
        console.log(`Button ${i}: "${text}"`);
      }
    }

    console.log('\nKeeping browser open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugOverlay().catch(console.error);
