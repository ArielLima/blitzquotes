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

export type QuoteType = 'quote' | 'invoice';
export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'invoiced' | 'paid';

export interface Quote {
  id: string;
  user_id: string;
  type: QuoteType;
  invoice_number?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  job_description: string;
  line_items: LineItem[];
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  notes?: string;
  status: QuoteStatus;
  // Date fields
  valid_until?: string;    // Quote expiration date
  work_date?: string;      // When work was/will be done (for invoices)
  due_date?: string;       // Payment due date (for invoices)
  // Timestamps
  created_at: string;
  sent_at?: string;
  viewed_at?: string;
  approved_at?: string;
  invoiced_at?: string;
  paid_at?: string;
}

export type PaymentMethod = 'stripe' | 'venmo' | 'paypal' | 'zelle' | 'cashapp' | 'square' | 'none';

export type Trade = 'plumbing' | 'hvac' | 'electrical' | 'general';

export interface UserSettings {
  user_id: string;

  // Business info
  business_name: string;
  business_phone?: string;
  business_email?: string;
  business_address?: string;
  state?: string;              // For BlitzPrices region
  zip_code?: string;
  logo_url?: string;
  trade: Trade;

  // Pricing settings (KEY - these drive quote pricing)
  labor_rate: number;          // $/hr (e.g., 150)
  helper_rate?: number;        // $/hr for helper (optional)
  contractor_discount: number; // decimal (e.g., 0.15 for 15% off retail)
  material_markup: number;     // decimal (e.g., 0.35 for 35%)
  equipment_markup?: number;   // if different from materials
  fee_markup?: number;         // if different (often 0)

  // Tax
  default_tax_rate: number;    // decimal (e.g., 0.08 for 8%)

  // Payment
  payment_method: PaymentMethod;
  payment_link?: string;
  payment_details?: string;

  // Community
  contribute_to_blitzprices: boolean;  // default true

  created_at: string;
  updated_at: string;
}

// Input types for creating/updating

export type PricebookItemInput = Omit<PricebookItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export type QuoteInput = Omit<Quote, 'id' | 'user_id' | 'created_at' | 'sent_at' | 'viewed_at' | 'approved_at' | 'invoiced_at' | 'paid_at'>;

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
