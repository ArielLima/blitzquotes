import puppeteer, { Browser, Page } from 'puppeteer';
import { ScrapedItem, CategoryConfig } from '../types.js';

const CATEGORIES: CategoryConfig[] = [
  // Plumbing
  { name: 'Water Heaters', url: '/b/Plumbing-Water-Heaters/N-5yc1vZbqlu', blitzCategory: 'materials' },
  { name: 'Pipe & Fittings', url: '/b/Plumbing-Pipe-Fittings/N-5yc1vZbqm1', blitzCategory: 'materials' },
  { name: 'Plumbing Parts', url: '/b/Plumbing-Plumbing-Parts-Repair/N-5yc1vZbqkw', blitzCategory: 'materials' },
  { name: 'Faucets', url: '/b/Bath-Bathroom-Faucets/N-5yc1vZbza0', blitzCategory: 'materials' },
  { name: 'Toilets', url: '/b/Bath-Toilets-Toilet-Seats-Toilets/N-5yc1vZc3no', blitzCategory: 'materials' },

  // Electrical
  { name: 'Wire', url: '/b/Electrical-Wire/N-5yc1vZc4d0', blitzCategory: 'materials' },
  { name: 'Electrical Boxes', url: '/b/Electrical-Electrical-Boxes-Conduit-Fittings-Electrical-Boxes/N-5yc1vZc4cb', blitzCategory: 'materials' },
  { name: 'Circuit Breakers', url: '/b/Electrical-Breakers-Breaker-Boxes/N-5yc1vZc56g', blitzCategory: 'materials' },
  { name: 'Outlets & Switches', url: '/b/Electrical-Wiring-Devices-Light-Controls/N-5yc1vZc33h', blitzCategory: 'materials' },

  // HVAC
  { name: 'HVAC Parts', url: '/b/Heating-Venting-Cooling/N-5yc1vZc4k8', blitzCategory: 'materials' },
  { name: 'Thermostats', url: '/b/Heating-Venting-Cooling-Thermostats/N-5yc1vZc4lm', blitzCategory: 'materials' },

  // Building
  { name: 'Lumber', url: '/b/Lumber-Composites/N-5yc1vZbqpg', blitzCategory: 'materials' },
  { name: 'Drywall', url: '/b/Building-Materials-Drywall/N-5yc1vZaqte', blitzCategory: 'materials' },
  { name: 'Insulation', url: '/b/Building-Materials-Insulation/N-5yc1vZaqtb', blitzCategory: 'materials' },
];

const BASE_URL = 'https://www.homedepot.com';
const DELAY_MS = parseInt(process.env.SCRAPE_DELAY_MS || '1000');
const MAX_PAGES = parseInt(process.env.MAX_PAGES_PER_CATEGORY || '50');

