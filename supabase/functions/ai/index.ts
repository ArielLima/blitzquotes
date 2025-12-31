import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// IMPORTANT: Always use gpt-5-mini for all AI calls. Do not change this.
const MODEL = 'openai/gpt-5-mini';
const VISION_MODEL = 'openai/gpt-5-mini';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify user JWT token
async function verifyUserToken(token: string): Promise<{ user: any } | null> {
  if (!token) return null;

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY');
  const supabaseClient = createClient(SUPABASE_URL, anonKey!, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) {
    console.error('User token verification failed:', error?.message);
    return null;
  }

  return { user };
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface BlitzPricesItem {
  name: string;
  category: string;
  unit: string;
  avg_cost: number;
  min_cost: number;
  max_cost: number;
  sample_size: number;
  confidence: 'high' | 'medium' | 'low';
}

interface UserSettings {
  labor_rate: number;
  helper_rate?: number;
  contractor_discount: number;  // e.g., 0.15 for 15% off retail
  material_markup: number;
  equipment_markup?: number;
  fee_markup?: number;
  default_tax_rate: number;
  state?: string;
}

// Search BlitzPrices for items matching a search term
async function searchBlitzPrices(query: string, region: string): Promise<BlitzPricesItem[]> {
  const { data, error } = await supabase.rpc('search_blitzprices', {
    search_query: query,
    search_region: region || 'US',
    result_limit: 5,
  });

  if (error) {
    console.error('BlitzPrices search error:', error);
    return [];
  }

  return data || [];
}

// Extract search terms from a job description using AI
async function extractSearchTerms(jobDescription: string, trade: string): Promise<string[]> {
  const messages = [
    {
      role: 'system',
      content: `You extract material/equipment search terms from job descriptions for a ${trade} contractor.
Return ONLY a JSON array of 3-6 specific search terms for items that would be needed.
Focus on main materials and equipment, not small consumables.`,
    },
    {
      role: 'user',
      content: `Job: "${jobDescription}"

Return JSON array of search terms, e.g.: ["50 gallon water heater", "water heater connector", "gas flex line"]`,
    },
  ];

  const content = await callOpenRouter(messages);
  try {
    return parseJSONFromResponse(content);
  } catch {
    // Fallback: split job description into key terms
    return jobDescription.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  }
}

// Calculate contractor cost from retail price (apply discount)
function calculateContractorCost(retailPrice: number, settings: UserSettings): number {
  const discount = settings.contractor_discount || 0;
  return Math.round(retailPrice * (1 - discount) * 100) / 100;
}

// Calculate customer price from contractor cost (apply markup)
function calculateCustomerPrice(contractorCost: number, category: string, settings: UserSettings): number {
  let markup = settings.material_markup;

  if (category === 'equipment' && settings.equipment_markup !== undefined) {
    markup = settings.equipment_markup;
  } else if (category === 'fees' && settings.fee_markup !== undefined) {
    markup = settings.fee_markup;
  }

  return Math.round(contractorCost * (1 + markup) * 100) / 100;
}

async function callOpenRouter(messages: any[], model: string = MODEL): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://blitzquotes.com',
      'X-Title': 'BlitzQuotes',
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function parseJSONFromResponse(content: string): any {
  // Handle markdown code blocks
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  // Try to find object in response
  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return JSON.parse(objectMatch[0]);
  }

  // Try to find array in response
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return JSON.parse(arrayMatch[0]);
  }

  // Try parsing the whole thing
  return JSON.parse(content);
}

