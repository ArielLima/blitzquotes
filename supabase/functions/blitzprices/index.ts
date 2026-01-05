import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchParams {
  query: string;
  region: string;
  category?: string;
  limit?: number;
}

interface SubmitParams {
  name: string;
  category: 'materials' | 'equipment' | 'fees';
  unit: string;
  cost: number;
  region: string;
  zip_code?: string;
  trade?: string;
  source?: string;
  upc?: string;
  sku?: string;
}

// Search BlitzPrices database
async function searchPrices(params: SearchParams & { user_id?: string }) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { query, region, category, limit = 10, user_id } = params;

  if (!query || !region) {
    throw new Error('query and region are required');
  }

  // Call the search function we created in the database
  const { data, error } = await supabase.rpc('search_blitzprices', {
    search_query: query,
    search_region: region.toUpperCase(),
    search_category: category || null,
    similarity_threshold: 0.3,
    result_limit: limit,
  });

  if (error) {
    console.error('Search error:', error);
    throw new Error(`Search failed: ${error.message}`);
  }

  const hasMatch = data && data.length > 0;

  // Log search miss if no results found
  if (!hasMatch) {
    await supabase.rpc('log_search_miss', {
      p_query: query,
      p_region: region.toUpperCase(),
      p_category: category || null,
      p_source: 'direct_search',
      p_user_id: user_id || null,
    }).catch((err: any) => console.error('Failed to log search miss:', err.message));
  }

  return {
    query,
    region: region.toUpperCase(),
    has_match: hasMatch,
    results: hasMatch
      ? data.map((item: any) => ({
          name: item.name,
          category: item.category,
          unit: item.unit,
          avg_cost: parseFloat(item.avg_cost),
          min_cost: parseFloat(item.min_cost),
          max_cost: parseFloat(item.max_cost),
          sample_size: item.sample_size,
          similarity: parseFloat(item.similarity?.toFixed(2) || '0'),
          confidence: item.confidence,
          last_updated: item.last_updated,
        }))
      : [],
    suggestion: hasMatch ? null : 'No community data available for this item.',
  };
}

// Submit a price to BlitzPrices
async function submitPrice(params: SubmitParams) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { name, category, unit, cost, region, zip_code, trade, source, upc, sku } = params;

  // Validation
  if (!name || !category || !unit || cost === undefined || !region) {
    throw new Error('name, category, unit, cost, and region are required');
  }

  const validCategories = ['materials', 'equipment', 'fees'];
  if (!validCategories.includes(category)) {
    throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }

  const validUnits = ['each', 'foot', 'sqft', 'gallon', 'lb', 'job'];
  if (!validUnits.includes(unit)) {
    throw new Error(`Invalid unit. Must be one of: ${validUnits.join(', ')}`);
  }

  if (cost < 0) {
    throw new Error('Cost must be a positive number');
  }

  // Check for outliers (basic: if >3x or <0.3x the existing average, flag it)
  let isOutlier = false;
  const normalizedName = name.toLowerCase().trim().replace(/\s+/g, ' ');

  const { data: existing } = await supabase
    .from('price_aggregates')
    .select('avg_cost')
    .eq('name_normalized', normalizedName)
    .eq('region', region.toUpperCase())
    .single();

  if (existing && existing.avg_cost) {
    const avgCost = parseFloat(existing.avg_cost);
    if (cost > avgCost * 3 || cost < avgCost * 0.3) {
      isOutlier = true;
    }
  }

  // Insert the price
  const { data, error } = await supabase.from('community_prices').insert({
    name,
    category,
    unit,
    cost,
    region: region.toUpperCase(),
    zip_code,
    trade,
    source: source || 'manual',
    upc,
    sku,
    is_outlier: isOutlier,
  }).select('id').single();

  if (error) {
    console.error('Submit error:', error);
    throw new Error(`Submit failed: ${error.message}`);
  }

  return {
    success: true,
    id: data.id,
    is_outlier: isOutlier,
    message: isOutlier
      ? 'Price submitted but flagged for review (significantly different from average)'
      : 'Price submitted successfully',
  };
}

// Get metadata (categories, units, regions with data)
async function getMetadata(type: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  switch (type) {
    case 'categories':
      return ['materials', 'equipment', 'fees'];

    case 'units':
      return ['each', 'foot', 'sqft', 'gallon', 'lb', 'job'];

    case 'regions': {
      const { data, error } = await supabase
        .from('price_aggregates')
        .select('region')
        .limit(100);

      if (error) throw new Error(`Failed to get regions: ${error.message}`);

      const regions = [...new Set(data?.map((r: any) => r.region) || [])];
      return regions.sort();
    }

    default:
      throw new Error(`Unknown metadata type: ${type}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Handle different endpoints
    // POST /blitzprices with action in body (simple approach for now)
    const body = await req.json();
    const { action, ...params } = body;

    let result;

    switch (action) {
      case 'search':
        result = await searchPrices(params as SearchParams);
        break;

      case 'submit':
        result = await submitPrice(params as SubmitParams);
        break;

      case 'metadata':
        result = await getMetadata(params.type);
        break;

      default:
        throw new Error(`Unknown action: ${action}. Valid actions: search, submit, metadata`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('BlitzPrices function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
