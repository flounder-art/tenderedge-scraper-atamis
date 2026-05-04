import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const ATAMIS_EMAIL = process.env.ATAMIS_EMAIL!
const ATAMIS_PASSWORD = process.env.ATAMIS_PASSWORD!
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  console.log('=== ATAMIS SCRAPER START ===')
  console.log(`Time: ${new Date().toISOString()}`)
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  })
  
  const page = await context.newPage()

  try {
    // ============================================================
    // STEP 1: LOGIN TO ATAMIS (GOV.UK SSO)
    // ============================================================
    console.log('Navigating to Atamis login...')
    await page.goto('https://auth.finance.gov.uk/login', { waitUntil: 'networkidle' })
    
    console.log('Entering credentials...')
    await page.fill('input[type="email"]', ATAMIS_EMAIL)
    await page.fill('input[type="password"]', ATAMIS_PASSWORD)
    await page.click('button[type="submit"]')
    
    // Wait for redirect to Salesforce
    console.log('Waiting for redirect to Salesforce...')
    await page.waitForURL('**/lightning/**', { timeout: 60000 })
    console.log(`Redirected to: ${page.url()}`)
    
    // Additional wait for Lightning to fully load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)
    
    // ============================================================
    // STEP 2: NAVIGATE TO OPPORTUNITIES (CRITICAL FIX)
    // ============================================================
    console.log('Navigating to opportunities...')
    
    // Try multiple navigation methods
    const navSuccess = await tryNavigateToOpportunities(page)
    
    if (!navSuccess) {
      console.log('Could not find opportunities navigation, taking screenshot for debugging')
      await page.screenshot({ path: 'atamis-dashboard.png', fullPage: true })
      throw new Error('Could not navigate to opportunities')
    }
    
    // ============================================================
    // STEP 3: SCRAPE TENDERS
    // ============================================================
    console.log('Waiting for tender table to load...')
    
    // Wait for table with timeout and retry
    const tableSelectors = [
      'table',
      '[role="grid"]',
      '.slds-table',
      'table[data-aura-class]',
      'tbody tr'
    ]
    
    let tableFound = false
    for (const selector of tableSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 })
        console.log(`Found table with selector: ${selector}`)
        tableFound = true
        break
      } catch (e) {
        // continue
      }
    }
    
    if (!tableFound) {
      console.log('No table found, taking screenshot...')
      await page.screenshot({ path: 'atamis-no-table.png', fullPage: true })
      throw new Error('Could not find tender table')
    }
    
    // Scroll to load all content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2000)
    await page.evaluate(() => window.scrollTo(0, 0))
    
    // Extract tenders with robust selectors
    const tenders = await extractTenders(page)
    console.log(`Found ${tenders.length} tenders`)
    
    // ============================================================
    // STEP 4: INSERT TO SUPABASE
    // ============================================================
    if (tenders.length > 0) {
      const results = await insertTendersToSupabase(tenders)
      console.log(`Inserted ${results.inserted} tenders, ${results.skipped} duplicates`)
    } else {
      console.log('No tenders found to insert')
    }
    
    // ============================================================
    // STEP 5: CREATE FEED EVENT
    // ============================================================
    await createFeedEvent(tenders.length)
    
  } catch (err) {
    console.error('Scraper failed:', err)
    await page.screenshot({ path: 'error.png', fullPage: true })
    
    // Log the page content for debugging
    const pageContent = await page.content()
    console.log('Page content snippet:', pageContent.slice(0, 1000))
    
    throw err
  } finally {
    await browser.close()
    console.log('=== ATAMIS SCRAPER END ===')
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function tryNavigateToOpportunities(page: any): Promise<boolean> {
  // Method 1: Direct URL (most common)
  const opportunityUrls = [
    'https://uk-frp.lightning.force.com/lightning/n/CS_Supplier_Home',
    'https://uk-frp.lightning.force.com/lightning/o/Opportunity/list',
    'https://uk-frp.lightning.force.com/lightning/n/CS_Opportunity_Management'
  ]
  
  for (const url of opportunityUrls) {
    try {
      console.log(`Trying navigation to: ${url}`)
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
      await page.waitForTimeout(3000)
      
      // Check if we see tender content
      const hasContent = await page.evaluate(() => {
        return document.body.innerText.includes('Opportunity') || 
               document.body.innerText.includes('Tender') ||
               document.querySelector('table') !== null
      })
      
      if (hasContent) {
        console.log(`Successfully navigated to: ${url}`)
        return true
      }
    } catch (e) {
      console.log(`Failed to navigate to ${url}: ${e}`)
    }
  }
  
  // Method 2: Click navigation links
  try {
    console.log('Trying to click navigation links...')
    const navLinks = await page.$$('a[href*="Opportunity"], a[href*="Tender"], a[href*="CS_Supplier"]')
    
    for (const link of navLinks) {
      const text = await link.textContent()
      if (text?.toLowerCase().includes('opportunity') || text?.toLowerCase().includes('tender')) {
        console.log(`Clicking link: ${text}`)
        await link.click()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(3000)
        return true
      }
    }
  } catch (e) {
    console.log(`Navigation click failed: ${e}`)
  }
  
  return false
}

async function extractTenders(page: any): Promise<any[]> {
  // Try multiple extraction methods
  const extractionMethods = [
    extractTendersMethod1,
    extractTendersMethod2,
    extractTendersMethod3
  ]
  
  for (const method of extractionMethods) {
    const tenders = await method(page)
    if (tenders.length > 0) {
      console.log(`Method ${method.name} found ${tenders.length} tenders`)
      return tenders
    }
  }
  
  return []
}

async function extractTendersMethod1(page: any): Promise<any[]> {
  return await page.$$eval('table tbody tr', (rows: any[]) => {
    return rows.map(row => {
      const cells = row.querySelectorAll('td, th')
      const link = row.querySelector('a')
      const linkUrl = link ? (link as HTMLAnchorElement).href : null
      
      // Extract opportunity ID if present
      const opportunityMatch = linkUrl?.match(/\/opportunity\/([a-zA-Z0-9]+)/)
      const reference = opportunityMatch ? opportunityMatch[1] : cells[0]?.innerText?.trim() || ''
      
      return {
        title: cells[1]?.innerText?.trim() || cells[0]?.innerText?.trim() || 'Unknown',
        reference: reference,
        deadline: parseDate(cells[2]?.innerText?.trim() || cells[3]?.innerText?.trim() || null),
        value: parseValue(cells[3]?.innerText?.trim() || cells[4]?.innerText?.trim() || null),
        url: linkUrl,
        source: 'ATAMIS',
        status: 'OPEN',
        scraped_at: new Date().toISOString()
      }
    }).filter((t: any) => t.title && t.title !== 'Unknown')
  })
}

async function extractTendersMethod2(page: any): Promise<any[]> {
  return await page.$$eval('[role="row"]', (rows: any[]) => {
    return rows.map(row => {
      const cells = row.querySelectorAll('[role="gridcell"], [role="cell"]')
      const link = row.querySelector('a')
      
      return {
        title: cells[0]?.innerText?.trim() || 'Unknown',
        reference: link?.href?.match(/[A-Z0-9]{10,}/)?.[0] || '',
        deadline: parseDate(cells[1]?.innerText?.trim() || null),
        value: parseValue(cells[2]?.innerText?.trim() || null),
        url: link?.href || null,
        source: 'ATAMIS',
        status: 'OPEN',
        scraped_at: new Date().toISOString()
      }
    }).filter((t: any) => t.title && t.title !== 'Unknown')
  })
}

async function extractTendersMethod3(page: any): Promise<any[]> {
  // Fallback: extract from page text using regex
  return await page.evaluate(() => {
    const text = document.body.innerText
    const tenders: any[] = []
    
    // Look for patterns like "Opportunity: XYZ" or "Tender: ABC"
    const patterns = [
      /(?:Opportunity|Tender):\s*([^\n]+)/gi,
      /([A-Z]{2,}\d{4,}[A-Z]{0,2})\s+-\s+([^\n]+)/g
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        tenders.push({
          title: match[2] || match[1],
          reference: match[1],
          source: 'ATAMIS',
          status: 'OPEN',
          scraped_at: new Date().toISOString()
        })
      }
    }
    
    return tenders.slice(0, 50) // Limit to 50
  })
}

