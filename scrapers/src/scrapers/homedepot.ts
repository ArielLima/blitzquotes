import puppeteer, { Browser, Page } from 'puppeteer';
import { ScrapedItem } from '../types.js';
import * as fs from 'fs';

// Departments to scrape - we'll navigate through the menu to find these
const DEPARTMENTS = [
  { name: 'Plumbing', blitzCategory: 'materials' as const },
  { name: 'Electrical', blitzCategory: 'materials' as const },
  { name: 'Heating, Venting & Cooling', blitzCategory: 'materials' as const },
  { name: 'Building Materials', blitzCategory: 'materials' as const },
  { name: 'Hardware', blitzCategory: 'materials' as const },
  { name: 'Tools', blitzCategory: 'equipment' as const },
];

const BASE_URL = 'https://www.homedepot.com';
const DELAY_MS = parseInt(process.env.SCRAPE_DELAY_MS || '1500');
const MAX_ITEMS_PER_DEPARTMENT = parseInt(process.env.MAX_ITEMS_PER_DEPARTMENT || '1000');
const CHECKPOINT_FILE = './checkpoint.json';

interface Checkpoint {
  department: string;
  page: number;
  itemsScraped: number;
  lastProductUrl?: string;
}

function delay(ms: number): Promise<void> {
  const jitter = ms * (0.8 + Math.random() * 0.4);
  return new Promise(resolve => setTimeout(resolve, jitter));
}

function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    }
  } catch (e) {
    console.log('No checkpoint found, starting fresh');
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

function clearCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
}

function normalizeUnit(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('/ft') || lower.includes('per ft') || lower.includes('linear')) return 'foot';
  if (lower.includes('/sq') || lower.includes('per sq')) return 'sqft';
  if (lower.includes('/lb') || lower.includes('per lb')) return 'lb';
  if (lower.includes('/gal')) return 'gallon';
  return 'each';
}

