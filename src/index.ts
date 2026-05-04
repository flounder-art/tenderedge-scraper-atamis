cat > src/index.ts << 'EOF'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

// ============================================
// HARDCODED CREDENTIALS - NO ENV FILES NEEDED
// ============================================
const ATAMIS_EMAIL = "founder@sweetlyveganprotocol.com.hf"
const ATAMIS_PASSWORD = "9M$$!#X!-6z.bRi"
const SUPABASE_URL = "https://dwiioeurbbvhsijvrzsq.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3aWlvZXVyYmJ2aHNpanZyenNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI3NDUxNiwiZXhwIjoyMDkxODUwNTE2fQ.tuk094g1MjkMpgzfnl-tB_UGcft5JQrbv_BAhiOSNq0"

console.log('========================================')
console.log('SWEETLYVEGANPROTOCOL - ATAMIS SCRAPER')
console.log('========================================')
console.log(`Supabase URL: ${SUPABASE_URL}`)
console.log(`Supabase Key length: ${SUPABASE_KEY.length}`)
console.log(`Atamis Email: ${ATAMIS_EMAIL}`)
console.log('========================================\n')

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function scrapeAtamis() {
  console.log('=== ATAMIS SCRAPER START ===')
  console.log(`Time: ${new Date().toISOString()}\n`)
  
  // Test Supabase connection first
  console.log('Testing Supabase connection...')
  try {
    const { data, error } = await supabase
      .from('tenders')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('Supabase connection FAILED:', error.message)
    } else {
      console.log('Supabase connection SUCCESSFUL!\n')
    }
  } catch (err) {
    console.error('Supabase error:', err)
  }
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  const page = await browser.newPage()

  try {
    console.log('Navigating to Atamis login page...')
    await page.goto('https://auth.finance.gov.uk/login', { waitUntil: 'networkidle' })
    
    console.log('Entering email...')
    await page.fill('input[type="email"]', ATAMIS_EMAIL)
    
    console.log('Entering password...')
    await page.fill('input[type="password"]', ATAMIS_PASSWORD)
    
    console.log('Clicking submit button...')
    await page.click('button[type="submit"]')
    
    console.log('Waiting for redirect...')
    await page.waitForURL('**/lightning/**', { timeout: 60000 })
    console.log('✅ Logged into Atamis successfully!\n')
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'atamis-dashboard.png' })
    console.log('Screenshot saved: atamis-dashboard.png')
    
    // Look for opportunities
    const pageText = await page.evaluate(() => document.body.innerText)
    const hasOpportunities = pageText.includes('Opportunity') || pageText.includes('Tender')
    console.log(`Opportunities found: ${hasOpportunities}\n`)
    
    console.log('=== ATAMIS SCRAPER DONE ===')
    
  } catch (err) {
    console.error('❌ ATAMIS scraper error:', err)
    await page.screenshot({ path: 'atamis-error.png', fullPage: true })
    console.log('Error screenshot saved: atamis-error.png')
    throw err
  } finally {
    await browser.close()
  }
}

scrapeAtamis().catch(err => {
  console.error('ATAMIS scraper fatal error:', err)
  process.exit(1)
})
EOF
