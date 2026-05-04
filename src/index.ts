cat > src/index.ts << 'EOF'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

// ============================================
// HARDCODED CREDENTIALS (Remove after debugging)
// ============================================
const ATAMIS_EMAIL = "founder@sweetlyveganprotocol.com.hf"
const ATAMIS_PASSWORD = "9M$$!#X!-6z.bRi"
const SUPABASE_URL = "https://dwiioeurbbvhsijvrzsq.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3aWlvZXVyYmJ2aHNpanZyenNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI3NDUxNiwiZXhwIjoyMDkxODUwNTE2fQ.tuk094g1MjkMpgzfnl-tB_UGcft5JQrbv_BAhiOSNq0"

console.log('=== CONFIGURATION VERIFICATION ===')
console.log('ATAMIS_EMAIL:', ATAMIS_EMAIL)
console.log('SUPABASE_URL:', SUPABASE_URL)
console.log('SUPABASE_KEY length:', SUPABASE_KEY.length)
console.log('==================================')

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function scrapeAtamis() {
  console.log('\n=== ATAMIS SCRAPER START ===')
  console.log(`Time: ${new Date().toISOString()}`)
  
  // Test Supabase connection first
  console.log('\nTesting Supabase connection...')
  const { error: testError } = await supabase
    .from('tenders')
    .select('count')
    .limit(1)
  
  if (testError) {
    console.error('Supabase connection failed:', testError.message)
  } else {
    console.log('Supabase connection successful!')
  }
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  const page = await browser.newPage()

  try {
    // Navigate to Atamis login
    console.log('\nNavigating to Atamis login...')
    await page.goto('https://auth.finance.gov.uk/login', { waitUntil: 'networkidle' })
    
    console.log('Entering email...')
    await page.fill('input[type="email"]', ATAMIS_EMAIL)
    
    console.log('Entering password...')
    await page.fill('input[type="password"]', ATAMIS_PASSWORD)
    
    console.log('Clicking submit...')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to Salesforce
    console.log('Waiting for redirect...')
    await page.waitForURL('**/lightning/**', { timeout: 60000 })
    console.log('Successfully logged into Atamis!')
    
    // Get page title and URL
    const pageTitle = await page.title()
    const currentUrl = page.url()
    console.log(`Page title: ${pageTitle}`)
    console.log(`Current URL: ${currentUrl}`)
    
    // Look for opportunities
    console.log('\nLooking for tender opportunities...')
    
    // Check if we're on the right page
    const hasOpportunities = await page.evaluate(() => {
      const text = document.body.innerText
      return text.includes('Opportunity') || text.includes('Tender') || text.includes('CS_Supplier')
    })
    
    console.log(`Opportunities found on page: ${hasOpportunities}`)
    
    // Take screenshot
    await page.screenshot({ path: 'atamis-dashboard.png' })
    console.log('Screenshot saved: atamis-dashboard.png')
    
    console.log('\n=== ATAMIS SCRAPER COMPLETED ===')
    
  } catch (err) {
    console.error('\n❌ Scraper error:', err)
    await page.screenshot({ path: 'atamis-error.png', fullPage: true })
    console.log('Error screenshot saved: atamis-error.png')
  } finally {
    await browser.close()
  }
}

// Run the scraper
scrapeAtamis().catch(console.error)
EOF