function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  
  // Parse UK date formats
  const patterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{1,2})-(\d{1,2})-(\d{4})/,   // DD-MM-YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/    // YYYY-MM-DD
  ]
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern)
    if (match) {
      let [_, d, m, y] = match
      if (y.length === 2) y = '20' + y
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString()
    }
  }
  
  return null
}

function parseValue(valueStr: string | null): string | null {
  if (!valueStr) return null
  
  const match = valueStr.match(/[£€$]?\s*([\d,]+(?:\.\d{2})?)/)
  if (match) {
    return match[1].replace(/,/g, '')
  }
  
  return null
}

async function insertTendersToSupabase(tenders: any[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped = 0
  
  for (const tender of tenders) {
    // Check for duplicate by reference or title
    const { data: existing } = await supabase
      .from('tenders')
      .select('id')
      .or(`reference.eq.${tender.reference},title.eq.${tender.title}`)
      .maybeSingle()
    
    if (existing) {
      console.log(`Skipping duplicate: ${tender.title}`)
      skipped++
      continue
    }
    
    const { error } = await supabase
      .from('tenders')
      .insert({
        id: crypto.randomUUID(),
        title: tender.title.slice(0, 500),
        reference: tender.reference,
        value: tender.value,
        deadline: tender.deadline,
        url: tender.url,
        source: tender.source,
        status: tender.status,
        description: tender.description,
        scraped_at: tender.scraped_at
      })
    
    if (error) {
      console.error(`Insert failed for ${tender.title}:`, error.message)
    } else {
      console.log(`Inserted: ${tender.title}`)
      inserted++
    }
  }
  
  return { inserted, skipped }
}

async function createFeedEvent(tenderCount: number) {
  const { error } = await supabase
    .from('feed_events')
    .insert({
      feed_type: 'TENDER_DISCOVERED',
      title: `Atamis Scraper - ${tenderCount} tenders found`,
      payload: {
        source: 'ATAMIS',
        tender_count: tenderCount,
        timestamp: new Date().toISOString()
      },
      event_date: new Date().toISOString()
    })
  
  if (error) {
    console.error('Failed to create feed event:', error.message)
  } else {
    console.log('Feed event created')
  }
}

// Run the scraper
main().catch(console.error)
