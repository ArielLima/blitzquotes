import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'anthropic/claude-sonnet-4';
const VISION_MODEL = 'anthropic/claude-sonnet-4';

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

async function callOpenRouter(messages: any[], model: string = MODEL, maxTokens: number = 1000): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  console.log('Calling OpenRouter with model:', model);

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
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  const responseText = await response.text();
  console.log('OpenRouter response status:', response.status);

  if (!response.ok) {
    console.error('OpenRouter error response:', responseText);
    throw new Error(`OpenRouter error (${response.status}): ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse OpenRouter response:', responseText);
    throw new Error('OpenRouter returned invalid JSON');
  }

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('Unexpected OpenRouter response structure:', JSON.stringify(data));
    throw new Error('OpenRouter response missing choices');
  }

  const content = data.choices[0].message.content;
  console.log('OpenRouter content length:', content?.length || 0);

  return content || '';
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

  // Step 1: Extract key terms from job description (simple parsing, no AI call)
  const words = jobDescription.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Get unique meaningful terms (skip common words)
  const skipWords = new Set(['install', 'replace', 'repair', 'need', 'want', 'with', 'from', 'that', 'this', 'have', 'will', 'would', 'could', 'should', 'about', 'been', 'were', 'they', 'their', 'what', 'when', 'where', 'which', 'there', 'these', 'those', 'some', 'into', 'also', 'just', 'only', 'other', 'than', 'then', 'very', 'after', 'before', 'between', 'under', 'over', 'through']);
  const searchTerms = [...new Set(words.filter(w => !skipWords.has(w)))].slice(0, 5);

  // Also add the full description as a search term for better matches
  const allSearchTerms = [jobDescription.slice(0, 50), ...searchTerms];
  console.log('Search terms:', allSearchTerms);

  // Step 2: Search BlitzPrices for all terms IN PARALLEL
  const searchPromises = allSearchTerms.map(term => searchBlitzPrices(term, region));
  const allResults = await Promise.all(searchPromises);

  // Deduplicate results
  const blitzPricesResults: BlitzPricesItem[] = [];
  const seenNames = new Set<string>();
  for (const results of allResults) {
    for (const item of results) {
      if (!seenNames.has(item.name.toLowerCase())) {
        seenNames.add(item.name.toLowerCase());
        blitzPricesResults.push(item);
      }
    }
  }
  console.log('BlitzPrices results:', blitzPricesResults.length);

  // Step 3: Single AI call to generate a complete quote
  const hasBlitzPricesResults = blitzPricesResults.length > 0;

  const messages = [
    {
      role: 'system',
      content: `You are a ${trade} contractor quoting assistant. Be concise.
Return ONLY valid JSON with materials needed for the job. No explanation.`,
    },
    {
      role: 'user',
      content: `Job: "${jobDescription}"

${hasBlitzPricesResults
  ? `BlitzPrices (${region}):\n${blitzPricesResults.slice(0, 10).map(item => `- ${item.name}: $${item.avg_cost}/${item.unit}`).join('\n')}`
  : `No BlitzPrices data. Estimate retail prices.`}

Labor rate: $${settings.labor_rate}/hr

Return JSON:
{"line_items":[{"name":"item","category":"materials|fees","qty":1,"unit":"each","retail_price":100,"needs_price":false}],"labor_hours":2}

RULES:
- Only MATERIALS and FEES - NO tools/equipment (contractor has their own tools)
- Use BlitzPrices prices when available, estimate others (needs_price:true)
- Clean item names, no parentheticals
- No "misc" or catch-all items
- Be practical for real ${trade} jobs`,
    },
  ];

  const content = await callOpenRouter(messages, MODEL, 1500);

  if (!content || content.trim() === '') {
    throw new Error('AI returned empty response');
  }

  const aiResult = parseJSONFromResponse(content);

  if (!aiResult || !aiResult.line_items) {
    throw new Error('AI response missing line_items');
  }

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
    const auth = await verifyUserToken(user_token || '');
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
