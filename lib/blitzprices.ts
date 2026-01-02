import { supabase } from './supabase';

// Types
export interface BlitzPricesResult {
  name: string;
  category: 'materials' | 'equipment' | 'fees';
  unit: string;
  avg_cost: number;
  min_cost: number;
  max_cost: number;
  sample_size: number;
  similarity: number;
  confidence: 'high' | 'medium' | 'low';
  last_updated: string | null;
}

export interface SearchResponse {
  query: string;
  region: string;
  has_match: boolean;
  results: BlitzPricesResult[];
  suggestion: string | null;
}

export interface SubmitParams {
  name: string;
  category: 'materials' | 'equipment' | 'fees';
  unit: string;
  cost: number;
  region: string;
  zip_code?: string;
  trade?: string;
  source?: 'manual' | 'price_tag_scan' | 'import';
  upc?: string;
  sku?: string;
}

export interface SubmitResponse {
  success: boolean;
  id: string;
  is_outlier: boolean;
  message: string;
}

// Search BlitzPrices for items
export async function searchBlitzPrices(
  query: string,
  region: string,
  options?: {
    category?: 'materials' | 'equipment' | 'fees';
    limit?: number;
  }
): Promise<SearchResponse> {
  const { data, error } = await supabase.functions.invoke('blitzprices', {
    body: {
      action: 'search',
      query,
      region,
      category: options?.category,
      limit: options?.limit || 10,
    },
  });

  if (error) {
    throw new Error(`BlitzPrices search failed: ${error.message}`);
  }

  return data as SearchResponse;
}

// Submit a price to BlitzPrices
export async function submitToBlitzPrices(params: SubmitParams): Promise<SubmitResponse> {
  const { data, error } = await supabase.functions.invoke('blitzprices', {
    body: {
      action: 'submit',
      ...params,
    },
  });

  if (error) {
    throw new Error(`BlitzPrices submit failed: ${error.message}`);
  }

  return data as SubmitResponse;
}

// Get valid categories
export function getCategories(): Array<{ value: string; label: string }> {
  return [
    { value: 'materials', label: 'Materials' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'fees', label: 'Fees' },
  ];
}

// Get valid units
export function getUnits(): Array<{ value: string; label: string }> {
  return [
    { value: 'each', label: 'Each' },
    { value: 'foot', label: 'Foot' },
    { value: 'sqft', label: 'Sq Ft' },
    { value: 'gallon', label: 'Gallon' },
    { value: 'lb', label: 'Pound' },
    { value: 'job', label: 'Per Job' },
  ];
}

// Average state sales tax rates (2024)
// Users should adjust for local rates
const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.04, AK: 0, AZ: 0.056, AR: 0.065, CA: 0.0725,
  CO: 0.029, CT: 0.0635, DE: 0, FL: 0.06, GA: 0.04,
  HI: 0.04, ID: 0.06, IL: 0.0625, IN: 0.07, IA: 0.06,
  KS: 0.065, KY: 0.06, LA: 0.0445, ME: 0.055, MD: 0.06,
  MA: 0.0625, MI: 0.06, MN: 0.0688, MS: 0.07, MO: 0.0423,
  MT: 0, NE: 0.055, NV: 0.0685, NH: 0, NJ: 0.0663,
  NM: 0.0513, NY: 0.04, NC: 0.0475, ND: 0.05, OH: 0.0575,
  OK: 0.045, OR: 0, PA: 0.06, RI: 0.07, SC: 0.06,
  SD: 0.045, TN: 0.07, TX: 0.0625, UT: 0.061, VT: 0.06,
  VA: 0.053, WA: 0.065, WV: 0.06, WI: 0.05, WY: 0.04,
};

// Get default tax rate for a state (as decimal)
export function getStateTaxRate(stateCode: string): number {
  return STATE_TAX_RATES[stateCode] || 0;
}

// US state codes for region selection
export function getRegions(): Array<{ value: string; label: string }> {
  return [
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' },
  ];
}
