import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function auditTradingTerminal() {
  console.log('Starting Trading Terminal audit...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const screenshotsDir = join(__dirname, '..', 'screenshots');
  const auditResults = {
    components: [],
    issues: [],
    screenshots: []
  };

  try {
    // Try /terminal first
    console.log('Navigating to http://localhost:8080/terminal...');
    let response;
    let currentUrl;
    
    try {
      response = await page.goto('http://localhost:8080/terminal', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      currentUrl = '/terminal';
      console.log(`Response status: ${response.status()}`);
    } catch (error) {
      console.log(`Failed to load /terminal: ${error.message}`);
      
      // Try /trading
      console.log('Trying http://localhost:8080/trading...');
      try {
        response = await page.goto('http://localhost:8080/trading', { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        currentUrl = '/trading';
        console.log(`Response status: ${response.status()}`);
      } catch (error2) {
        console.log(`Failed to load /trading: ${error2.message}`);
        
        // Try root
        console.log('Trying http://localhost:8080/...');
        response = await page.goto('http://localhost:8080/', { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        currentUrl = '/';
        console.log(`Response status: ${response.status()}`);
      }
    }

    console.log(`Page loaded successfully from ${currentUrl}`);
    
    // Wait for main content to load
    await page.waitForTimeout(2000);

    // 1. Main Trading Terminal view
    console.log('Capturing main trading terminal view...');
    const mainScreenshot = join(screenshotsDir, 'trading-terminal-main.png');
    await page.screenshot({ path: mainScreenshot, fullPage: true });
    auditResults.screenshots.push('trading-terminal-main.png');
    console.log('✓ Main view captured');

    // Check for visible components
    const chartPanel = await page.locator('[data-testid="chart-panel"], .chart-panel, [class*="chart"]').first().isVisible().catch(() => false);
    const executionPanel = await page.locator('[data-testid="execution-panel"], .execution-panel, [class*="execution"]').first().isVisible().catch(() => false);
    const pairSelector = await page.locator('[data-testid="pair-selector"], .pair-selector, [class*="pair"]').first().isVisible().catch(() => false);
    
    if (chartPanel) auditResults.components.push('Chart Panel');
    if (executionPanel) auditResults.components.push('Execution Panel');
    if (pairSelector) auditResults.components.push('Pair Selector');

    // 2. Find and click Discover button
    console.log('Looking for Discover button...');
    
    // First, let's see what buttons are available
    const allButtons = await page.locator('button').all();
    console.log(`Found ${allButtons.length} buttons on the page`);
    
    for (let i = 0; i < Math.min(allButtons.length, 30); i++) {
      const text = await allButtons[i].textContent().catch(() => '');
      const isVisible = await allButtons[i].isVisible().catch(() => false);
      if (isVisible) {
        console.log(`  Button ${i}: "${text.trim() || '(no text)'}"`);
      }
    }
    
    // Also check for links and other interactive elements
    const allLinks = await page.locator('a').all();
    console.log(`\nFound ${allLinks.length} links on the page`);
    for (let i = 0; i < Math.min(allLinks.length, 20); i++) {
      const text = await allLinks[i].textContent().catch(() => '');
      const isVisible = await allLinks[i].isVisible().catch(() => false);
      if (text.trim() && isVisible) {
        console.log(`  Link ${i}: "${text.trim()}"`);
      }
    }
    
    // Check for any element with "discover" in text
    const discoverElements = await page.locator('*:has-text("discover")').all();
    console.log(`\nFound ${discoverElements.length} elements containing "discover"`);
    for (let i = 0; i < Math.min(discoverElements.length, 10); i++) {
      const text = await discoverElements[i].textContent().catch(() => '');
      const tagName = await discoverElements[i].evaluate(el => el.tagName).catch(() => '');
      const isVisible = await discoverElements[i].isVisible().catch(() => false);
      if (isVisible) {
        console.log(`  ${tagName}: "${text.trim().substring(0, 50)}"`);
      }
    }
    
    // Try multiple selectors for Discover button
    const discoverSelectors = [
      'button:has-text("Discover")',
      'button:text-is("Discover")',
      '[data-testid="discover-button"]',
      'button[class*="discover"]',
      'button[aria-label*="discover" i]',
      'button:has-text("discover")',
      '[role="button"]:has-text("Discover")',
      'button:has(svg) >> text="Discover"',
      'button >> text="Discover"'
    ];
    
    let discoverButton = null;
    let discoverButtonVisible = false;
    
    for (const selector of discoverSelectors) {
      try {
        const btn = page.locator(selector).first();
        const visible = await btn.isVisible({ timeout: 1000 }).catch(() => false);
        if (visible) {
          discoverButton = btn;
          discoverButtonVisible = true;
          console.log(`Found Discover button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // If still not found, try a more aggressive search
    if (!discoverButtonVisible) {
      console.log('\nTrying case-insensitive search...');
      const caseInsensitiveBtn = page.locator('button').filter({ hasText: /discover/i }).first();
      discoverButtonVisible = await caseInsensitiveBtn.isVisible().catch(() => false);
      if (discoverButtonVisible) {
        discoverButton = caseInsensitiveBtn;
        console.log('Found Discover button with case-insensitive filter');
      }
    }
    
    if (discoverButtonVisible) {
      console.log('Clicking Discover button...');
      await discoverButton.click();
      await page.waitForTimeout(1500);
      
      // 3. Discover Overlay screenshot
      console.log('Capturing Discover Overlay...');
      const overlayScreenshot = join(screenshotsDir, 'discover-overlay-open.png');
      await page.screenshot({ path: overlayScreenshot, fullPage: true });
      auditResults.screenshots.push('discover-overlay-open.png');
      auditResults.components.push('Discover Overlay');
      console.log('✓ Discover Overlay captured');

      // 4. Try different tabs
      const tabs = ['Not Bonded', 'Bonded', 'Ranked'];
      
      for (const tabName of tabs) {
        console.log(`Looking for ${tabName} tab...`);
        const tab = await page.locator(`button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first();
        const tabVisible = await tab.isVisible().catch(() => false);
        
        if (tabVisible) {
          console.log(`Clicking ${tabName} tab...`);
          await tab.click();
          await page.waitForTimeout(1000);
          
          const tabScreenshot = join(screenshotsDir, `discover-overlay-${tabName.toLowerCase().replace(' ', '-')}-tab.png`);
          await page.screenshot({ path: tabScreenshot, fullPage: true });
          auditResults.screenshots.push(`discover-overlay-${tabName.toLowerCase().replace(' ', '-')}-tab.png`);
          console.log(`✓ ${tabName} tab captured`);
          auditResults.components.push(`${tabName} Tab`);
        } else {
          console.log(`⚠ ${tabName} tab not found`);
          auditResults.issues.push(`${tabName} tab not visible or not found`);
        }
      }
    } else {
      console.log('⚠ Discover button not found');
      auditResults.issues.push('Discover button not visible or not found');
    }

    // Check for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        auditResults.issues.push(`Console error: ${msg.text()}`);
      }
    });

    // Check for page errors
    page.on('pageerror', error => {
      auditResults.issues.push(`Page error: ${error.message}`);
    });

  } catch (error) {
    console.error('Error during audit:', error);
    auditResults.issues.push(`Fatal error: ${error.message}`);
  } finally {
    await browser.close();
  }

  // Generate audit summary
  console.log('\n=== AUDIT SUMMARY ===\n');
  console.log('Components Found:');
  if (auditResults.components.length > 0) {
    auditResults.components.forEach(comp => console.log(`  ✓ ${comp}`));
  } else {
    console.log('  (none)');
  }
  
  console.log('\nScreenshots Captured:');
  auditResults.screenshots.forEach(screenshot => console.log(`  📸 ${screenshot}`));
  
  console.log('\nIssues Detected:');
  if (auditResults.issues.length > 0) {
    auditResults.issues.forEach(issue => console.log(`  ⚠ ${issue}`));
  } else {
    console.log('  (none)');
  }
  
  console.log('\n=== END AUDIT ===\n');
  
  return auditResults;
}

auditTradingTerminal().catch(console.error);
