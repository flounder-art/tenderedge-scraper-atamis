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
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://atamis-1928.my.site.com/home/home.jsp', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Salesforce login form
    await page.waitForSelector('input[type="email"], #username', { timeout: 15000 });
    await page.fill('input[type="email"], #username', process.env.ATAMIS_USERNAME!);
    await page.fill('input[type="password"], #password', process.env.ATAMIS_PASSWORD!);
    await page.click('input[type="submit"], button[type="submit"]');
    
    // Wait for redirect after login
    await page.waitForURL('**/home/home.jsp', { timeout: 20000 });
    console.log('Logged into Atamis successfully');
    
    // TODO: Navigate to tenders page and scrape
    // Example: await page.goto('https://atamis-1928.my.site.com/s/opportunities');
    
  } catch (err) {
    console.error('ATAMIS scraper error:', err);
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