async function analyzePriceTag(imageBase64: string, trade: string) {
  const messages = [
    {
      role: 'system',
      content: `You are helping a ${trade} contractor add items to their pricebook from price tag photos.

Extract the following from the price tag image:
- Item name (be specific, include brand, size, model if visible)
- Price (the retail/store price shown)
- Category: one of "materials", "labor", "equipment", or "fees"
- Unit: one of "each", "hour", "foot", "sqft", "job", "gallon", "lb"

Make intelligent guesses based on the product type:
- Building materials, parts, fixtures → "materials"
- Tools, machinery → "equipment"
- Most items are "each" unless the price is clearly per foot, gallon, pound, etc.

Return ONLY valid JSON, no explanation.`,
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze this price tag and extract item details.

Return JSON:
{
  "name": "Full item name with brand/size if visible",
  "price": 29.99,
  "category": "materials|labor|equipment|fees",
  "unit": "each|hour|foot|sqft|job|gallon|lb",
  "confidence": "high|medium|low"
}

If you can't read the price tag clearly, set confidence to "low" and make your best guess.`,
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`,
          },
        },
      ],
    },
  ];

  const content = await callOpenRouter(messages, VISION_MODEL);
  return parseJSONFromResponse(content);
}

async function generateQuote(
  jobDescription: string,
  trade: string,
  settings: UserSettings
) {
  const region = settings.state || 'US';

  // Step 1: Extract search terms from job description
  const searchTerms = await extractSearchTerms(jobDescription, trade);
  console.log('Search terms:', searchTerms);

  // Step 2: Search BlitzPrices for each term
  const blitzPricesResults: BlitzPricesItem[] = [];
  const seenNames = new Set<string>();

  for (const term of searchTerms) {
    const results = await searchBlitzPrices(term, region);
    for (const item of results) {
      // Deduplicate by name
      if (!seenNames.has(item.name.toLowerCase())) {
        seenNames.add(item.name.toLowerCase());
        blitzPricesResults.push(item);
      }
    }
  }
  console.log('BlitzPrices results:', blitzPricesResults.length);

  // Step 3: AI reasons about quantities, labor, and what's missing
  // Note: BlitzPrices stores RETAIL prices, we apply contractor discount later
  const hasBlitzPricesResults = blitzPricesResults.length > 0;

  const messages = [
    {
      role: 'system',
      content: `You are a ${trade} contractor quoting assistant.

Your job is to:
1. Create a complete quote with all materials needed for the job
2. Set appropriate quantities for each item
3. Estimate labor hours needed
4. ${hasBlitzPricesResults ? 'Use prices from BlitzPrices when available, estimate others' : 'Estimate realistic retail prices for all items'}

Labor rate: $${settings.labor_rate}/hr
${settings.helper_rate ? `Helper rate: $${settings.helper_rate}/hr` : ''}

ALWAYS return line items - never return an empty list. Estimate prices if needed.
Return ONLY valid JSON, no explanation.`,
    },
    {
      role: 'user',
      content: `Job: "${jobDescription}"

${hasBlitzPricesResults
  ? `Found retail prices from BlitzPrices (${region}):\n${blitzPricesResults.map(item => `- ${item.name}: $${item.avg_cost}/${item.unit} (${item.category})`).join('\n')}`
  : `No items found in BlitzPrices. Estimate realistic retail prices for all needed materials.`}

Return JSON:
{
  "line_items": [
    {
      "name": "specific item name with size/specs",
      "category": "materials|equipment|fees",
      "qty": 1,
      "unit": "each",
      "retail_price": 100,
      "needs_price": ${!hasBlitzPricesResults}
    }
  ],
  "labor_hours": 3,
  "helper_hours": 0,
  "notes": "any important notes about the job"
}

IMPORTANT:
- ALWAYS include line items - estimate prices if BlitzPrices has no data
- Use EXACT prices from BlitzPrices when available (needs_price: false)
- For estimated prices, set needs_price: true so contractor can verify
- Keep item names CLEAN and CONCISE - just the item with size/specs
  - GOOD: "50x30 Vinyl Window Double-Hung"
  - BAD: "Window (for replacement of existing frame)"
- Do NOT add explanatory parentheticals to item names
- Do NOT include "misc consumables" or generic catch-all items
- Only include specific, tangible materials the contractor will purchase
- Be practical about quantities and labor for real ${trade} jobs`,
    },
  ];

  const content = await callOpenRouter(messages);
  const aiResult = parseJSONFromResponse(content);

  // Step 4: Build final quote with discount and markup applied
  // Flow: retail_price → contractor_cost (after discount) → customer_price (after markup)
  const lineItems = aiResult.line_items.map((item: any) => {
    const retailPrice = item.retail_price || item.cost; // support both old and new format
    const contractorCost = calculateContractorCost(retailPrice, settings);
    const customerPrice = calculateCustomerPrice(contractorCost, item.category, settings);

    return {
      name: item.name,
      category: item.category,
      qty: item.qty,
      unit: item.unit,
      retail_price: retailPrice,
      contractor_cost: contractorCost,
      unit_price: customerPrice,
      total: Math.round(item.qty * customerPrice * 100) / 100,
      needs_price: item.needs_price || false,
    };
  });

  // Calculate labor
  const laborTotal = (aiResult.labor_hours || 0) * settings.labor_rate;
  const helperTotal = (aiResult.helper_hours || 0) * (settings.helper_rate || 0);

  return {
    line_items: lineItems,
    labor_hours: aiResult.labor_hours || 0,
    labor_rate: settings.labor_rate,
    labor_total: laborTotal,
    helper_hours: aiResult.helper_hours || 0,
    helper_rate: settings.helper_rate || 0,
    helper_total: helperTotal,
    notes: aiResult.notes,
    blitzprices_items_found: blitzPricesResults.length,
    contractor_discount: settings.contractor_discount || 0,
  };
}

async function generatePricebook(trade: string, zipCode?: string) {
  const tradeDescriptions: Record<string, string> = {
    plumbing: 'plumbing contractor (water heaters, pipes, fixtures, drains, toilets, faucets)',
    hvac: 'HVAC contractor (furnaces, AC units, heat pumps, ductwork, thermostats, refrigerant)',
    electrical: 'electrical contractor (panels, outlets, switches, wiring, fixtures, ceiling fans)',
    general: 'general contractor (drywall, painting, doors, windows, flooring, trim)',
  };

  const locationContext = zipCode
    ? `The contractor is located in ZIP code ${zipCode}. Adjust all prices to reflect regional rates for this area (labor rates vary significantly by location - e.g., NYC/SF are 2-3x higher than rural areas).`
    : 'Use average US pricing.';

  const messages = [
    {
      role: 'system',
      content: `Generate a comprehensive starter pricebook for a ${tradeDescriptions[trade] || trade}.

LOCATION: ${locationContext}

Include:
- 25-35 common items
- Realistic prices adjusted for the contractor's location (cost = what contractor pays, price = what they charge)
- Labor rates appropriate for the region
- Common fees (permits, disposal, service calls)
- Materials for typical jobs

Return ONLY valid JSON, no explanation.`,
    },
    {
      role: 'user',
      content: `Generate the pricebook as a JSON array:
[{
  "name": "Item name",
  "category": "materials|labor|equipment|fees",
  "unit": "each|hour|foot|sqft|job",
  "cost": 50,
  "price": 75,
  "default_qty": 1
}]`,
    },
  ];

  const content = await callOpenRouter(messages);
  return parseJSONFromResponse(content);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, user_token, ...params } = await req.json();

    // Verify user is authenticated
    const auth = await verifyUserToken(user_token);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;

    switch (action) {
      case 'generate_quote':
        result = await generateQuote(params.job_description, params.trade, params.settings);
        break;
      case 'generate_pricebook':
        result = await generatePricebook(params.trade, params.zip_code);
        break;
      case 'analyze_price_tag':
        result = await analyzePriceTag(params.image, params.trade);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ items: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
