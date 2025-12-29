import { supabase } from './supabase';
import type { PricebookItem, LineItem, Trade } from '../types';

// AI calls go through Supabase Edge Function to keep API key secure
// The edge function is at: supabase/functions/ai/index.ts

export interface AILineItem {
  pricebook_item_id?: string; // undefined = AI guess (not in pricebook)
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
  is_guess: boolean; // true if AI estimated the price (not from pricebook)
}

export interface AIStarterPricebookItem {
  name: string;
  category: 'materials' | 'labor' | 'equipment' | 'fees';
  unit: string;
  cost: number;
  price: number;
  default_qty: number;
}

/**
 * Generate quote line items from a job description.
 * Uses pricebook items when available, guesses for items not in pricebook.
 */
export async function generateQuoteItems(
  pricebook: PricebookItem[],
  jobDescription: string,
  trade: Trade
): Promise<AILineItem[]> {
  try {
    const { data, error } = await supabase.functions.invoke('ai', {
      body: {
        action: 'generate_quote',
        pricebook: pricebook.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          price: item.price,
        })),
        job_description: jobDescription,
        trade,
      },
    });

    if (error) throw error;
    return data.items || [];
  } catch (error) {
    console.error('Failed to generate quote items:', error);
    throw error; // Let UI handle the error
  }
}

/**
 * Generate a starter pricebook for a trade during onboarding.
 * AI creates common items with realistic prices.
 */
export async function generateStarterPricebook(trade: Trade): Promise<AIStarterPricebookItem[]> {
  try {
    const { data, error } = await supabase.functions.invoke('ai', {
      body: {
        action: 'generate_pricebook',
        trade,
      },
    });

    if (error) throw error;
    return data.items || [];
  } catch (error) {
    console.error('Failed to generate starter pricebook:', error);
    throw error; // Let UI handle the error
  }
}

/**
 * Convert AI suggestions to LineItems for the quote.
 * Marks items as guesses if they weren't from the pricebook.
 */
export function processAISuggestions(
  suggestions: AILineItem[],
  pricebook: PricebookItem[]
): (LineItem & { is_guess: boolean })[] {
  return suggestions.map(suggestion => {
    // If AI provided a pricebook_item_id, verify it exists and use pricebook price
    if (suggestion.pricebook_item_id) {
      const pricebookItem = pricebook.find(p => p.id === suggestion.pricebook_item_id);
      if (pricebookItem) {
        return {
          pricebook_item_id: pricebookItem.id,
          name: pricebookItem.name,
          qty: suggestion.qty,
          unit: pricebookItem.unit,
          unit_price: pricebookItem.price,
          total: suggestion.qty * pricebookItem.price,
          is_guess: false,
        };
      }
    }

    // AI guess - not in pricebook, price is estimated
    return {
      pricebook_item_id: undefined,
      name: suggestion.name,
      qty: suggestion.qty,
      unit: suggestion.unit,
      unit_price: suggestion.unit_price,
      total: suggestion.qty * suggestion.unit_price,
      is_guess: true,
    };
  });
}
