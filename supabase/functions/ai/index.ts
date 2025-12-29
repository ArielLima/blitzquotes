import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const MODEL = 'openai/gpt-5-mini';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PricebookItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
}

async function callOpenRouter(messages: { role: string; content: string }[]): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://blitzquotes.com',
      'X-Title': 'BlitzQuotes',
    },
    body: JSON.stringify({
      model: MODEL,
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

  // Try to find array in response
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return JSON.parse(arrayMatch[0]);
  }

  // Try parsing the whole thing
  return JSON.parse(content);
}

async function generateQuote(
  pricebook: PricebookItem[],
  jobDescription: string,
  trade: string,
  zipCode?: string
) {
  const locationContext = zipCode
    ? `The contractor is located in ZIP code ${zipCode}. Adjust labor rates and material costs to reflect regional pricing for this area.`
    : 'Use average US pricing.';

  const messages = [
    {
      role: 'system',
      content: `You are a ${trade} contractor quoting assistant. Given a pricebook and job description, suggest line items for the quote.

LOCATION: ${locationContext}

RULES:
1. For items IN the pricebook: use pricebook_item_id and the pricebook price
2. For items NOT in pricebook: set pricebook_item_id to null, is_guess to true, and estimate a fair price based on the contractor's location
3. Include labor hours based on job complexity
4. Don't forget permits, disposal, or other common fees if relevant
5. Be practical and accurate for real-world ${trade} jobs

Return ONLY valid JSON, no explanation.`,
    },
    {
      role: 'user',
      content: `Pricebook:
${JSON.stringify(pricebook, null, 2)}

Job description: "${jobDescription}"

Return a JSON array:
[{
  "pricebook_item_id": "uuid-or-null",
  "name": "item name",
  "qty": 1,
  "unit": "each",
  "unit_price": 100,
  "total": 100,
  "is_guess": false
}]`,
    },
  ];

  const content = await callOpenRouter(messages);
  return parseJSONFromResponse(content);
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
    const { action, ...params } = await req.json();

    let result;

    switch (action) {
      case 'generate_quote':
        result = await generateQuote(params.pricebook, params.job_description, params.trade, params.zip_code);
        break;
      case 'generate_pricebook':
        result = await generatePricebook(params.trade, params.zip_code);
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
