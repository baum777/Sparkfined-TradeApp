import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const screenshotsDir = join(__dirname, '..', 'screenshots');

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:8081...');
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('Looking for Terminal or Trading navigation link...');
    const terminalLink = page.locator('a:has-text("Terminal"), a:has-text("Trading")').first();
    
    if (await terminalLink.count() > 0) {
      console.log('Clicking Terminal/Trading link...');
      await terminalLink.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('No Terminal/Trading link found, checking current URL...');
      const currentUrl = page.url();
      if (!currentUrl.includes('/terminal') && !currentUrl.includes('/trading')) {
        console.log('Trying to navigate directly to /terminal...');
        await page.goto('http://localhost:8081/terminal', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
      }
    }

    console.log('Taking screenshot of main Terminal view...');
    await page.screenshot({ 
      path: join(screenshotsDir, '01-terminal-main.png'),
      fullPage: true 
    });
    console.log('✓ Saved: 01-terminal-main.png');

    console.log('Looking for Discover button...');
    
    // Use direct selector for the Discover button
    const discoverButton = page.locator('button:has-text("Discover")').first();
    
    if (await discoverButton.count() === 0) {
      console.log('Could not find Discover button, taking debug screenshot...');
      await page.screenshot({ 
        path: join(screenshotsDir, 'debug-no-discover-button.png'),
        fullPage: true 
      });
      throw new Error('Could not find Discover button');
    }
    
    console.log('Clicking Discover button...');
    await discoverButton.click();
    
    console.log('Waiting for DiscoverOverlay to open...');
    // Wait for the drawer to be visible and animation to complete
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Take screenshot of overlay opened with first tab (Not Bonded)
    console.log('Taking screenshot: 02-discover-not-bonded.png...');
    await page.screenshot({ 
      path: join(screenshotsDir, '02-discover-not-bonded.png'),
      fullPage: true 
    });
    console.log('✓ Saved: 02-discover-not-bonded.png');

    // Click on "Bonded" tab - use force to bypass pointer event interception
    console.log('Clicking on "Bonded" tab...');
    const bondedTab = page.locator('button:has-text("Bonded")').first();
    await bondedTab.click({ force: true });
    await page.waitForTimeout(1000);
    
    console.log('Taking screenshot: 03-discover-bonded.png...');
    await page.screenshot({ 
      path: join(screenshotsDir, '03-discover-bonded.png'),
      fullPage: true 
    });
    console.log('✓ Saved: 03-discover-bonded.png');

    // Click on "Ranked" tab - use force to bypass pointer event interception
    console.log('Clicking on "Ranked" tab...');
    const rankedTab = page.locator('button:has-text("Ranked")').first();
    await rankedTab.click({ force: true });
    await page.waitForTimeout(1000);
    
    console.log('Taking screenshot: 04-discover-ranked.png...');
    await page.screenshot({ 
      path: join(screenshotsDir, '04-discover-ranked.png'),
      fullPage: true 
    });
    console.log('✓ Saved: 04-discover-ranked.png');

    console.log('\n✅ All screenshots completed successfully!');
    console.log(`Screenshots saved to: ${screenshotsDir}`);

  } catch (error) {
    console.error('Error taking screenshots:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

takeScreenshots().catch(console.error);
