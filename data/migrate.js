#!/usr/bin/env node

/**
 * BlitzPrices Data Migration Script
 * 
 * Imports Home Depot/Lowes product data from BrightData JSON files into Supabase.
 * 
 * Usage: node migrate.js <json_file> [--dry-run]
 * Example: node migrate.js ./data/plumbing.json
 *          node migrate.js ./data/plumbing.json --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Config
const DELAY_MS = 100;           // Delay between inserts
const LOG_INTERVAL = 100;       // Log progress every N items
const BATCH_SIZE = 50;          // Upsert in batches for better performance

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Stats tracking
const stats = {
  total: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

/**
 * Detect source from URL
 */
function detectSource(url) {
  if (!url) return 'unknown';
  if (url.includes('homedepot.com')) return 'homedepot';
  if (url.includes('lowes.com')) return 'lowes';
  return 'unknown';
}

/**
 * Parse price string to decimal
 */
function parsePrice(price) {
  if (price === null || price === undefined) return null;
  const parsed = parseFloat(String(price).replace(/[^0-9.]/g, ''));
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse rating string to decimal
 */
function parseRating(rating) {
  if (rating === null || rating === undefined) return null;
  const parsed = parseFloat(rating);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse review count to integer
 */
function parseReviewCount(count) {
  if (count === null || count === undefined) return null;
  const parsed = parseInt(String(count).replace(/[^0-9]/g, ''), 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Transform BrightData product to our schema
 */
function transformProduct(raw) {
  // Validate required fields
  if (!raw.product_id && !raw.sku) {
    return { valid: false, reason: 'Missing product_id and sku' };
  }
  if (!raw.product_name) {
    return { valid: false, reason: 'Missing product_name' };
  }

  const source = detectSource(raw.url);
  
  return {
    valid: true,
    data: {
      // Source tracking
      source: source,
      source_product_id: raw.product_id || raw.sku,
      source_url: raw.url || null,
      
      // Identifiers
      sku: raw.sku || null,
      model_number: raw.model_number || null,
      upc: raw.upcgtin13 || raw.upc || null,  // Prefer GTIN-13
      
      // Core info
      name: raw.product_name,
      description: raw.description || null,
      manufacturer: raw.manufacturer || null,
      
      // Pricing
      price: parsePrice(raw.final_price),
      original_price: parsePrice(raw.initial_price),
      in_stock: raw.in_stock ?? true,
      
      // Categorization
      category: raw.category?.name || null,
      root_category: raw.root_category?.name || null,
      
      // Quality signals
      rating: parseRating(raw.rating),
      review_count: parseReviewCount(raw.reviews_count),
      
      // Display
      image_url: raw.main_image || null,
      dimensions: raw.dimensions || null,
      
      // Timestamps
      updated_at: new Date().toISOString()
    }
  };
}

/**
 * Upsert a batch of products
 */
async function upsertBatch(products, dryRun) {
  if (dryRun) {
    console.log(`  [DRY RUN] Would upsert ${products.length} products`);
    return { success: products.length, failed: 0 };
  }

  const { data, error } = await supabase
    .from('products')
    .upsert(products, { 
      onConflict: 'source,source_product_id',
      ignoreDuplicates: false 
    });

  if (error) {
    return { success: 0, failed: products.length, error };
  }

  return { success: products.length, failed: 0 };
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main migration function
 */
async function migrate(filePath, dryRun = false) {
  console.log('\n========================================');
  console.log('BlitzPrices Data Migration');
  console.log('========================================\n');
  
  // Validate file
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Validate env
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in .env');
    process.exit(1);
  }

  console.log(`File: ${path.basename(filePath)}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Delay: ${DELAY_MS}ms between batches\n`);

  // Load data
  console.log('Loading JSON file...');
  let rawProducts;
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    rawProducts = JSON.parse(fileContent);
    
    // Handle both array and single object
    if (!Array.isArray(rawProducts)) {
      rawProducts = [rawProducts];
    }
  } catch (err) {
    console.error(`Error parsing JSON: ${err.message}`);
    process.exit(1);
  }

  stats.total = rawProducts.length;
  console.log(`Found ${stats.total} products\n`);
  console.log('Starting migration...\n');

  // Process in batches
  let batch = [];
  
  for (let i = 0; i < rawProducts.length; i++) {
    const raw = rawProducts[i];
    const result = transformProduct(raw);

    if (!result.valid) {
      stats.skipped++;
      stats.errors.push({
        index: i,
        product_id: raw.product_id || 'unknown',
        reason: result.reason
      });
      continue;
    }

    batch.push(result.data);

    // Process batch when full
    if (batch.length >= BATCH_SIZE) {
      const batchResult = await upsertBatch(batch, dryRun);
      stats.successful += batchResult.success;
      stats.failed += batchResult.failed;
      
      if (batchResult.error) {
        stats.errors.push({
          index: i,
          reason: batchResult.error.message,
          batch: true
        });
      }

      stats.processed += batch.length;
      batch = [];

      // Log progress
      if (stats.processed % LOG_INTERVAL === 0 || stats.processed === stats.total) {
        const pct = ((stats.processed / stats.total) * 100).toFixed(1);
        console.log(`  Processed ${stats.processed}/${stats.total} (${pct}%) - ${stats.successful} ok, ${stats.failed} failed, ${stats.skipped} skipped`);
      }

      // Rate limiting
      await sleep(DELAY_MS);
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    const batchResult = await upsertBatch(batch, dryRun);
    stats.successful += batchResult.success;
    stats.failed += batchResult.failed;
    stats.processed += batch.length;
    
    if (batchResult.error) {
      stats.errors.push({
        reason: batchResult.error.message,
        batch: true
      });
    }
  }

  // Final report
  console.log('\n========================================');
  console.log('Migration Complete');
  console.log('========================================\n');
  console.log(`Total products:  ${stats.total}`);
  console.log(`Successful:      ${stats.successful}`);
  console.log(`Failed:          ${stats.failed}`);
  console.log(`Skipped:         ${stats.skipped}`);
  
  if (stats.errors.length > 0) {
    console.log(`\nErrors (first 10):`);
    stats.errors.slice(0, 10).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.reason} ${err.product_id ? `(product: ${err.product_id})` : ''}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more`);
    }
  }

  console.log('\nDone!\n');
}

// CLI
const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

if (!filePath) {
  console.log('Usage: node migrate.js <json_file> [--dry-run]');
  console.log('');
  console.log('Examples:');
  console.log('  node migrate.js ./data/plumbing.json');
  console.log('  node migrate.js ./data/plumbing.json --dry-run');
  process.exit(1);
}

migrate(filePath, dryRun);
