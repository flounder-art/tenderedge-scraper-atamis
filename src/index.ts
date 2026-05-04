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
    args: ['--no-sandbox'] // Railway needs this
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 1. Go to Atamis home - Salesforce will redirect to login
    await page.goto('https://atamis-1928.my.site.com/home/home.jsp', { 
      waitUntil: 'networkidle' 
    });
    
    // 2. Salesforce Experience Cloud login selectors
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', process.env.ATAMIS_USERNAME!);
    await page.fill('input[type="password"]', process.env.ATAMIS_PASSWORD!);
    await page.click('input[type="submit"], button[type="submit"]');
    
    // 3. Wait for redirect back to home.jsp after login
    await page.waitForURL('**/home/home.jsp', { timeout: 20000 });
    console.log('Logged into Atamis successfully');
    
    // 4. TODO: Navigate to opportunities/tenders page
    // You'll need to find the real URL - likely something like:
    // await page.goto('https://atamis-1928.my.site.com/s/opportunities');
    
    // 5. TODO: Scrape tender data - update selectors after you inspect the page
    // const tenders = await page.$$eval('.tender-card', rows => 
    //   rows.map(row => ({ title: row.querySelector('.title')?.textContent }))
    // );
    
    // 6. TODO: Insert to Supabase
    // if (tenders.length) {
    //   await supabase.from('tenders').insert(tenders);
    // }
    
    console.log('Atamis login OK. Add scraping logic next.');
    
  } catch (err) {
    console.error('ATAMIS scraper error:', err);
    await page.screenshot({ path: '/tmp/atamis-error.png' }); // Debug on Railway
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
