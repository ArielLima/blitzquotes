import 'dotenv/config';
import { scrapeHomeDepot, CATEGORIES } from './scrapers/homedepot.js';
import { saveItems, supabase } from './db.js';
import { ScrapedItem } from './types.js';

const BATCH_SIZE = 50;
const DEFAULT_REGION = 'US'; // Will be refined by zip code later

async function main() {
  const args = process.argv.slice(2);
  const sourceArg = args.find(a => a.startsWith('--source='))?.split('=')[1];
  const testMode = args.includes('--test');
  const dryRun = args.includes('--dry-run');
  const debug = args.includes('--debug');

  console.log('BlitzPrices Scraper');
  console.log('==================');
  console.log(`Source: ${sourceArg || 'all'}`);
  console.log(`Test mode: ${testMode}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Debug mode: ${debug}`);
  console.log('');

  // Check DB connection
  if (!dryRun) {
    const { error } = await supabase.from('community_prices').select('id').limit(1);
    if (error) {
      console.error('Database connection failed:', error.message);
      console.log('\nMake sure:');
      console.log('1. SUPABASE_URL and SUPABASE_SERVICE_KEY are set in .env');
      console.log('2. The community_prices table exists');
      process.exit(1);
    }
    console.log('Database connected.\n');
  }

  let batch: ScrapedItem[] = [];
  let stats = { total: 0, saved: 0, errors: 0 };

  const processBatch = async () => {
    if (batch.length === 0) return;

    if (dryRun) {
      console.log(`[DRY RUN] Would save ${batch.length} items`);
      batch.forEach(item => {
        console.log(`  - ${item.name}: $${item.price} (${item.unit})`);
      });
    } else {
      const dbItems = batch.map(item => ({
        name: item.name,
        name_normalized: item.name.toLowerCase().trim(),
        category: item.category,
        unit: item.unit,
        cost: item.price,
        region: DEFAULT_REGION,
        source: 'scraper_homedepot',
        sku: item.source_sku,
      }));

      const result = await saveItems(dbItems);
      stats.saved += result.inserted;
      stats.errors += result.errors;

      console.log(`  Batch saved: ${result.inserted} items`);
    }

    batch = [];
  };

  const onItem = async (item: ScrapedItem) => {
    batch.push(item);
    stats.total++;

    if (batch.length >= BATCH_SIZE) {
      await processBatch();
    }
  };

  // Run scrapers
  if (!sourceArg || sourceArg === 'homedepot') {
    console.log('Starting Home Depot scraper...\n');

    const options = {
      ...(testMode && { maxCategories: 1 }), // Just 1 category in test mode
      debug,
    };

    const result = await scrapeHomeDepot(onItem, options);
    stats.errors += result.errors;
  }

  // Save remaining batch
  await processBatch();

  // Print summary
  console.log('\n==================');
  console.log('Scraping Complete');
  console.log('==================');
  console.log(`Total items found: ${stats.total}`);
  console.log(`Items saved: ${stats.saved}`);
  console.log(`Errors: ${stats.errors}`);
}

main().catch(console.error);
