import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const ATAMIS_EMAIL = process.env.ATAMIS_EMAIL!
const ATAMIS_PASSWORD = process.env.ATAMIS_PASSWORD!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const SUPABASE_KEY = process.env.SUPABASE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

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
    // 1. Login
    console.log('Navigating to Atamis...')
    await page.goto('https://auth.finance.gov.uk/login', { waitUntil: 'networkidle' })

    console.log('Entering credentials...')
    await page.fill('input[type="email"]', ATAMIS_EMAIL)
    await page.fill('input[type="password"]', ATAMIS_PASSWORD)
    await page.click('button[type="submit"]')

    await page.waitForURL('**/lightning/**', { timeout: 60000 })
    console.log('Logged into Atamis successfully')

    // 2. Test Supabase
    console.log('Testing Supabase connection...')
    const { error: testError } = await supabase
      .from('tenders')
      .insert({
        title: 'TEST - Atamis Integration',
        value: '10000',
        source: 'ATAMIS',
        deadline: new Date('2025-12-31').toISOString()
      })
      .select()

    if (testError) {
      console.log('Supabase error:', testError.message)
    } else {
      console.log('Supabase test successful')
    }

    // 3. Navigate to opportunities
    await page.goto('https://uk-frp.lightning.force.com/lightning/n/CS_Supplier_Home')
    await page.waitForTimeout(5000)

    // 4. Scrape tenders
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
      }).filter(t => t.title)
    })

    console.log(`Found ${tenders.length} tenders`)

    // 5. Insert to Supabase
    if (tenders.length > 0) {
      const { error } = await supabase
        .from('tenders')
        .upsert(tenders, { onConflict: 'reference' })
        .select()

      if (error) {
        console.log('Insert error:', error.message)
      } else {
        console.log(`Inserted ${tenders.length} tenders`)
      }
    }

  } catch (err) {
    console.error('Scraper failed:', err)
    await page.screenshot({ path: 'error.png', fullPage: true })
  } finally {
    await browser.close()
    console.log('=== ATAMIS SCRAPER END ===')
  }
}

main().catch(console.error)
