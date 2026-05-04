cat > src/index.ts << 'EOF'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

// ============================================
// HARDCODED CREDENTIALS - NO ENV VARIABLES
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

// Create Supabase client with hardcoded values
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function scrapeAtamis() {
  console.log('=== ATAMIS SCRAPER START ===', new Date().toISOString())
  
  // Test Supabase connection first
  console.log('\nTesting Supabase connection...')
  try {
    const { error } = await supabase.from('tenders').select('count').limit(1)
    if (error) {
      console.log('Supabase error:', error.message)
    } else {
      console.log('✅ Supabase connected successfully!')
    }
  } catch (err) {
    console.log('Supabase test failed:', err)
  }
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  const page = await browser.newPage()

  try {
    console.log('\n📋 Logging into Atamis...')
    await page.goto('https://auth.finance.gov.uk/login', { waitUntil: 'networkidle' })
    
    console.log('  Entering email...')
    await page.fill('input[type="email"]', ATAMIS_EMAIL)
    
    console.log('  Entering password...')
    await page.fill('input[type="password"]', ATAMIS_PASSWORD)
    
    console.log('  Submitting...')
    await page.click('button[type="submit"]')
    
    console.log('  Waiting for redirect...')
    await page.waitForURL('**/lightning/**', { timeout: 30000 })
    
    console.log('\n✅ Successfully logged into Atamis!\n')
    
    // Take screenshot
    await page.screenshot({ path: 'atamis-dashboard.png' })
    console.log('📸 Screenshot saved: atamis-dashboard.png')
    
    // Check for opportunities
    const pageText = await page.evaluate(() => document.body.innerText)
    const hasOpportunities = pageText.includes('Opportunity') || pageText.includes('Tender')
    console.log(`\n📊 Opportunities found: ${hasOpportunities ? 'YES' : 'NO'}`)
    
  } catch (err) {
    console.error('\n❌ Error:', err)
    await page.screenshot({ path: 'atamis-error.png', fullPage: true })
    console.log('📸 Error screenshot saved: atamis-error.png')
  } finally {
    await browser.close()
  }
  
  console.log('\n=== ATAMIS SCRAPER END ===')
}

// Run the scraper
scrapeAtamis().catch(console.error)
EOF
