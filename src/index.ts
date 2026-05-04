import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

// Railway env vars: ATAMIS_EMAIL, ATAMIS_PASSWORD, SUPABASE_URL, SUPABASE_KEY
const ATAMIS_EMAIL = process.env.ATAMIS_EMAIL!
const ATAMIS_PASSWORD = process.env.ATAMIS_PASSWORD!
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_KEY! // use service_role key

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  console.log('=== ATAMIS SCRAPER START ===')
  
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote'
    ]
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  })
  
  const page = await context.newPage()

  try {
    // 1. Login to Atamis
    console.log('Navigating to Atamis...')
    await page.goto('https://auth.finance.gov.uk/login', { waitUntil: 'networkidle' })

    console.log('Page loaded, looking for login...')
    await page.fill('input[type="email"]', ATAMIS_EMAIL)
    await page.fill('input[type="password"]', ATAMIS_PASSWORD)
    await page.click('button[type="submit"]')

    // Wait for Salesforce Lightning to load
    await page.waitForURL('**/lightning/**', { timeout: 60000 })
    console.log('Logged into Atamis successfully')

    // 2. Test Supabase connection first
    console.log('Testing Supabase...')
    const { data: testData, error: testError } = await supabase
      .from('tenders')
      .insert({
        title: 'TEST - Atamis Integration',
        value: '10000',
        source: 'ATAMIS',
        deadline: '2025-12-31'
      })
      .select()

    if (testError) {
      console.log('Supabase error:', testError.message)
      throw testError
    }
    console.log('Test result:', testData)

    // 3. Go to tender list - update this URL to your actual Atamis search page
    await page.goto('https://uk-frp.lightning.force.com/lightning/n/CS_Supplier_Home')
    
    // Wait for Lightning table to render
    await page.waitForSelector('table', { timeout: 30000 })
    await page.waitForTimeout(3000) // Lightning needs extra time

    // 4. Scrape tenders - you'll need to update selectors for your Atamis instance
    const tenders = await page.$$eval('table tbody tr', rows => {
      return rows.map(row => {
        const cells = row.querySelectorAll('td, th')
        const link = row.querySelector('a')
        return {
          title: cells[1]?.innerText?.trim() || '',
          reference: cells[2]?.innerText?.trim() || '',
          deadline: cells[3]?.innerText?.trim() || null,
          value: cells[4]?.innerText?.trim() || null,
          url: link ? (link as HTMLAnchorElement).href : null,
          source: 'ATAMIS'
        }
      }).filter(t => t.title) // skip empty rows
    })

    console.log(`Found ${tenders.length} tenders`)

    // 5. Insert to Supabase - upsert to avoid duplicates
    if (tenders.length > 0) {
      const { data, error } = await supabase
        .from('tenders')
        .upsert(tenders, { 
          onConflict: 'reference', // assumes you have a unique 'reference' column
          ignoreDuplicates: false 
        })
        .select()

      if (error) {
        console.log('Insert error:', error.message)
      } else {
        console.log(`Inserted ${data?.length} tenders to Supabase`)
      }
    }

  } catch (err) {
    console.error('Scraper failed:', err)
    await page.screenshot({ path: 'error.png', fullPage: true })
    throw err
  } finally {
    await browser.close()
    console.log('=== ATAMIS SCRAPER END ===')
  }
}

main()
