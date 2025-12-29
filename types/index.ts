// Database types

export interface PricebookItem {
  id: string;
  user_id: string;
  name: string;
  category: 'materials' | 'labor' | 'equipment' | 'fees';
  unit: string;
  cost: number;
  price: number;
  default_qty: number;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  pricebook_item_id?: string;
  name: string;
  description?: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface Quote {
  id: string;
  user_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  job_description: string;
  line_items: LineItem[];
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  notes?: string;
  status: 'draft' | 'sent' | 'viewed' | 'paid';
  created_at: string;
  sent_at?: string;
  viewed_at?: string;
  paid_at?: string;
}

export type PaymentMethod = 'stripe' | 'venmo' | 'paypal' | 'zelle' | 'cashapp' | 'square' | 'none';

export type Trade = 'plumbing' | 'hvac' | 'electrical' | 'general';

export interface UserSettings {
  user_id: string;
  business_name: string;
  business_phone?: string;
  business_email?: string;
  business_address?: string;
  zip_code?: string;
  logo_url?: string;
  trade: Trade;
  default_tax_rate: number;
  default_markup: number;
  payment_method: PaymentMethod;
  payment_link?: string;
  payment_details?: string;
  created_at: string;
  updated_at: string;
}

// Input types for creating/updating

export type PricebookItemInput = Omit<PricebookItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export type QuoteInput = Omit<Quote, 'id' | 'user_id' | 'created_at' | 'sent_at' | 'viewed_at' | 'paid_at'>;

export type UserSettingsInput = Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'>;

// AI types

export interface AILineItemSuggestion {
  pricebook_item_id: string;
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface AIStarterPricebookItem {
  name: string;
  category: 'materials' | 'labor' | 'equipment' | 'fees';
  unit: string;
  cost: number;
  price: number;
  default_qty: number;
}
