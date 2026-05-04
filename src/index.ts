import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function scrapeAtamis() {
  console.log('=== ATAMIS SCRAPER START ===', new Date().toISOString());
  
  const browser = await chromium.launch({ 
    headless: true,
    channel: 'chromium', // Use full Chromium, not headless_shell
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  try {
    await page.goto('https://atamis-1928.my.site.com/home/home.jsp', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    console.log('Page loaded, looking for login...');
    
    // Salesforce login selectors - try multiple
    await page.waitForSelector('input[type="email"], #username, input[name="username"]', { timeout: 30000 });
    await page.fill('input[type="email"], #username, input[name="username"]', process.env.ATAMIS_USERNAME!);
    await page.fill('input[type="password"], #password, input[name="pw"]', process.env.ATAMIS_PASSWORD!);
    await page.click('input[type="submit"], button[type="submit"], .loginButton');
    
    // Wait for redirect back to home.jsp after login
    await page.waitForURL('**/home/home.jsp', { timeout: 30000 });
    console.log('Logged into Atamis successfully');
    
  } catch (err) {
    console.error('ATAMIS scraper error:', err);
    await page.screenshot({ path: '/tmp/atamis-error.png', fullPage: true });
    throw err;
  } finally {
    await browser.close();
  }
  
  console.log('=== ATAMIS SCRAPER DONE ===');
}

scrapeAtamis().catch(err => {
  console.error('ATAMIS scraper fatal error:', err);
  process.exit(1);
});
