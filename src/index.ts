cat > src/index.ts << 'EOF'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Force load .env from the correct location
dotenv.config({ path: resolve(__dirname, '../.env') })

// Hardcoded fallback in case .env doesn't load (remove after testing)
const SUPABASE_URL = process.env.SUPABASE_URL || "https://dwiioeurbbvhsijvrzsq.supabase.co"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3aWlvZXVyYmJ2aHNpanZyenNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI3NDUxNiwiZXhwIjoyMDkxODUwNTE2fQ.tuk094g1MjkMpgzfnl-tB_UGcft5JQrbv_BAhiOSNq0"

const ATAMIS_EMAIL = process.env.ATAMIS_EMAIL || "founder@sweetlyveganprotocol.com.hf"
const ATAMIS_PASSWORD = process.env.ATAMIS_PASSWORD || "9M$$!#X!-6z.bRi"

console.log('=== CONFIGURATION ===')
console.log('SUPABASE_URL:', SUPABASE_URL)
console.log('SUPABASE_SERVICE_KEY exists:', !!SUPABASE_SERVICE_KEY)
console.log('ATAMIS_EMAIL:', ATAMIS_EMAIL)
console.log('===================')

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
    // 1. Login to Atamis
    console.log('Navigating to Atamis...')
    await page.goto('https://auth.finance.gov.uk/login', { waitUntil: 'networkidle' })

    console.log('Entering credentials...')
    await page.fill('input[type="email"]', ATAMIS_EMAIL)
    await page.fill('input[type="password"]', ATAMIS_PASSWORD)
    await page.click('button[type="submit"]')

    await page.waitForURL('**/lightning/**', { timeout: 60000 })
    console.log('Logged into Atamis successfully')

    // 2. Test Supabase connection
    console.log('Testing Supabase connection...')
    const { error: testError } = await supabase
      .from('tenders')
      .select('count')
      .limit(1)

    if (testError) {
      console.log('Supabase error:', testError.message)
    } else {
      console.log('Supabase connection successful')
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
    console.log('Screenshot saved: error.png')
  } finally {
    await browser.close()
    console.log('=== ATAMIS SCRAPER END ===')
  }
}

main().catch(console.error)
EOF
