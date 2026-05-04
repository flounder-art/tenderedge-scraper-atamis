cat > src/index.ts << 'EOF'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

// Hardcode credentials for now (remove after testing)
const ATAMIS_EMAIL = "founder@sweetlyveganprotocol.com.hf"
const ATAMIS_PASSWORD = "9M$$!#X!-6z.bRi"
const SUPABASE_URL = "https://dwiioeurbbvhsijvrzsq.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3aWlvZXVyYmJ2aHNpanZyenNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI3NDUxNiwiZXhwIjoyMDkxODUwNTE2fQ.tuk094g1MjkMpgzfnl-tB_UGcft5JQrbv_BAhiOSNq0"

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function scrapeAtamis() {
  console.log('=== ATAMIS SCRAPER START ===')
  console.log(`Time: ${new Date().toISOString()}`)
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  const page = await browser.newPage()

  try {
    // Navigate to Atamis login
    console.log('Navigating to Atamis login...')
    await page.goto('https://auth.finance.gov.uk/login', { waitUntil: 'networkidle' })
    
    console.log('Looking for login form...')
    
    // Try multiple selectors for email field
    const emailSelectors = ['input[type="email"]', '#email', 'input[name="email"]', 'input[name="username"]']
    for (const selector of emailSelectors) {
      const exists = await page.$(selector)
      if (exists) {
        console.log(`Found email field with selector: ${selector}`)
        await page.fill(selector, ATAMIS_EMAIL)
        break
      }
    }
    
    // Try multiple selectors for password field
    const passwordSelectors = ['input[type="password"]', '#password', 'input[name="password"]', 'input[name="pw"]']
    for (const selector of passwordSelectors) {
      const exists = await page.$(selector)
      if (exists) {
        console.log(`Found password field with selector: ${selector}`)
        await page.fill(selector, ATAMIS_PASSWORD)
        break
      }
    }
    
    // Try multiple selectors for submit button
    const buttonSelectors = ['button[type="submit"]', 'input[type="submit"]', '.loginButton', '#submit']
    for (const selector of buttonSelectors) {
      const exists = await page.$(selector)
      if (exists) {
        console.log(`Found submit button with selector: ${selector}`)
        await page.click(selector)
        break
      }
    }
    
    // Wait for redirect
    await page.waitForURL('**/lightning/**', { timeout: 60000 })
    console.log('Successfully logged into Atamis!')
    
    // Take screenshot to verify
    await page.screenshot({ path: 'atamis-logged-in.png' })
    console.log('Screenshot saved: atamis-logged-in.png')
    
    // Look for tender opportunities
    console.log('Looking for tender opportunities...')
    
    // Try to find any links related to opportunities
    const pageText = await page.evaluate(() => document.body.innerText)
    const hasOpportunities = pageText.includes('Opportunity') || pageText.includes('Tender') || pageText.includes('CS_Supplier')
    console.log(`Page contains opportunity text: ${hasOpportunities}`)
    
    console.log('=== ATAMIS SCRAPER END ===')
    
  } catch (err) {
    console.error('Scraper error:', err)
    await page.screenshot({ path: 'atamis-error.png', fullPage: true })
    console.log('Error screenshot saved: atamis-error.png')
  } finally {
    await browser.close()
  }
}

scrapeAtamis().catch(console.error)
EOF
