import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function scrapeAtamis() {
  console.log('=== ATAMIS SCRAPER START ===', new Date().toISOString());
  
  try {
    const username = process.env.ATAMIS_USERNAME;
    const password = process.env.ATAMIS_PASSWORD;
    
    if (!username || !password) {
      throw new Error('ATAMIS_USERNAME and ATAMIS_PASSWORD required');
    }

    // TODO: Implement actual Atamis login & scraping with Playwright
    const tendersFound: any[] = []; // Replace with actual scraped tenders

    console.log(`[DEBUG] Found ${tendersFound.length} tenders on Atamis`);

    for (const tender of tendersFound) {
      console.log(`[DEBUG] Tender title: ${tender.title}`);
      console.log(`[DEBUG] Tender value: ${tender.value}`);
      console.log(`[DEBUG] Full tender: ${JSON.stringify(tender, null, 2)}`);

      try {
        const { data, error } = await supabase
          .from('tenders')
          .insert({
            source: 'ATAMIS',
            source_id: tender.id,
            title: tender.title,
            value: tender.value || null,
            deadline: tender.deadline,
            buyer: tender.buyer || 'Unknown',
            cpv_codes: tender.cpv_codes || [],
            description: tender.description || '',
            status: tender.status || 'OPEN',
            url: tender.url,
            scraped_at: new Date().toISOString()
          });

        if (error) throw error;
        console.log(`[DEBUG] Insert successful for ${tender.title}`);
      } catch (err) {
        console.error(`[ERROR] Insert failed: ${err}`);
      }
    }

  } catch (err) {
    console.error('ATAMIS scraper fatal error:', err);
    process.exit(1);
  }

  console.log('=== ATAMIS SCRAPER DONE ===');
}

scrapeAtamis();
