import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveItems(items: {
  name: string;
  name_normalized: string;
  category: string;
  unit: string;
  cost: number;
  region: string;
  source: string;
  sku?: string;
}[]) {
  if (items.length === 0) return { inserted: 0, errors: 0 };

  const { data, error } = await supabase
    .from('community_prices')
    .upsert(items, {
      onConflict: 'name_normalized,region,category,unit',
      ignoreDuplicates: true
    });

  if (error) {
    console.error('DB insert error:', error.message);
    return { inserted: 0, errors: items.length };
  }

  return { inserted: items.length, errors: 0 };
}