function delay(ms: number): Promise<void> {
  // Add randomness to delay (80% to 120% of base delay)
  const jitter = ms * (0.8 + Math.random() * 0.4);
  return new Promise(resolve => setTimeout(resolve, jitter));
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
  // Handle formats: "$123.45", "$ 123 45", "123.45"
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

  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
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

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setViewport({ width: 1920, height: 1080 });

    const categoriesToScrape = CATEGORIES.slice(
      options.startCategory || 0,
      options.maxCategories ? (options.startCategory || 0) + options.maxCategories : undefined
    );

    for (const category of categoriesToScrape) {
      console.log(`\nScraping category: ${category.name}`);

      try {
        const categoryItems = await scrapeCategory(page, category);

        for (const item of categoryItems) {
          try {
            await onItem(item);
            total++;
          } catch (e) {
            errors++;
            console.error(`Error saving item: ${(e as Error).message}`);
          }
        }

        console.log(`  Scraped ${categoryItems.length} items from ${category.name}`);
      } catch (e) {
        console.error(`Error scraping category ${category.name}: ${(e as Error).message}`);
        errors++;
      }

      // Delay between categories
      await delay(DELAY_MS * 2);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return { total, errors };
}

async function scrapeCategory(page: Page, category: CategoryConfig): Promise<ScrapedItem[]> {
  const items: ScrapedItem[] = [];
  let pageNum = 1;
  let hasMore = true;

  while (hasMore && pageNum <= MAX_PAGES) {
    const url = `${BASE_URL}${category.url}?catStyle=ShowProducts&Nao=${(pageNum - 1) * 24}`;
    console.log(`  Page ${pageNum}: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(DELAY_MS);

      // Wait for product grid - try multiple possible selectors
      await page.waitForSelector('[data-testid="product-header"], [data-testid="product-pod"], .product-pod', { timeout: 15000 }).catch(() => null);

      // Additional wait for dynamic content
      await delay(1000);

      // Debug: save screenshot and HTML if enabled
      if (options.debug) {
        const debugDir = './debug';
        const fs = await import('fs');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir);

        const slug = category.name.toLowerCase().replace(/\s+/g, '-');
        await page.screenshot({ path: `${debugDir}/${slug}-page${pageNum}.png`, fullPage: true });
        const html = await page.content();
        fs.writeFileSync(`${debugDir}/${slug}-page${pageNum}.html`, html);
        console.log(`  Debug: saved screenshot and HTML to ${debugDir}/`);
      }

      const pageItems = await page.evaluate((cat, baseUrl) => {
        const products: any[] = [];

        // Try multiple selectors for product containers
        // Home Depot uses various container patterns
        let pods = document.querySelectorAll('[data-testid="product-pod"]');
        if (pods.length === 0) {
          // Fallback: find all product headers and get their parent containers
          const headers = document.querySelectorAll('[data-testid="product-header"]');
          pods = new Set<Element>();
          headers.forEach(h => {
            // Walk up to find the product card container
            let parent = h.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
              if (parent.querySelector('[data-testid="price-simple"]') ||
                  parent.querySelector('[class*="price"]')) {
                (pods as Set<Element>).add(parent);
                break;
              }
              parent = parent.parentElement;
            }
          });
          pods = Array.from(pods as Set<Element>) as unknown as NodeListOf<Element>;
        }

        (Array.from(pods) as Element[]).forEach((pod) => {
          try {
            // Product name - multiple selector attempts
            const nameEl = pod.querySelector('[data-testid="product-header"] span.sui-text-primary') ||
                          pod.querySelector('[data-testid="product-header"] span') ||
                          pod.querySelector('[data-testid="product-header"]');
            const name = nameEl?.textContent?.trim();

            // Price - updated selectors for new HD structure
            // Try the new sui- based selectors first
            let priceText = '';
            const priceSimple = pod.querySelector('[data-testid="price-simple"]');
            if (priceSimple) {
              // New format: sui-font-display classes
              const dollars = priceSimple.querySelector('.sui-font-display, [class*="sui-text-4xl"], [class*="sui-text-3xl"]')?.textContent;
              const cents = priceSimple.querySelector('[class*="sui-text-xs"], .sui-text-sm')?.textContent;
              if (dollars) {
                priceText = cents ? `${dollars}.${cents.replace(/[^0-9]/g, '')}` : dollars;
              }
            }

            // Fallback to old selectors
            if (!priceText) {
              const priceContainer = pod.querySelector('[data-testid="price-format"]');
              if (priceContainer) {
                const dollars = priceContainer.querySelector('.Price-dollars, [class*="Price"]')?.textContent;
                const cents = priceContainer.querySelector('.Price-cents')?.textContent || '00';
                if (dollars) {
                  priceText = `${dollars}.${cents}`;
                }
              }
            }

            // Final fallback: any element with price-like content
            if (!priceText) {
              const anyPrice = pod.querySelector('[class*="price"], [class*="Price"]');
              priceText = anyPrice?.textContent || '';
            }

            // SKU from product link or data attribute
            const linkEl = pod.querySelector('[data-testid="product-header"] > a') ||
                          pod.querySelector('a[href*="/p/"]');
            const href = linkEl?.getAttribute('href') || '';
            const productId = linkEl?.getAttribute('data-product-id') ||
                             linkEl?.getAttribute('product-id') || '';
            const skuMatch = href.match(/\/(\d+)(?:\?|$)/);
            const sku = productId || (skuMatch ? skuMatch[1] : '');

            // Unit info
            const unitEl = pod.querySelector('[class*="unit"]') ||
                          pod.querySelector('[class*="Unit"]') ||
                          pod.querySelector('[data-testid*="unit"]');
            const unitText = unitEl?.textContent || '';

            if (name && priceText) {
              products.push({
                name,
                priceText,
                sku,
                unitText,
                url: href ? (href.startsWith('http') ? href : `${baseUrl}${href}`) : '',
              });
            }
          } catch (e) {
            // Skip malformed products
          }
        });

        return products;
      }, category, BASE_URL);

      for (const item of pageItems) {
        const price = parsePrice(item.priceText);
        if (price && price > 0 && price < 100000) {
          items.push({
            source: 'homedepot',
            source_sku: item.sku,
            name: item.name,
            category: category.blitzCategory,
            subcategory: category.name,
            price,
            unit: normalizeUnit(item.unitText || item.name),
            url: item.url,
            scraped_at: new Date().toISOString(),
          });
        }
      }

      // Check if there's a next page
      hasMore = pageItems.length >= 20; // HD shows ~24 per page
      pageNum++;

    } catch (e) {
      console.error(`  Error on page ${pageNum}: ${(e as Error).message}`);
      hasMore = false;
    }
  }

  return items;
}

export { CATEGORIES };
