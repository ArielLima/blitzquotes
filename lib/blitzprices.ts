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