function parsePrice(priceText: string): number | null {
  const cleaned = priceText.replace(/[^0-9.]/g, '');
  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

export async function scrapeHomeDepot(
  onItem: (item: ScrapedItem) => Promise<void>,
  options: { maxCategories?: number; startCategory?: number; debug?: boolean } = {}
): Promise<{ total: number; errors: number }> {
  let browser: Browser | null = null;
  let total = 0;
  let errors = 0;

  // Load checkpoint if exists
  const checkpoint = loadCheckpoint();
  if (checkpoint) {
    console.log(`Resuming from checkpoint: ${checkpoint.department}, page ${checkpoint.page}`);
  }

  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // Determine which departments to scrape
    let departmentsToScrape = DEPARTMENTS;
    if (options.maxCategories) {
      departmentsToScrape = DEPARTMENTS.slice(0, options.maxCategories);
    }

    // Skip to checkpoint department if resuming
    if (checkpoint) {
      const idx = departmentsToScrape.findIndex(d => d.name === checkpoint.department);
      if (idx > 0) {
        departmentsToScrape = departmentsToScrape.slice(idx);
      }
    }

    for (const dept of departmentsToScrape) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Scraping department: ${dept.name}`);
      console.log(`${'='.repeat(50)}`);

      try {
        const result = await scrapeDepartment(page, dept, onItem, {
          debug: options.debug,
          startPage: checkpoint?.department === dept.name ? checkpoint.page : 1,
        });
        total += result.total;
        errors += result.errors;

        // Clear checkpoint after completing a department
        clearCheckpoint();
      } catch (e) {
        console.error(`Error scraping ${dept.name}: ${(e as Error).message}`);
        errors++;
      }

      await delay(DELAY_MS * 3);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return { total, errors };
}

async function scrapeDepartment(
  page: Page,
  dept: { name: string; blitzCategory: 'materials' | 'equipment' | 'fees' },
  onItem: (item: ScrapedItem) => Promise<void>,
  options: { debug?: boolean; startPage?: number }
): Promise<{ total: number; errors: number }> {
  let total = 0;
  let errors = 0;

  try {
    // Step 1: Navigate to Home Depot
    console.log('  Step 1: Going to Home Depot...');
    console.log(`    URL: ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('    ✓ Page loaded');
    console.log(`    Current URL: ${page.url()}`);
    await delay(DELAY_MS);

    // Step 2: Click "Shop All" in the header
    console.log('  Step 2: Looking for Shop All button...');
    const shopAllBtn = await page.waitForSelector('button:has-text("Shop All"), [data-testid="shop-all"], a:has-text("Shop All")', { timeout: 10000 }).catch(() => null);
    if (shopAllBtn) {
      console.log('    ✓ Found Shop All button, clicking...');
      await shopAllBtn.click();
      await delay(DELAY_MS);
      console.log(`    Current URL: ${page.url()}`);
    } else {
      console.log('    ✗ Shop All button not found, continuing...');
    }

    // Step 3: Look for and click "Shop by Department" or directly find the department
    console.log(`  Step 3: Finding department "${dept.name}"...`);

    // Try to find the department link
    console.log(`    Looking for: a:has-text("${dept.name}")`);
    const deptLink = await page.$(`a:has-text("${dept.name}"), [data-testid*="${dept.name.toLowerCase().replace(/\s+/g, '-')}"]`);
    if (deptLink) {
      console.log('    ✓ Found department link, clicking...');
      await deptLink.click();
      await delay(DELAY_MS * 2);
      console.log(`    Current URL: ${page.url()}`);
    } else {
      // Fallback: Use search URL
      const searchUrl = `${BASE_URL}/b/${dept.name.replace(/[,&]/g, '').replace(/\s+/g, '-')}/N-5yc1v`;
      console.log(`    ✗ Department link not found`);
      console.log(`    Using fallback URL: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`    Current URL: ${page.url()}`);
    }

    // Step 4: Click "Shop All {department}" if available to get full listing
    console.log(`  Step 4: Looking for "Shop All ${dept.name}" link...`);
    await delay(DELAY_MS);

    console.log('    Looking for: a:has-text("Shop All"), a[href*="catStyle=ShowProducts"]');
    const shopAllDept = await page.$(`a:has-text("Shop All"), a[href*="catStyle=ShowProducts"]`);
    if (shopAllDept) {
      console.log('    ✓ Found Shop All link, clicking...');
      await shopAllDept.click();
      await delay(DELAY_MS * 2);
      console.log(`    Current URL: ${page.url()}`);
    } else {
      console.log('    ✗ Shop All link not found, continuing with current page...');
    }

    // Wait for product grid
    console.log('  Step 5: Waiting for product grid...');
    console.log('    Looking for: [data-testid="product-pod"], .product-pod, div[data-product-id]');
    const productGrid = await page.waitForSelector('[data-testid="product-pod"], .product-pod, div[data-product-id]', { timeout: 15000 }).catch(() => null);
    if (productGrid) {
      console.log('    ✓ Product grid found');
    } else {
      console.log('    ✗ Product grid NOT found - page might be blocked or different structure');
    }

    if (options.debug) {
      const debugDir = './debug';
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);
      const slug = dept.name.toLowerCase().replace(/\s+/g, '-');
      await page.screenshot({ path: `${debugDir}/${slug}-listing.png`, fullPage: false });
      console.log(`  Debug: saved screenshot`);
    }

    // Step 5: Scrape products - iterate through pages
    let currentPage = options.startPage || 1;
    let hasMore = true;

    while (hasMore && total < MAX_ITEMS_PER_DEPARTMENT) {
      console.log(`\n  Page ${currentPage}:`);

      // Get all product links on this page
      const productLinks = await page.$$eval(
        'div.product-pod[data-product-id] a[href*="/p/"], [data-testid="product-pod"] a[href*="/p/"]',
        (links) => [...new Set(links.map(a => a.getAttribute('href')).filter(Boolean))]
      );

      console.log(`    Found ${productLinks.length} product links`);

      // Visit each product page to get full details
      console.log(`    Visiting ${productLinks.length} product pages...`);
      for (let i = 0; i < productLinks.length; i++) {
        const link = productLinks[i];
        if (total >= MAX_ITEMS_PER_DEPARTMENT) break;

        try {
          const fullUrl = link!.startsWith('http') ? link! : `${BASE_URL}${link}`;
          console.log(`      [${i + 1}/${productLinks.length}] Scraping: ${fullUrl.slice(0, 80)}...`);

          const item = await scrapeProductPage(page, fullUrl, dept.blitzCategory);

          if (item) {
            console.log(`        ✓ Got: ${item.name.slice(0, 50)}... - $${item.price}`);
            await onItem(item);
            total++;

            if (total % 10 === 0) {
              console.log(`\n    === Progress: ${total} items scraped ===\n`);
              saveCheckpoint({ department: dept.name, page: currentPage, itemsScraped: total, lastProductUrl: fullUrl });
            }
          } else {
            console.log(`        ✗ Could not extract product data`);
          }
        } catch (e) {
          errors++;
          console.error(`        ✗ Error: ${(e as Error).message}`);
        }

        await delay(DELAY_MS);
      }

      // Try to go to next page
      const nextBtn = await page.$('a[aria-label="Next"], button[aria-label="Next"], [data-testid="pagination-next"]');
      if (nextBtn && total < MAX_ITEMS_PER_DEPARTMENT) {
        await nextBtn.click();
        await delay(DELAY_MS * 2);
        await page.waitForSelector('[data-testid="product-pod"], .product-pod', { timeout: 15000 }).catch(() => null);
        currentPage++;
      } else {
        hasMore = false;
      }
    }
  } catch (e) {
    console.error(`  Department error: ${(e as Error).message}`);
    errors++;
  }

  return { total, errors };
}

async function scrapeProductPage(
  page: Page,
  url: string,
  blitzCategory: 'materials' | 'equipment' | 'fees'
): Promise<ScrapedItem | null> {
  // Navigate to product page
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(500);

  // Extract product details
  const details = await page.evaluate(() => {
    // Product name (brand + title)
    const brandEl = document.querySelector('[data-testid="product-brand"], .product-brand, h1 span.brand');
    const titleEl = document.querySelector('h1[data-testid="product-title"], h1.product-title, h1 span:not(.brand)');
    const brand = brandEl?.textContent?.trim() || '';
    const title = titleEl?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '';
    const name = brand ? `${brand} ${title}` : title;

    // Description
    const descEl = document.querySelector('[data-testid="product-description"], .product-description, [id="product-section-overview"]');
    const description = descEl?.textContent?.trim().slice(0, 500) || '';

    // Price
    let price = '';
    const priceEl = document.querySelector('[data-testid="price-simple"], [data-testid="price-format"], .price');
    if (priceEl) {
      const dollarsEl = priceEl.querySelector('[class*="sui-text-4xl"], [class*="sui-text-3xl"], .price-dollars');
      const centsEl = priceEl.querySelector('.sui-text-xs:last-child, .price-cents');
      const dollars = dollarsEl?.textContent?.trim() || '';
      const cents = centsEl?.textContent?.replace(/[^0-9]/g, '') || '00';
      price = dollars ? `${dollars}.${cents}` : priceEl.textContent || '';
    }

    // Rating
    const ratingEl = document.querySelector('[aria-label*="Star"], [data-testid="ratings"], .star-rating');
    const ratingText = ratingEl?.getAttribute('aria-label') || ratingEl?.textContent || '';
    const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

    // Review count
    const reviewEl = document.querySelector('[data-testid="review-count"], .review-count');
    const reviewText = reviewEl?.textContent || '';
    const reviewMatch = reviewText.match(/(\d+)/);
    const reviewCount = reviewMatch ? parseInt(reviewMatch[1]) : null;

    // SKU/Model number
    const modelEl = document.querySelector('[data-testid="model-number"], .model-number, [itemprop="model"]');
    const skuEl = document.querySelector('[data-testid="internet-number"], .internet-number, [itemprop="sku"]');
    const model = modelEl?.textContent?.replace(/Model\s*#?\s*/i, '').trim() || '';
    const sku = skuEl?.textContent?.replace(/Internet\s*#?\s*/i, '').trim() || '';

    return { name, description, price, rating, reviewCount, model, sku };
  });

  if (!details.name || !details.price) {
    return null;
  }

  const price = parsePrice(details.price);
  if (!price || price <= 0 || price > 100000) {
    return null;
  }

  return {
    source: 'homedepot',
    source_sku: details.sku || details.model,
    name: details.name,
    category: blitzCategory,
    subcategory: '',
    price,
    unit: normalizeUnit(details.name),
    url,
    scraped_at: new Date().toISOString(),
    // Extended fields (we can add these to the type if needed)
    // description: details.description,
    // rating: details.rating,
    // review_count: details.reviewCount,
  };
}

export { DEPARTMENTS };
